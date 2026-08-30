"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Scan, CheckCircle2, XCircle, RotateCcw, AlertCircle,
  Wifi, WifiOff, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { cn, getInitials, sleep } from "@/lib/utils";
import {
  loadModels,
  detectFaceConsensus,
  captureManualTemplate,
  findDuplicateEnrollment,
  findBestMatch,
  isConfidentMatch,
  isModelsLoaded,
  keepFacesWithDescriptor,
  type FacePresence,
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

interface EmployeeMini {
  id: string;
  fullName: string;
  position?: string | null;
  branchId?: string | null;
  photo?: string | null;
  faceRegistered: boolean;
  faceRegisteredAt?: string | null;
}

interface RegisteredFace {
  employeeId: string;
  fullName: string;
  position?: string | null;
  branchId?: string | null;
  photo?: string | null;
  descriptor: number[] | null;
}

type AttendanceMarkType = "CHECK_IN" | "CHECK_OUT";

interface BranchMini {
  id: string;
  name: string;
  duplicateWindowMinutes: number;
}

interface FaceSearchMatch {
  employeeId: string;
  fullName: string;
  position?: string | null;
  branchId?: string | null;
  photo?: string | null;
  distance: number;
}

type FaceSearchOutcome =
  | { status: "match"; match: FaceSearchMatch }
  | { status: "ambiguous" }
  | { status: "weak"; distance?: number }
  | { status: "empty" }
  | { status: "none"; distance?: number }
  | { status: "error" };

async function searchFaceInDatabase(descriptor: number[]): Promise<FaceSearchOutcome> {
  try {
    const response = await fetch("/api/face/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptor }),
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

type Phase = "loading_models" | "idle" | "processing" | "success" | "error";

function FacialRegistrationContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const employeeId    = searchParams.get("employeeId");

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const registeredFacesRef = useRef<RegisteredFace[]>([]);
  const faceMatchThresholdRef = useRef(DEFAULT_FACE_MATCH_THRESHOLD);
  const branchesRef = useRef<BranchMini[]>([]);
  const processingRef = useRef(false);
  const stableHitsRef = useRef(0);
  const softRetryUntilRef = useRef(0);
  const employeeRef = useRef<EmployeeMini | null>(null);
  const phaseRef = useRef<Phase>("loading_models");
  const lastPresenceRef = useRef<FacePresence | null>(null);

  const [employee, setEmployee]       = useState<EmployeeMini | null>(null);
  const [automaticMode, setAutomaticMode] = useState(!employeeId);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState("");
  const [phase, setPhase]               = useState<Phase>("loading_models");
  const [faceDetected, setFaceDetected] = useState(false);
  const [progress, setProgress]         = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]           = useState("");
  const [registeredFaceCount, setRegisteredFaceCount] = useState<number | null>(null);
  const [scanMessage, setScanMessage] = useState("Inicializando reconocimiento...");
  const [attendanceType, setAttendanceType] = useState<AttendanceMarkType | null>(null);
  const [resetCountdown, setResetCountdown] = useState(0);

  employeeRef.current = employee;
  phaseRef.current = phase;

  // ── Load employee or registered faces for automatic mode ──────────────────
  useEffect(() => {
    fetch("/api/branches?pageSize=100")
      .then(r => r.json())
      .then((d: { data?: BranchMini[] }) => {
        branchesRef.current = d.data ?? [];
      })
      .catch(() => { branchesRef.current = []; });

    if (!employeeId) {
      setAutomaticMode(true);
      fetch("/api/face/descriptors")
        .then(r => r.json())
        .then(async (d: { data?: RegisteredFace[]; faceMatchThreshold?: number }) => {
          setScanMessage("Preparando rostros registrados...");
          if (typeof d.faceMatchThreshold === "number") {
            faceMatchThresholdRef.current = d.faceMatchThreshold;
          }
          const faces = keepFacesWithDescriptor(d.data ?? []);
          registeredFacesRef.current = faces;
          setRegisteredFaceCount(faces.length);
          setScanMessage(
            faces.length > 0
              ? `Listo para identificar ${faces.length} rostro${faces.length === 1 ? "" : "s"}`
              : "No hay rostros entrenados todavía"
          );
        })
        .catch(() => toast.error("Error al cargar rostros registrados"));
      return;
    }

    setAutomaticMode(false);
    // Load employee data
    fetch(`/api/employees?pageSize=200&status=ACTIVE`)
      .then(r => r.json())
      .then((d: { data?: EmployeeMini[] }) => {
        const found = (d.data ?? []).find(e => e.id === employeeId);
        if (!found) {
          toast.error("Empleado no encontrado");
          router.replace("/employees");
          return;
        }
        setEmployee(found);
      })
      .catch(() => toast.error("Error al cargar empleado"));
  }, [employeeId, router]);

  // ── Load MediaPipe + ArcFace ──────────────────────────────────────────────
  useEffect(() => {
    loadModels()
      .then(() => {
        setPhase("idle");
        setScanMessage("Modelos cargados. Activando cámara...");
        startCamera();
      })
      .catch((err) => {
        console.error("Model load failed:", err);
        setErrorMsg("No se pudieron cargar los modelos de reconocimiento facial");
        setPhase("error");
      });
    return () => { stopCamera(); stopDetectionLoop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detection loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (cameraActive && phase === "idle" && isModelsLoaded()) {
      startDetectionLoop();
    } else {
      stopDetectionLoop();
    }
    return () => stopDetectionLoop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, phase, employee]);

  // After success or error (p.ej. "Entrada reciente, espere X minutos"),
  // return to scanning mode automatically.
  useEffect(() => {
    if (phase !== "success" && phase !== "error") return;

    const delayMs = phase === "error" ? 10_000 : 2500;
    setResetCountdown(Math.ceil(delayMs / 1000));

    const interval = setInterval(() => {
      setResetCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    const timeout = setTimeout(() => resetAll(), delayMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraActive(true);
          setScanMessage(automaticMode ? "Sin rostro a la vista. Mire de frente" : "Coloque el rostro en el óvalo");
        };
      }
    } catch {
      setCameraError("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
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
        lastPresenceRef.current = presence;
        setFaceDetected(presence.detected);

        if (!presence.detected) {
          stableHitsRef.current = 0;
          setScanMessage("Sin rostro a la vista. Mire de frente");
          return;
        }

        stableHitsRef.current += 1;
        const hits = stableHitsRef.current;
        if (hits < FACE_STABLE_HITS) {
          setScanMessage(`Rostro detectado — mantenga la posición (${hits}/${FACE_STABLE_HITS})`);
          return;
        }

        const currentEmployee = employeeRef.current;
        if (currentEmployee) {
          setScanMessage("Posición estable. Capturando...");
          void triggerCapture(currentEmployee);
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        setScanMessage("Confirmando rostro...");
        const detection = await detectFaceConsensus(video);
        const descriptor = detection.descriptor;
        if (!descriptor) {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          setScanMessage("Acerque la cara y mire de frente");
          return;
        }

        setScanMessage("Buscando identidad...");
        const serverOutcome = await searchFaceInDatabase(descriptor);
        let matched: RegisteredFace | FaceSearchMatch | null = null;

        if (serverOutcome.status === "ambiguous") {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          setScanMessage("Rostro ambiguo — mire de frente e intente de nuevo");
          return;
        }

        if (serverOutcome.status === "empty") {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          setScanMessage("No hay rostros enrolados para comparar");
          return;
        }

        if (serverOutcome.status === "weak") {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          const dist =
            serverOutcome.distance != null
              ? ` (${serverOutcome.distance.toFixed(2)})`
              : "";
          setScanMessage(`Coincidencia débil${dist} — acerque la cara e intente de nuevo`);
          return;
        }

        if (serverOutcome.status === "match") {
          matched = serverOutcome.match;
        } else if (serverOutcome.status === "error") {
          const threshold = faceMatchThresholdRef.current;
          const match = findBestMatch(
            descriptor,
            registeredFacesRef.current.map((e) => ({
              employeeId: e.employeeId,
              descriptor: e.descriptor as number[],
            })),
            threshold
          );

          if (match?.ambiguous) {
            stableHitsRef.current = 0;
            setScanMessage("Rostro ambiguo — mire de frente e intente de nuevo");
            return;
          }

          if (!isConfidentMatch(match, threshold) || !match) {
            stableHitsRef.current = 0;
            setScanMessage(match ? `Sin coincidencia (${match.distance.toFixed(2)})` : "Sin coincidencia");
            return;
          }

          matched = registeredFacesRef.current.find((e) => e.employeeId === match.employeeId) ?? null;
        } else {
          stableHitsRef.current = 0;
          softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
          const dist =
            serverOutcome.status === "none" && serverOutcome.distance != null
              ? ` (${serverOutcome.distance.toFixed(2)})`
              : "";
          setScanMessage(`Sin coincidencia${dist}`);
          return;
        }

        if (!matched) {
          stableHitsRef.current = 0;
          return;
        }
        setScanMessage(`Identificado: ${matched.fullName}`);

        const target: EmployeeMini = {
          id: matched.employeeId,
          fullName: matched.fullName,
          position: matched.position,
          branchId: matched.branchId,
          photo: matched.photo,
          faceRegistered: true,
        };
        setEmployee(target);
        void triggerCapture(target);
      },
    });
  }

  function stopDetectionLoop() {
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    setFaceDetected(false);
  }

  function captureFrame(): string | null {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function createAttendanceRecord(activeEmployee: EmployeeMini) {
    if (!activeEmployee.branchId) {
      throw new Error("El empleado no tiene sucursal asociada para registrar asistencia");
    }

    const branch = branchesRef.current.find((b) => b.id === activeEmployee.branchId);
    const windowMinutes = branch?.duplicateWindowMinutes ?? 10;

    // GPS en paralelo con la última marcación: no sumar su latencia al flujo.
    const locationPromise = getBrowserLocationIfMobile();
    const lastRecord = await fetchLastAttendanceRecord(activeEmployee.id);
    const decision = decideAttendanceMarkType(lastRecord, windowMinutes);

    if ("error" in decision) {
      throw new Error(decision.error);
    }

    const location = await locationPromise;
    const deviceClass = getClientDeviceClass();

    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: activeEmployee.id,
        branchId: activeEmployee.branchId,
          type: decision.type,
          confidenceScore: 0.92,
          validationStatus: "SUCCESS" as const,
        isManual: false,
        deviceClass,
        ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? "Error al registrar marcación");
    }

    const data = await res.json() as { type?: AttendanceMarkType };
    return data.type ?? decision.type;
  }

  const resumeSoftRetry = useCallback((message: string) => {
    processingRef.current = false;
    stableHitsRef.current = 0;
    softRetryUntilRef.current = Date.now() + FACE_SOFT_RETRY_COOLDOWN_MS;
    setProgress(0);
    setProgressLabel("");
    setCapturedPhoto(null);
    setErrorMsg("");
    setScanMessage(message);
    setPhase("idle");
    // Cámara sigue activa: el loop de detección se reanuda solo.
  }, []);

  const triggerCapture = useCallback(async (targetEmployee?: EmployeeMini) => {
    const activeEmployee = targetEmployee ?? employee;
    if (!activeEmployee || phase !== "idle" || processingRef.current) return;
    processingRef.current = true;
    setPhase("processing");
    stopDetectionLoop();

    const photo = captureFrame();
    setCapturedPhoto(photo);
    // No apagar la cámara: si falla por acomodo, seguimos intentando.

    setProgress(10);
    setProgressLabel("Detectando rostro...");
    await sleep(200);

    const video = videoRef.current;
    const isAttendancePath = automaticMode && !employeeId;
    setProgress(25);
    setProgressLabel(
      isAttendancePath ? "Extrayendo descriptor facial..." : "Capturando rostro frontal..."
    );

    // En marcación el descriptor solo confirma que hay cara: una muestra basta.
    // En enrolamiento se captura una plantilla frontal con gates de calidad.
    let descriptor: number[] | null = null;
    let templates: number[][] | null = null;
    if (video) {
      if (isAttendancePath) {
        descriptor = (await detectFaceConsensus(video)).descriptor;
      } else {
        const capture = await captureManualTemplate(video, null);
        descriptor = capture.descriptor;
        templates = capture.descriptor ? [capture.descriptor] : null;
      }
    }
    if (!descriptor) {
      resumeSoftRetry("Acomode el rostro en el óvalo — seguimos intentando...");
      return;
    }

    if (!isAttendancePath) {
      setProgress(60);
      setProgressLabel("Verificando duplicados...");
      const duplicate = await findDuplicateEnrollment(
        descriptor,
        activeEmployee.id
      );
      if (duplicate) {
        processingRef.current = false;
        stopCamera();
        setErrorMsg(
          `Este rostro ya está registrado como ${duplicate.fullName}. Inactive el duplicado o use su propio registro.`
        );
        setPhase("error");
        return;
      }
    }

    if (automaticMode && !employeeId) {
      setProgress(75);
      setProgressLabel("Registrando asistencia...");
      try {
        const markType = await createAttendanceRecord(activeEmployee);
        setAttendanceType(markType);
        setProgress(100);
        setProgressLabel(markType === "CHECK_IN" ? "Entrada registrada" : "Salida registrada");
        await sleep(400);
        setEmployee(activeEmployee);
        stopCamera();
        setPhase("success");
        toast.success(`${markType === "CHECK_IN" ? "Entrada" : "Salida"} registrada: ${activeEmployee.fullName}`);
      } catch (err) {
        stopCamera();
        setErrorMsg(err instanceof Error ? err.message : "Error al registrar asistencia");
        setPhase("error");
      } finally {
        processingRef.current = false;
      }
      return;
    }

    // Step 3: Save embedding + photo to DB
    setProgress(75);
    setProgressLabel("Guardando plantillas biométricas...");
    try {
      const res = await fetch(`/api/employees/${activeEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceRegistered: true,
          faceRegisteredAt: new Date().toISOString(),
          biometricConsentAt: new Date().toISOString(),
          faceEmbedding: descriptor,
          ...(templates ? { faceTemplates: templates } : {}),
          ...(photo ? { photo } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Error al guardar el registro facial");
      }

      setProgress(100);
      setProgressLabel("Registro completado");
      await sleep(400);
      setEmployee(prev => prev ? { ...prev, faceRegistered: true, photo: photo ?? prev.photo } : activeEmployee);
      stopCamera();
      setPhase("success");
      toast.success(`Rostro de ${activeEmployee.fullName} registrado correctamente`);
    } catch (err) {
      stopCamera();
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
      setPhase("error");
    } finally {
      processingRef.current = false;
    }
  }, [automaticMode, employee, employeeId, phase, resumeSoftRetry]);

  function resetAll() {
    setPhase("idle");
    setProgress(0);
    setProgressLabel("");
    setCapturedPhoto(null);
    setErrorMsg("");
    setAttendanceType(null);
    setResetCountdown(0);
    setEmployee(employeeId ? employee : null);
    processingRef.current = false;
    stableHitsRef.current = 0;
    softRetryUntilRef.current = 0;
    setScanMessage(automaticMode ? "Buscando rostro..." : "Coloque el rostro en el óvalo");
    stopDetectionLoop();
    startCamera();
  }

  const employeeStatusText = automaticMode
    ? "Marcación de asistencia"
    : employee?.faceRegistered
      ? "Re-registro — se sobreescribirá el rostro existente"
      : "Primer registro facial";

  return (
    <div className="space-y-4">
      {/* Header with employee info + back */}
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Registro Facial"
          description={employee
            ? `Registrando rostro de ${employee.fullName}`
            : automaticMode
              ? "Coloque el rostro frente a la cámara para identificarlo automáticamente"
              : "Cargando empleado..."}
        />
        <Button variant="outline" size="sm" onClick={() => router.push("/employees")}>
          <ArrowLeft className="w-4 h-4 mr-2" />Volver
        </Button>
      </div>

        {/* Employee banner */}
      {employee && (
        <Card className="bg-muted/30">
          <CardContent className="p-3 flex items-center gap-3">
            <Avatar className="w-12 h-12">
              {employee.photo && <AvatarImage src={employee.photo} alt={employee.fullName} />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getInitials(employee.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-sm">{employee.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {employeeStatusText}
              </p>
            </div>
            {employee.faceRegistered && (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
          </CardContent>
        </Card>
      )}

      {automaticMode && registeredFaceCount === 0 && phase === "idle" && (
        <Card className="border-yellow-500/30 bg-yellow-500/10 max-w-2xl mx-auto">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-yellow-700 dark:text-yellow-300">No hay rostros entrenados</p>
              <p className="text-xs text-muted-foreground">
                Para que el modo automático reconozca una persona, primero debe existir al menos una foto o embedding facial.
                Si hay foto del empleado, el sistema genera el embedding automáticamente desde el navegador y lo guarda.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Camera viewport */}
      <div className="relative bg-black rounded-2xl overflow-hidden mx-auto" style={{ aspectRatio: "4/3", maxHeight: "480px", width: "100%", maxWidth: "640px" }}>

        {/* Loading models */}
        {phase === "loading_models" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-white/70 text-sm">Cargando modelos de IA...</p>
          </div>
        )}

        {/* Live video */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn("w-full h-full object-cover", (phase === "processing" || phase === "success" || phase === "error" || phase === "loading_models") && "hidden")}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Captured frame */}
        {capturedPhoto && (phase === "processing" || phase === "success") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedPhoto} alt="Captura" className="w-full h-full object-cover" />
        )}

        {/* Camera error */}
        {cameraError && phase !== "loading_models" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4">
            <WifiOff className="w-12 h-12 text-red-400" />
            <p className="text-white text-sm text-center px-4">{cameraError}</p>
            <Button onClick={startCamera} variant="outline">Reintentar</Button>
          </div>
        )}

        {/* Idle — oval guide */}
        {phase === "idle" && cameraActive && !cameraError && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={cn(
                "w-44 h-56 border-4 rounded-full transition-colors duration-500",
                faceDetected ? "border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.5)]" : "border-white/30"
              )} style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }} />
            </div>

            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                <div className={cn("w-2 h-2 rounded-full animate-pulse", faceDetected ? "bg-green-400" : "bg-yellow-400")} />
                <span className="text-white text-xs font-medium">
                  {scanMessage}
                </span>
              </div>
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-white text-xs">En vivo</span>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-white/70 text-xs text-center">
                {automaticMode
                  ? registeredFaceCount == null
                    ? "Modo automático • cargando rostros registrados..."
                    : registeredFaceCount > 0
                      ? `Modo automático • ${registeredFaceCount} rostro${registeredFaceCount === 1 ? "" : "s"} entrenado${registeredFaceCount === 1 ? "" : "s"}`
                      : "Modo automático • sin rostros entrenados para comparar"
                  : "Coloque su rostro en el óvalo • Mantenga la posición unos segundos"}
              </p>
            </div>
          </>
        )}

        {/* Processing */}
        {phase === "processing" && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 p-6">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center animate-pulse-slow">
              <Scan className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">Procesando biometría...</p>
              <p className="text-white/60 text-xs mt-1">{progressLabel}</p>
            </div>
            <div className="w-full max-w-xs space-y-1">
              <div className="flex justify-between text-xs text-white/70">
                <span>Progreso</span><span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        )}

        {/* Success */}
        {phase === "success" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
            <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.5)]">
              {(employee?.photo || capturedPhoto) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={employee?.photo ?? capturedPhoto ?? ""} alt={employee?.fullName ?? ""} className="w-full h-full object-cover" />
              )}
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-white text-lg font-bold">
              {attendanceType ? (attendanceType === "CHECK_IN" ? "¡Entrada registrada!" : "¡Salida registrada!") : "¡Registrado!"}
            </p>
            <p className="text-green-200 text-sm">{employee?.fullName}</p>
            {attendanceType && (
              <p className="text-green-100/70 text-xs">
                {new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <p className="text-green-100/50 text-xs mt-1">
              Preparando siguiente escaneo{resetCountdown > 0 ? ` (${resetCountdown}s)` : "..."}
            </p>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center gap-3">
            <XCircle className="w-16 h-16 text-red-400" />
            <p className="text-white font-semibold">Error al registrar</p>
            <p className="text-red-200 text-xs text-center px-4">{errorMsg}</p>
            <p className="text-red-100/60 text-xs mt-1">
              Volviendo a escanear en {resetCountdown}s...
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {(phase === "success" || phase === "error") && (
        <div className="flex justify-center max-w-md mx-auto">
          <Button onClick={resetAll} className="min-w-56">
            <RotateCcw className="w-4 h-4 mr-2" />
            {phase === "error"
              ? `Escanear otro (${resetCountdown}s)`
              : "Registrar otro"}
          </Button>
        </div>
      )}

    </div>
  );
}

export default function FacialRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <FacialRegistrationContent />
    </Suspense>
  );
}
