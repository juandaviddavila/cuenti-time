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
import { loadModels, detectFace, findBestMatch, isMatch, isModelsLoaded } from "@/lib/ai/face-api-service";
import { DEFAULT_FACE_MATCH_THRESHOLD } from "@/lib/face-match-threshold";
import { checkLiveness } from "@/lib/ai/openrouter-service";
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

async function searchFaceInDatabase(descriptor: number[], branchId: string): Promise<FaceSearchMatch | null> {
  const response = await fetch("/api/face/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ descriptor, branchId }),
  });
  if (!response.ok) return null;
  const data = await response.json() as { match?: FaceSearchMatch | null };
  return data.match ?? null;
}

async function descriptorFromPhoto(photo: string): Promise<number[] | null> {
  await loadModels();
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = photo;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  if (!img.complete || img.naturalWidth === 0) return null;
  const result = await detectFace(img);
  return result.descriptor;
}

async function prepareRegisteredEmployees(data: RegisteredEmp[]): Promise<RegisteredEmp[]> {
  const prepared: RegisteredEmp[] = [];
  for (const item of data) {
    if (Array.isArray(item.descriptor)) {
      prepared.push(item);
      continue;
    }
    if (!item.photo) continue;
    try {
      const descriptor = await descriptorFromPhoto(item.photo);
      if (descriptor) {
        prepared.push({ ...item, descriptor });
        void fetch(`/api/employees/${item.employeeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            faceRegistered: true,
            faceRegisteredAt: new Date().toISOString(),
            faceEmbedding: descriptor,
            faceEmbeddingId: `face_${Date.now()}`,
          }),
        }).catch(() => undefined);
      }
    } catch (err) {
      console.warn(`No se pudo extraer embedding de ${item.fullName}`, err);
    }
  }
  return prepared;
}

const DETECTION_INTERVAL = 1000; // ms between face detection attempts
const RESET_DELAY = 10_000;

export default function KioskPage() {
  const router = useRouter();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const list = await prepareRegisteredEmployees(d.data ?? []);
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
    if (timerRef.current) return;
    timerRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || phase !== "idle") return;

      try {
        const detection = await detectFace(video);
        setFaceVisible(detection.detected);

        if (detection.detected && detection.descriptor && branchId) {
          const serverMatch = await searchFaceInDatabase(detection.descriptor, branchId);
          if (serverMatch) {
            void runIdentification(serverMatch);
            return;
          }

          if (registered.length > 0) {
            const match = findBestMatch(
              detection.descriptor,
              registered
                .filter(e => e.descriptor !== null)
                .map(e => ({ employeeId: e.employeeId, descriptor: e.descriptor as number[] })),
              faceMatchThreshold
            );

            if (match && isMatch(match.distance, faceMatchThreshold)) {
              const matchedEmp = registered.find(e => e.employeeId === match.employeeId);
              if (matchedEmp) void runIdentification(matchedEmp);
            }
          }
        }
      } catch {
        // Non-fatal detection errors
      }
    }, DETECTION_INTERVAL);
  }

  function stopDetectionLoop() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setFaceVisible(false);
  }

  function stopEverything() {
    stopCamera();
    stopDetectionLoop();
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }

  function captureFrame(): string | null {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  const runIdentification = useCallback(async (matchedEmp: RegisteredEmp | FaceSearchMatch) => {
    if (phase !== "idle") return;
    const employeeId = matchedEmp.employeeId;
    setPhase("processing");
    stopDetectionLoop();
    setStatusMsg("Verificando prueba de vida...");

    const photo = captureFrame();

    // Liveness check via OpenRouter
    const liveness = await checkLiveness(photo ?? "");

    if (!liveness.faceDetected) {
      setErrorMsg("No se detectó un rostro válido");
      setPhase("error");
      stopCamera();
      return;
    }
    if (!liveness.isRealPerson || !liveness.antiSpoofingPassed) {
      setErrorMsg(`Prueba de vida fallida: ${liveness.reason}`);
      setPhase("error");
      stopCamera();
      return;
    }

    setStatusMsg("Verificando última marcación...");

    try {
      const branch = branches.find((b) => b.id === branchId);
      const windowMinutes = branch?.duplicateWindowMinutes ?? 10;
      const lastRecord = await fetchLastAttendanceRecord(employeeId);
      const decision = decideAttendanceMarkType(lastRecord, windowMinutes);

      if ("error" in decision) {
        throw new Error(decision.error);
      }

      const recordType = decision.type;

      setStatusMsg(getClientDeviceClass() === "mobile" ? "Obteniendo ubicación..." : "Registrando asistencia...");
      const location = await getBrowserLocationIfMobile();
      const deviceClass = getClientDeviceClass();

      setStatusMsg("Registrando asistencia...");

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          branchId,
          type: recordType,
          confidenceScore: "distance" in matchedEmp ? Math.max(0, 1 - matchedEmp.distance) : 1,
          livenessScore: liveness.confidence,
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
    }
  }, [phase, branchId, branches]);

  function reset() {
    stopEverything();
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setStatusMsg("");
    setCountdown(10);
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
        <canvas ref={canvasRef} className="hidden" />

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
                 registered.length === 0 ? "Sin empleados registrados" :
                 !faceVisible ? "Acérquese a la cámara..." :
                 "Identificando..."}
              </div>
            </div>

            {/* Bottom info */}
            {faceVisible && registered.length > 0 && branchId && (
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-950/90 to-transparent">
                <div className="max-w-sm mx-auto text-center">
                  <div className="flex items-center justify-center gap-2 text-white/70 text-xs">
                    <Wifi className="w-3 h-3 text-green-400" />
                    <span>Reconocimiento facial activo — se identificará automáticamente</span>
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
