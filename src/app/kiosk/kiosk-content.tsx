"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogIn, LogOut as LogOutIcon, CheckCircle2, XCircle,
  RotateCcw, ArrowLeft, Wifi, ScanFace, AlertTriangle,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatTime, getInitials } from "@/lib/utils";
import {
  loadModels,
  detectFaceConsensus,
  findBestMatch,
  isConfidentMatch,
  isModelsLoaded,
  keepFacesWithDescriptor,
} from "@/lib/ai/face-api-service";
import {
  FACE_SOFT_RETRY_COOLDOWN_MS,
  FACE_STABLE_HITS,
  startFacePresenceLoop,
} from "@/lib/ai/face-detection-loop";
import { DEFAULT_FACE_MATCH_THRESHOLD } from "@/lib/face-match-threshold";
import {
  decideAttendanceMarkType,
  fetchLastAttendanceRecord,
} from "@/lib/attendance-window";
import { getBrowserLocationIfMobile, getClientDeviceClass } from "@/lib/browser-location";
import { APP_NAME, BRAND } from "@/lib/brand";

type KioskPhase = "loading_models" | "idle" | "processing" | "success" | "error";
type AttType = "CHECK_IN" | "CHECK_OUT";

interface BranchOption {
  id: string;
  name: string;
  duplicateWindowMinutes: number;
}
interface RegisteredEmp {
  employeeId: string;
  fullName: string;
  position?: string | null;
  photo?: string | null;
  branchId?: string | null;
  descriptor: number[] | null;
}
interface FaceSearchMatch {
  employeeId: string;
  fullName: string;
  position?: string | null;
  photo?: string | null;
  branchId?: string | null;
  distance: number;
}
interface KioskResult { type: AttType; employee: { id: string; fullName: string; position?: string | null; photo?: string | null }; time: string; }

type FaceSearchOutcome =
  | { status: "match"; match: FaceSearchMatch }
  | { status: "ambiguous" }
  | { status: "weak"; distance?: number }
  | { status: "empty" }
  | { status: "none"; distance?: number }
  | { status: "error" };

async function searchFaceInDatabase(
  descriptor: number[],
  branchId: string
): Promise<FaceSearchOutcome> {
  try {
    const response = await fetch("/api/face/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptor, branchId }),
    });
    if (!response.ok) return { status: "error" };
    const data = (await response.json()) as {
      match?: FaceSearchMatch | null;
      reason?: string;
      distance?: number;
    };
    if (data.reason === "empty_gallery") return { status: "empty" };
    if (data.reason === "ambiguous") return { status: "ambiguous" };
    if (data.reason === "weak_match") {
      return { status: "weak", distance: data.distance };
    }
    if (data.match) return { status: "match", match: data.match };
    return { status: "none", distance: data.distance };
  } catch {
    return { status: "error" };
  }
}

const RESET_DELAY = 10_000;

export default function KioskPage() {
  const router = useRouter();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const resetTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const stableHitsRef = useRef(0);
  const softRetryUntilRef = useRef(0);
  const branchIdRef = useRef("");
  const registeredRef = useRef<RegisteredEmp[]>([]);
  const thresholdRef = useRef(DEFAULT_FACE_MATCH_THRESHOLD);
  const phaseRef = useRef<KioskPhase>("loading_models");

  const [branches, setBranches]         = useState<BranchOption[]>([]);
  const [branchId, setBranchId]         = useState("");
  const [registered, setRegistered]     = useState<RegisteredEmp[]>([]);
  const [faceMatchThreshold, setFaceMatchThreshold] = useState(DEFAULT_FACE_MATCH_THRESHOLD);
  const [phase, setPhase]               = useState<KioskPhase>("loading_models");
  const [faceVisible, setFaceVisible]   = useState(false);
  const [result, setResult]             = useState<KioskResult | null>(null);
  const [errorMsg, setErrorMsg]         = useState("");
  const [cameraError, setCameraError]   = useState("");
  const [countdown, setCountdown]       = useState(10);
  const [cameraReady, setCameraReady]   = useState(false);
  const [statusMsg, setStatusMsg]       = useState("");

  branchIdRef.current = branchId;
  registeredRef.current = registered;
  thresholdRef.current = faceMatchThreshold;
  phaseRef.current = phase;

  // ── Load branches ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/branches?pageSize=100")
      .then(r => r.json())
      .then((d: { data?: BranchOption[] }) => {
        const list = d.data ?? [];
        setBranches(list);
        if (list.length === 1) setBranchId(list[0].id);
      })
      .catch(() => {});
  }, []);

  // ── Load registered employees with face descriptors ──────────────────────
  useEffect(() => {
    if (!branchId) return;
    fetch("/api/face/descriptors")
      .then(r => r.json())
      .then(async (d: { data?: RegisteredEmp[]; faceMatchThreshold?: number }) => {
        if (typeof d.faceMatchThreshold === "number") {
          setFaceMatchThreshold(d.faceMatchThreshold);
        }
        const list = keepFacesWithDescriptor(d.data ?? []);
        setRegistered(list);
      })
      .catch(() => {});
  }, [branchId]);

  // ── Load models + start camera ───────────────────────────────────────────
  useEffect(() => {
    loadModels()
      .then(() => setPhase("idle"))
      .catch(() => {
        setErrorMsg("No se pudieron cargar los modelos de reconocimiento facial");
        setPhase("error");
      });
    startCamera();
    return () => { stopEverything(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detection loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "idle" && cameraReady && isModelsLoaded()) {
      startDetectionLoop();
    } else {
      stopDetectionLoop();
    }
    return () => stopDetectionLoop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cameraReady]);

  // ── Countdown after result ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "success" && phase !== "error") return;
    setCountdown(Math.ceil(RESET_DELAY / 1000));
    const interval = setInterval(() => setCountdown(c => c - 1), 1000);
    resetTimer.current = setTimeout(reset, RESET_DELAY);
    return () => { clearInterval(interval); if (resetTimer.current) clearTimeout(resetTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCameraError("Sin acceso a cámara — verifique los permisos del navegador");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  function startDetectionLoop() {
    if (stopLoopRef.current) return;
    stopLoopRef.current = startFacePresenceLoop({
      getVideo: () => videoRef.current,
      shouldRun: () =>
        phaseRef.current === "idle" &&
        !processingRef.current &&
        Date.now() >= softRetryUntilRef.current,
      onTick: async (presence) => {
        setFaceVisible(presence.detected);

        if (!presence.detected) {
          stableHitsRef.current = 0;
          setStatusMsg("Sin rostro a la vista. Mire de frente");
          return;
        }

        const currentBranchId = branchIdRef.current;
        if (!currentBranchId) {
          stableHitsRef.current = 0;
          setStatusMsg("Seleccione una sucursal");
          return;
        }

        stableHitsRef.current += 1;
        const hits = stableHitsRef.current;
        if (hits < FACE_STABLE_HITS) {
          setStatusMsg(`Rostro detectado — mantenga la posición (${hits}/${FACE_STABLE_HITS})`);
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        setStatusMsg("Confirmando rostro...");
        const detection = await detectFaceConsensus(video);
        const descriptor = detection.descriptor;
        if (!descriptor) {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          setStatusMsg("Acerque la cara y mire de frente");
          return;
        }

        setStatusMsg("Buscando identidad...");
        const serverOutcome = await searchFaceInDatabase(descriptor, currentBranchId);
        if (serverOutcome.status === "match") {
          void runIdentification(serverOutcome.match);
          return;
        }
        if (serverOutcome.status === "empty") {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          setStatusMsg("No hay rostros enrolados en esta sucursal");
          return;
        }
        if (serverOutcome.status === "ambiguous") {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          setStatusMsg("Rostro ambiguo — mire de frente e intente de nuevo");
          return;
        }
        if (serverOutcome.status === "weak") {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          const dist =
            serverOutcome.distance != null
              ? ` (${serverOutcome.distance.toFixed(2)})`
              : "";
          setStatusMsg(`Coincidencia débil${dist} — acerque la cara e intente de nuevo`);
          return;
        }

        const localRegistered = registeredRef.current;
        if (serverOutcome.status === "error" && localRegistered.length > 0) {
          const match = findBestMatch(
            descriptor,
            localRegistered.map((e) => ({
              employeeId: e.employeeId,
              descriptor: e.descriptor as number[],
            })),
            thresholdRef.current
          );

          if (match?.ambiguous) {
            stableHitsRef.current = 0;
            setStatusMsg("Rostro ambiguo — mire de frente e intente de nuevo");
            return;
          }

          if (isConfidentMatch(match, thresholdRef.current) && match) {
            const matchedEmp = localRegistered.find((e) => e.employeeId === match.employeeId);
            if (matchedEmp) void runIdentification(matchedEmp);
            return;
          }
        }

        stableHitsRef.current = 0;
        softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
        const dist =
          serverOutcome.status === "none" && serverOutcome.distance != null
            ? ` (${serverOutcome.distance.toFixed(2)})`
            : "";
        setStatusMsg(`Sin coincidencia${dist} — reintentando...`);
      },
    });
  }

  function stopDetectionLoop() {
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    setFaceVisible(false);
  }

  function stopEverything() {
    stopCamera();
    stopDetectionLoop();
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }

  const runIdentification = useCallback(async (matchedEmp: RegisteredEmp | FaceSearchMatch) => {
    if (phase !== "idle" || processingRef.current) return;
    processingRef.current = true;
    const employeeId = matchedEmp.employeeId;
    setPhase("processing");
    stopDetectionLoop();
    setStatusMsg("Verificando última marcación...");

    try {
      const branch = branches.find((b) => b.id === branchId);
      const windowMinutes = branch?.duplicateWindowMinutes ?? 10;
      // GPS en paralelo con la última marcación: no sumar su latencia al flujo.
      const locationPromise = getBrowserLocationIfMobile();
      const lastRecord = await fetchLastAttendanceRecord(employeeId);
      const decision = decideAttendanceMarkType(lastRecord, windowMinutes);

      if ("error" in decision) {
        throw new Error(decision.error);
      }

      const recordType = decision.type;

      setStatusMsg("Registrando asistencia...");
      const location = await locationPromise;
      const deviceClass = getClientDeviceClass();

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          branchId,
          type: recordType,
          confidenceScore: "distance" in matchedEmp ? Math.max(0, 1 - matchedEmp.distance) : 1,
          validationStatus: "SUCCESS",
          deviceClass,
          ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(e.error ?? "Error al registrar marcación");
      }

      const data = await res.json();
      const attType = (data.type ?? recordType) as AttType;

      setResult({
        type: attType,
        employee: {
          id: matchedEmp.employeeId,
          fullName: matchedEmp.fullName,
          position: matchedEmp.position,
          photo: matchedEmp.photo,
        },
        time: new Date().toISOString(),
      });
      setPhase("success");
      stopCamera();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al registrar");
      setPhase("error");
      stopCamera();
    } finally {
      processingRef.current = false;
    }
  }, [phase, branchId, branches]);

  function reset() {
    stopEverything();
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setStatusMsg("");
    setCountdown(10);
    processingRef.current = false;
    stableHitsRef.current = 0;
    softRetryUntilRef.current = 0;
    startCamera();
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800">
        <button type="button" onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />Dashboard
        </button>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logoSymbol} alt={APP_NAME} className="w-6 h-6" />
          <span className="text-white font-semibold text-sm">{APP_NAME}</span>
        </div>
        {branchId && (
          <span className="text-slate-400 text-xs">
            {branches.find(b => b.id === branchId)?.name ?? ""}
          </span>
        )}
      </div>

      {/* ── Branch selector ───────────────────────────────────────────────── */}
      {branches.length > 1 && phase === "idle" && (
        <div className="px-4 pt-3 max-w-xs mx-auto w-full">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
              <SelectValue placeholder="Seleccionar sucursal" />
            </SelectTrigger>
            <SelectContent>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Camera view ──────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn("w-full h-full object-cover", (phase === "success" || phase === "error") && "opacity-20 scale-105")}
        />

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4">
            <AlertTriangle className="w-16 h-16 text-yellow-400" />
            <p className="text-white text-center px-8">{cameraError}</p>
            <Button onClick={startCamera} variant="outline">Reintentar</Button>
          </div>
        )}

        {/* Loading models */}
        {phase === "loading_models" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            <p className="text-slate-400 text-sm">Cargando modelos de IA...</p>
          </div>
        )}

        {/* ── IDLE: scanning ────────────────────────────────────────────── */}
        {phase === "idle" && cameraReady && !cameraError && (
          <>
            {/* Corner brackets */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-64">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                {faceVisible && (
                  <div className="absolute inset-x-0 h-0.5 bg-blue-400/80 animate-[slide-in-right_1.5s_ease-in-out_infinite]" style={{ top: "50%" }} />
                )}
              </div>
            </div>

            {/* Status pill */}
            <div className="absolute top-4 left-0 right-0 flex justify-center">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm",
                faceVisible ? "bg-green-900/70 text-green-300" : "bg-slate-900/70 text-slate-300"
              )}>
                <div className={cn("w-2 h-2 rounded-full animate-pulse", faceVisible ? "bg-green-400" : "bg-slate-500")} />
                {!branchId ? "Seleccione una sucursal" :
                 !faceVisible ? (statusMsg || "Sin rostro a la vista. Mire de frente") :
                 (statusMsg || "Rostro detectado")}
              </div>
            </div>

            {/* Bottom info */}
            {branchId && (
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-950/90 to-transparent">
                <div className="max-w-sm mx-auto text-center">
                  {statusMsg && (
                    <p className="text-white text-sm font-medium mb-2">{statusMsg}</p>
                  )}
                  <div className="flex items-center justify-center gap-2 text-white/70 text-xs">
                    <Wifi className="w-3 h-3 text-green-400" />
                    <span>Detección MediaPipe — identidad solo con cara estable</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PROCESSING ────────────────────────────────────────────────── */}
        {phase === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/60">
            <div className="w-20 h-20 rounded-full border-4 border-blue-400 flex items-center justify-center animate-pulse">
              <ScanFace className="w-10 h-10 text-blue-300" />
            </div>
            <p className="text-white text-lg font-bold">{statusMsg || "Procesando..."}</p>
          </div>
        )}

        {/* ── SUCCESS ───────────────────────────────────────────────────── */}
        {phase === "success" && result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 animate-fade-in">
            <div className={cn(
              "mx-4 p-8 rounded-3xl border-2 text-center max-w-sm w-full backdrop-blur-md",
              result.type === "CHECK_IN"
                ? "bg-green-900/80 border-green-500"
                : "bg-orange-900/80 border-orange-500"
            )}>
              <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-white/20">
                {result.employee.photo && <AvatarImage src={result.employee.photo} alt={result.employee.fullName} />}
                <AvatarFallback className="text-2xl font-bold bg-white/10 text-white">
                  {getInitials(result.employee.fullName)}
                </AvatarFallback>
              </Avatar>

              {result.type === "CHECK_IN"
                ? <LogIn className="w-8 h-8 text-green-300 mx-auto mb-2" />
                : <LogOutIcon className="w-8 h-8 text-orange-300 mx-auto mb-2" />}

              <h2 className="text-white text-2xl font-bold">
                {result.type === "CHECK_IN" ? "Entrada registrada" : "Salida registrada"}
              </h2>
              <p className="text-white text-xl mt-2 font-semibold">{result.employee.fullName}</p>
              {result.employee.position && <p className="text-white/60 text-sm">{result.employee.position}</p>}
              <p className="text-4xl font-bold text-white mt-4">{formatTime(result.time)}</p>

              <div className="flex items-center justify-center gap-2 mt-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-green-300 text-sm font-medium">Verificación biométrica exitosa</span>
              </div>
            </div>

            <p className="text-slate-400 text-sm">Volviendo al inicio en {countdown}s...</p>

            <Button onClick={reset} variant="ghost" className="text-slate-400 hover:text-white">
              <RotateCcw className="w-4 h-4 mr-2" />Nueva marcación
            </Button>
          </div>
        )}

        {/* ── ERROR ─────────────────────────────────────────────────────── */}
        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 animate-fade-in">
            <div className="mx-4 p-8 rounded-3xl border-2 border-red-500 bg-red-900/80 text-center max-w-sm w-full backdrop-blur-md">
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-white text-xl font-bold">No reconocido</h2>
              <p className="text-red-200 text-sm mt-2">{errorMsg || "No se pudo identificar el rostro. Intente nuevamente."}</p>
              <p className="text-red-100/60 text-xs mt-3">Volviendo a escanear en {countdown}s...</p>
            </div>
            <Button onClick={reset} variant="outline" className="border-slate-700 text-slate-300">
              <RotateCcw className="w-4 h-4 mr-2" />Reintentar ({countdown}s)
            </Button>
          </div>
        )}

        {/* No employees notice */}
        {phase === "idle" && branchId && registered.length === 0 && !cameraError && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center">
            <div className="bg-yellow-900/70 backdrop-blur-sm text-yellow-200 text-xs px-4 py-2 rounded-full flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              No hay empleados con rostro registrado en esta sucursal
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
