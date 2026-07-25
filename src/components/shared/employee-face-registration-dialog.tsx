"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, RotateCcw, Scan, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { detectFace, isModelsLoaded, loadModels } from "@/lib/ai/face-api-service";
import { checkLiveness } from "@/lib/ai/openrouter-service";
import { cn, getInitials, sleep } from "@/lib/utils";

export interface FaceRegistrationEmployee {
  id: string;
  fullName: string;
  photo?: string | null;
  faceRegistered: boolean;
}

interface Props {
  open: boolean;
  employee: FaceRegistrationEmployee | null;
  onClose: () => void;
  onSuccess: (result: { employeeId: string; photo: string | null }) => void;
}

type Phase = "loading_models" | "idle" | "processing" | "success" | "error";

const STABLE_HITS_REQUIRED = 3;
const SOFT_RETRY_COOLDOWN_MS = 900;

export function EmployeeFaceRegistrationDialog({
  open,
  employee,
  onClose,
  onSuccess,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);
  const stableHitsRef = useRef(0);
  const softRetryUntilRef = useRef(0);
  const employeeRef = useRef(employee);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [phase, setPhase] = useState<Phase>("loading_models");
  const [faceDetected, setFaceDetected] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [livenessMsg, setLivenessMsg] = useState("");
  const [scanMessage, setScanMessage] = useState("Inicializando reconocimiento...");

  employeeRef.current = employee;

  function stopDetectionLoop() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setFaceDetected(false);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function cleanup() {
    stopDetectionLoop();
    stopCamera();
    processingRef.current = false;
    stableHitsRef.current = 0;
    softRetryUntilRef.current = 0;
  }

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
          setScanMessage("Coloque el rostro en el óvalo");
        };
      }
    } catch {
      setCameraError("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
    }
  }

  function captureFrame(): string | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  const resumeSoftRetry = useCallback((message: string) => {
    processingRef.current = false;
    stableHitsRef.current = 0;
    softRetryUntilRef.current = Date.now() + SOFT_RETRY_COOLDOWN_MS;
    setProgress(0);
    setProgressLabel("");
    setCapturedPhoto(null);
    setLivenessMsg("");
    setErrorMsg("");
    setScanMessage(message);
    setPhase("idle");
  }, []);

  const triggerCapture = useCallback(async () => {
    const activeEmployee = employeeRef.current;
    if (!activeEmployee || processingRef.current) return;
    processingRef.current = true;
    setPhase("processing");
    stopDetectionLoop();

    const photo = captureFrame();
    setCapturedPhoto(photo);

    setProgress(10);
    setProgressLabel("Detectando rostro...");
    await sleep(300);

    const tempImg = new Image();
    if (photo) tempImg.src = photo;
    await new Promise((r) => {
      tempImg.onload = r;
      tempImg.onerror = r;
    });

    setProgress(25);
    setProgressLabel("Extrayendo descriptor facial...");
    const detection = await detectFace(tempImg);
    if (!detection.detected || !detection.descriptor) {
      resumeSoftRetry("Acomode el rostro en el óvalo — seguimos intentando...");
      return;
    }

    setProgress(50);
    setProgressLabel("Verificando prueba de vida...");
    const liveness = await checkLiveness(photo ?? "");
    setLivenessMsg(liveness.reason);

    if (!liveness.faceDetected) {
      resumeSoftRetry("No se ve bien el rostro. Acomode la cámara — reintentando...");
      return;
    }
    if (!liveness.isRealPerson || !liveness.antiSpoofingPassed) {
      resumeSoftRetry(`Ajuste iluminación/ángulo (${liveness.reason}) — reintentando...`);
      return;
    }

    setProgress(75);
    setProgressLabel("Guardando plantilla biométrica...");
    try {
      const res = await fetch(`/api/employees/${activeEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceRegistered: true,
          faceRegisteredAt: new Date().toISOString(),
          biometricConsentAt: new Date().toISOString(),
          faceEmbedding: detection.descriptor,
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
      stopCamera();
      setPhase("success");
      toast.success(`Rostro de ${activeEmployee.fullName} registrado correctamente`);
      onSuccess({ employeeId: activeEmployee.id, photo });
    } catch (err) {
      stopCamera();
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
      setPhase("error");
    } finally {
      processingRef.current = false;
    }
  }, [onSuccess, resumeSoftRetry]);

  const startDetectionLoop = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      if (processingRef.current) return;
      if (Date.now() < softRetryUntilRef.current) return;

      try {
        const result = await detectFace(video);
        setFaceDetected(result.detected);

        if (!result.detected || !result.descriptor) {
          stableHitsRef.current = 0;
          setScanMessage("Buscando rostro... Acomode la cámara y mire de frente");
          return;
        }

        stableHitsRef.current += 1;
        const hits = stableHitsRef.current;
        if (hits < STABLE_HITS_REQUIRED) {
          setScanMessage(`Rostro detectado — mantenga la posición (${hits}/${STABLE_HITS_REQUIRED})`);
          return;
        }

        setScanMessage("Posición estable. Capturando...");
        void triggerCapture();
      } catch (err) {
        console.error("Face detection failed:", err);
        stableHitsRef.current = 0;
        setScanMessage("Error detectando rostro. Reintentando...");
      }
    }, 800);
  }, [triggerCapture]);

  // Boot / teardown when dialog opens or closes
  useEffect(() => {
    if (!open || !employee) {
      cleanup();
      setPhase("loading_models");
      setCameraError("");
      setProgress(0);
      setProgressLabel("");
      setCapturedPhoto(null);
      setErrorMsg("");
      setLivenessMsg("");
      setScanMessage("Inicializando reconocimiento...");
      return;
    }

    let cancelled = false;
    setPhase("loading_models");
    setScanMessage("Cargando modelos...");
    loadModels()
      .then(() => {
        if (cancelled) return;
        setPhase("idle");
        setScanMessage("Modelos cargados. Activando cámara...");
        void startCamera();
      })
      .catch((err) => {
        console.error("Model load failed:", err);
        if (cancelled) return;
        setErrorMsg("No se pudieron cargar los modelos de reconocimiento facial");
        setPhase("error");
      });

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  useEffect(() => {
    if (open && cameraActive && phase === "idle" && isModelsLoaded()) {
      startDetectionLoop();
    } else {
      stopDetectionLoop();
    }
    return () => stopDetectionLoop();
  }, [open, cameraActive, phase, startDetectionLoop]);

  function handleClose() {
    cleanup();
    onClose();
  }

  function retryHardError() {
    setPhase("idle");
    setProgress(0);
    setProgressLabel("");
    setCapturedPhoto(null);
    setErrorMsg("");
    setLivenessMsg("");
    processingRef.current = false;
    stableHitsRef.current = 0;
    softRetryUntilRef.current = 0;
    setScanMessage("Coloque el rostro en el óvalo");
    stopDetectionLoop();
    void startCamera();
  }

  const statusText = employee?.faceRegistered
    ? "Re-registro — se sobreescribirá el rostro existente"
    : "Primer registro facial";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Registro facial</DialogTitle>
        </DialogHeader>

        {employee && (
          <div className="px-5 pb-3 flex items-center gap-3">
            <Avatar className="w-11 h-11">
              {employee.photo && <AvatarImage src={employee.photo} alt={employee.fullName} />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getInitials(employee.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{employee.fullName}</p>
              <p className="text-xs text-muted-foreground">{statusText}</p>
            </div>
            {employee.faceRegistered && (
              <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
            )}
          </div>
        )}

        <div
          className="relative bg-black overflow-hidden mx-auto w-full"
          style={{ aspectRatio: "4/3", maxHeight: "420px" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "absolute inset-0 w-full h-full object-cover scale-x-[-1]",
              phase !== "idle" && "opacity-40"
            )}
          />
          <canvas ref={canvasRef} className="hidden" />

          {phase === "idle" && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={cn(
                  "w-[52%] h-[68%] rounded-[50%] border-2 transition-colors",
                  faceDetected ? "border-green-400 shadow-[0_0_24px_rgba(74,222,128,0.35)]" : "border-white/50"
                )}
              />
            </div>
          )}

          {phase === "loading_models" && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-white/80 text-sm">{scanMessage}</p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <XCircle className="w-12 h-12 text-red-400" />
              <p className="text-white text-sm">{cameraError}</p>
              <Button variant="secondary" size="sm" onClick={() => void startCamera()}>
                Reintentar cámara
              </Button>
            </div>
          )}

          {phase === "idle" && !cameraError && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
              <p className="text-white text-sm font-medium">{scanMessage}</p>
              <p className="text-white/60 text-xs mt-1">
                Mantenga la posición unos segundos
              </p>
            </div>
          )}

          {phase === "processing" && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-14 h-14 rounded-full bg-primary/80 flex items-center justify-center animate-pulse">
                <Scan className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Procesando biometría...</p>
                <p className="text-white/60 text-xs mt-1">{progressLabel}</p>
                {livenessMsg && (
                  <p className="text-white/40 text-xs mt-2 italic">{livenessMsg}</p>
                )}
              </div>
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-xs text-white/70">
                  <span>Progreso</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-green-400">
                {(employee?.photo || capturedPhoto) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={capturedPhoto ?? employee?.photo ?? ""}
                    alt={employee?.fullName ?? ""}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-white text-lg font-bold">¡Registrado!</p>
              <p className="text-green-200 text-sm">{employee?.fullName}</p>
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center gap-3 p-4">
              <XCircle className="w-14 h-14 text-red-400" />
              <p className="text-white font-semibold">Error al registrar</p>
              <p className="text-red-200 text-xs text-center px-2">{errorMsg}</p>
            </div>
          )}
        </div>

        <div className="p-4 flex justify-end gap-2">
          {phase === "success" ? (
            <Button onClick={handleClose}>Listo</Button>
          ) : phase === "error" ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              <Button onClick={retryHardError}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose} disabled={phase === "processing"}>
              Cancelar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
