"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowRight, Camera, CheckCircle2, RotateCcw, Scan, SkipForward, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  captureManualTemplate,
  findDuplicateEnrollment,
  isModelsLoaded,
  loadModels,
} from "@/lib/ai/face-api-service";
import { startFacePresenceLoop } from "@/lib/ai/face-detection-loop";
import { cn, getInitials } from "@/lib/utils";
import type { ExpectedTurn } from "@/lib/ai/face-quality";

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

const STEPS: Array<{ key: string; label: string; hint: string; turn: ExpectedTurn }> = [
  { key: "frontal", label: "Frente", hint: "Mire de frente a la cámara", turn: null },
  { key: "left", label: "Izquierda", hint: "Gire levemente el rostro a su izquierda", turn: "left" },
  { key: "right", label: "Derecha", hint: "Gire levemente el rostro a su derecha", turn: "right" },
];

interface CaptureSlot {
  photo: string | null;
  descriptor: number[];
}

type Phase = "loading_models" | "idle" | "capturing" | "saving" | "success" | "error";

export function EmployeeFaceRegistrationDialog({
  open,
  employee,
  onClose,
  onSuccess,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const processingRef = useRef(false);
  const employeeRef = useRef(employee);
  const stepIndexRef = useRef(0);
  const capturesRef = useRef<Array<CaptureSlot | null>>([]);
  const phaseRef = useRef<Phase>("loading_models");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [phase, setPhase] = useState<Phase>("loading_models");
  const [faceDetected, setFaceDetected] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<Array<CaptureSlot | null>>([null, null, null]);
  const [captureMsg, setCaptureMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  employeeRef.current = employee;
  capturesRef.current = captures;
  stepIndexRef.current = stepIndex;
  phaseRef.current = phase;

  function stopDetectionLoop() {
    stopLoopRef.current?.();
    stopLoopRef.current = null;
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
  }

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraActive(true);
      }
    } catch {
      setCameraError("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
    }
  }

  function captureFrame(): string | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  const startPresenceLoop = useCallback(() => {
    if (stopLoopRef.current) return;
    stopLoopRef.current = startFacePresenceLoop({
      getVideo: () => videoRef.current,
      shouldRun: () => phaseRef.current === "idle" && !processingRef.current,
      onTick: (presence) => setFaceDetected(presence.detected),
    });
  }, []);

  const captureStep = useCallback(async () => {
    if (processingRef.current) return;
    const idx = stepIndexRef.current;
    const step = STEPS[idx];
    processingRef.current = true;
    setPhase("capturing");
    setCaptureMsg(`Capturando ${step.label.toLowerCase()}...`);

    const video = videoRef.current;
    const result = video
      ? await captureManualTemplate(video, step.turn)
      : { descriptor: null as number[] | null, issue: "Cámara no disponible" };

    if (!result.descriptor) {
      processingRef.current = false;
      setCaptureMsg(result.issue ?? "No se pudo capturar el rostro. Intente de nuevo.");
      setPhase("idle");
      return;
    }

    const photo = captureFrame();
    setCaptures((prev) => {
      const next = [...prev];
      next[idx] = { photo, descriptor: result.descriptor as number[] };
      return next;
    });
    processingRef.current = false;
    setCaptureMsg("");
    setPhase("idle");
    if (idx < 2) setStepIndex(idx + 1);
  }, []);

  const repeatStep = useCallback(() => {
    const idx = stepIndexRef.current;
    setCaptures((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    setCaptureMsg("");
  }, []);

  const skipStep = useCallback(() => {
    if (stepIndexRef.current < 2) setStepIndex(stepIndexRef.current + 1);
  }, []);

  const save = useCallback(async () => {
    const activeEmployee = employeeRef.current;
    const frontal = capturesRef.current[0];
    if (!activeEmployee || !frontal?.descriptor || processingRef.current) return;

    processingRef.current = true;
    setPhase("saving");
    setCaptureMsg("Verificando duplicados...");
    const duplicate = await findDuplicateEnrollment(
      frontal.descriptor,
      activeEmployee.id
    );
    if (duplicate) {
      processingRef.current = false;
      setErrorMsg(
        `Este rostro ya está registrado como ${duplicate.fullName}. Inactive el duplicado o use su propio registro.`
      );
      setPhase("error");
      return;
    }

    const templates = capturesRef.current
      .filter((slot): slot is CaptureSlot => Boolean(slot))
      .map((slot) => slot.descriptor);

    setCaptureMsg("Guardando plantillas biométricas...");
    try {
      const res = await fetch(`/api/employees/${activeEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceRegistered: true,
          faceRegisteredAt: new Date().toISOString(),
          biometricConsentAt: new Date().toISOString(),
          faceEmbedding: frontal.descriptor,
          faceTemplates: templates,
          ...(frontal.photo ? { photo: frontal.photo } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Error al guardar el registro facial");
      }

      stopCamera();
      setPhase("success");
      toast.success(`Rostro de ${activeEmployee.fullName} registrado correctamente`);
      onSuccess({ employeeId: activeEmployee.id, photo: frontal.photo });
    } catch (err) {
      stopCamera();
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
      setPhase("error");
    } finally {
      processingRef.current = false;
    }
  }, [onSuccess]);

  // Boot / teardown
  useEffect(() => {
    if (!open || !employee) {
      cleanup();
      setPhase("loading_models");
      setCameraError("");
      setCaptureMsg("");
      setErrorMsg("");
      setCaptures([null, null, null]);
      setStepIndex(0);
      return;
    }

    let cancelled = false;
    setPhase("loading_models");
    setCaptures([null, null, null]);
    setStepIndex(0);
    loadModels()
      .then(() => {
        if (cancelled) return;
        setPhase("idle");
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
      startPresenceLoop();
    } else {
      stopDetectionLoop();
    }
    return () => stopDetectionLoop();
  }, [open, cameraActive, phase, startPresenceLoop]);

  function handleClose() {
    cleanup();
    onClose();
  }

  function retryHardError() {
    setPhase("idle");
    setCaptureMsg("");
    setErrorMsg("");
    setCaptures([null, null, null]);
    setStepIndex(0);
    processingRef.current = false;
    stopDetectionLoop();
    void startCamera();
  }

  const statusText = employee?.faceRegistered
    ? "Re-registro — se sobreescribirá el rostro existente"
    : "Primer registro facial";

  const frontalDone = Boolean(captures[0]?.descriptor);
  const currentStep = STEPS[stepIndex];

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

        {/* Stepper */}
        <div className="px-5 pb-3 flex items-center gap-2">
          {STEPS.map((step, i) => {
            const done = Boolean(captures[i]?.descriptor);
            const active = i === stepIndex && phase === "idle";
            return (
              <div key={step.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border",
                    done
                      ? "bg-green-500/10 border-green-500 text-green-600 dark:text-green-400"
                      : active
                        ? "bg-primary/10 border-primary text-primary font-medium"
                        : "bg-muted/40 border-border text-muted-foreground"
                  )}
                >
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : (
                    <span className="w-3.5 h-3.5 rounded-full border border-current text-[10px] flex items-center justify-center">
                      {i + 1}
                    </span>
                  )}
                  {step.label}
                </div>
                {i < 2 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <div className="relative bg-black overflow-hidden mx-auto w-full" style={{ aspectRatio: "4/3", maxHeight: "380px" }}>
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
              <p className="text-white/80 text-sm">Cargando modelos de IA...</p>
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

          {(phase === "idle" || phase === "capturing") && !cameraError && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
              <p className="text-white text-sm font-medium">
                {phase === "capturing"
                  ? captureMsg
                  : `${stepIndex + 1}/3 · ${currentStep.hint}`}
              </p>
            </div>
          )}

          {phase === "saving" && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-14 h-14 rounded-full bg-primary/80 flex items-center justify-center animate-pulse">
                <Scan className="w-7 h-7 text-white" />
              </div>
              <p className="text-white text-sm">{captureMsg}</p>
            </div>
          )}

          {phase === "success" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
              <div className="w-24 h-24 rounded-full border-4 border-green-400 overflow-hidden">
                {(captures[0]?.photo || employee?.photo) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={captures[0]?.photo ?? employee?.photo ?? ""}
                    alt={employee?.fullName ?? ""}
                    className="w-full h-full object-cover"
                  />
                )}
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

        {/* Acciones */}
        <div className="p-4 flex flex-wrap items-center justify-end gap-2">
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
          ) : stepIndex >= 2 ? (
            // Llegamos a la derecha (capturada o no): guardar o repetir.
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              {Boolean(captures[2]?.descriptor) && (
                <Button variant="outline" onClick={repeatStep}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Repetir {currentStep.label.toLowerCase()}
                </Button>
              )}
              <Button onClick={captureStep} disabled={processingRef.current || !cameraActive}>
                <Camera className="w-4 h-4 mr-2" />
                {Boolean(captures[2]?.descriptor) ? "Repetir" : "Capturar derecha"}
              </Button>
              <Button onClick={save} disabled={!frontalDone || processingRef.current}>
                Guardar registro
              </Button>
            </>
          ) : (
            // Frontal (step 0) o izquierda (step 1)
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              {stepIndex > 0 && (
                <Button variant="outline" onClick={skipStep}>
                  <SkipForward className="w-4 h-4 mr-2" />
                  Omitir
                </Button>
              )}
              {Boolean(captures[stepIndex]?.descriptor) && (
                <Button variant="outline" onClick={repeatStep}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Repetir
                </Button>
              )}
              <Button onClick={captureStep} disabled={processingRef.current || !cameraActive}>
                <Camera className="w-4 h-4 mr-2" />
                Capturar {currentStep.label.toLowerCase()}
              </Button>
              {frontalDone && (
                <Button onClick={save} disabled={processingRef.current}>
                  Guardar
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}