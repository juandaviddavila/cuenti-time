"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Upload, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface PhotoCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string) => void;
  _initialPhoto?: string | null;
  employeeName?: string;
}

export function PhotoCaptureModal({
  open,
  onClose,
  onCapture,
  _initialPhoto,
  employeeName,
}: PhotoCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (open && tab === "camera") {
      startCamera();
    }
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraActive(true);
      }
    } catch {
      setCameraError("No se pudo acceder a la cámara. Verifique los permisos.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La foto debe pesar menos de 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setCapturedPhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function confirm() {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      setCapturedPhoto(null);
      onClose();
    }
  }

  function retake() {
    setCapturedPhoto(null);
    if (tab === "camera") startCamera();
  }

  function handleClose() {
    stopCamera();
    setCapturedPhoto(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Foto del empleado{employeeName ? ` — ${employeeName}` : ""}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="camera" disabled={!!capturedPhoto}>
              <Camera className="w-4 h-4 mr-2" />Cámara
            </TabsTrigger>
            <TabsTrigger value="upload" disabled={!!capturedPhoto}>
              <Upload className="w-4 h-4 mr-2" />Subir
            </TabsTrigger>
          </TabsList>

          {/* Camera tab */}
          <TabsContent value="camera" className="mt-4">
            <div className="relative bg-black rounded-xl overflow-hidden aspect-square">
              {!capturedPhoto ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Oval guide overlay */}
                  {cameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-40 h-52 border-[3px] border-white/60 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
                    </div>
                  )}

                  {/* Camera error */}
                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
                      <Camera className="w-10 h-10 text-muted-foreground" />
                      <p className="text-white text-xs text-center px-4">{cameraError}</p>
                      <Button size="sm" variant="outline" onClick={startCamera}>Reintentar</Button>
                    </div>
                  )}

                  {/* Capture button */}
                  {cameraActive && !cameraError && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <Button
                        onClick={capturePhoto}
                        size="icon"
                        className="w-14 h-14 rounded-full border-4 border-white shadow-lg"
                      >
                        <Camera className="w-6 h-6" />
                      </Button>
                    </div>
                  )}

                  {/* Loading */}
                  {!cameraActive && !cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    </div>
                  )}
                </>
              ) : (
                // Captured photo preview
                <img
                  // eslint-disable-next-line @next/next/no-img-element
                  src={capturedPhoto}
                  alt="Foto capturada"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </TabsContent>

          {/* Upload tab */}
          <TabsContent value="upload" className="mt-4">
            {!capturedPhoto ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl aspect-square flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  Haz clic para seleccionar una foto<br />
                  <span className="text-xs">JPG, PNG, WebP — máx 2MB</span>
                </p>
              </div>
            ) : (
              <div className="relative bg-black rounded-xl overflow-hidden aspect-square">
                <img
                  // eslint-disable-next-line @next/next/no-img-element
                  src={capturedPhoto}
                  alt="Foto"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileUpload}
            />
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {capturedPhoto ? (
            <>
              <Button variant="outline" onClick={retake} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />Tomar otra
              </Button>
              <Button onClick={confirm} className="flex-1">
                <Check className="w-4 h-4 mr-2" />Confirmar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose} className="flex-1">
              <X className="w-4 h-4 mr-2" />Cancelar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
