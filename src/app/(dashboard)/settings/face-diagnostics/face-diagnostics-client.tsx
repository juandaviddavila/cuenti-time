"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Loader2, RefreshCw, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cosineDistance, detectFace, loadModels } from "@/lib/ai/face-api-service";
import { getArcFaceBackend } from "@/lib/ai/arcface-service";
import {
  decideFaceMatch,
  DEFAULT_FACE_MATCH_THRESHOLD,
  FACE_MATCH_HARD_MAX_DISTANCE,
  FACE_MATCH_THRESHOLD_MAX,
  FACE_MATCH_THRESHOLD_MIN,
} from "@/lib/face-match-threshold";

interface RegisteredFace {
  employeeId: string;
  fullName: string;
  descriptor: number[] | null;
}

interface PairDistance {
  a: string;
  b: string;
  distance: number;
}

interface LiveResult {
  employeeId: string;
  fullName: string;
  distance: number;
}

const DECISION_LABELS: Record<string, string> = {
  match: "Identificado",
  ambiguous: "Ambiguo — dos candidatos demasiado parecidos",
  weak_match: "Coincidencia débil — por encima del techo de calidad",
  no_match: "Sin coincidencia",
};

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * fraction))
  );
  return sorted[index];
}

export function FaceDiagnosticsClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [faces, setFaces] = useState<RegisteredFace[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_FACE_MATCH_THRESHOLD);
  const [isLoading, setIsLoading] = useState(true);
  const [pairs, setPairs] = useState<PairDistance[]>([]);
  const [backend, setBackend] = useState<string | null>(null);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [liveResults, setLiveResults] = useState<LiveResult[] | null>(null);
  const [liveDecision, setLiveDecision] = useState<string | null>(null);

  const fetchFaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/face/descriptors");
      if (!response.ok) {
        toast.error("No se pudieron cargar los rostros registrados");
        return;
      }
      const data = (await response.json()) as {
        faceMatchThreshold?: number;
        data?: RegisteredFace[];
      };

      const withDescriptor = (data.data ?? []).filter(
        (item): item is RegisteredFace & { descriptor: number[] } =>
          Array.isArray(item.descriptor)
      );

      setFaces(withDescriptor);
      if (typeof data.faceMatchThreshold === "number") {
        setThreshold(data.faceMatchThreshold);
      }

      const computed: PairDistance[] = [];
      for (let i = 0; i < withDescriptor.length; i++) {
        for (let j = i + 1; j < withDescriptor.length; j++) {
          computed.push({
            a: withDescriptor[i].fullName,
            b: withDescriptor[j].fullName,
            distance: cosineDistance(
              withDescriptor[i].descriptor,
              withDescriptor[j].descriptor
            ),
          });
        }
      }
      computed.sort((left, right) => left.distance - right.distance);
      setPairs(computed);
    } catch {
      toast.error("No se pudieron cargar los rostros registrados");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFaces();
  }, [fetchFaces]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = useCallback(async () => {
    try {
      await loadModels();
      setBackend(getArcFaceBackend());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOn(true);
    } catch {
      toast.error("No se pudo acceder a la cámara");
    }
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current) return;

    setIsCapturing(true);
    try {
      const detection = await detectFace(videoRef.current);
      if (!detection.detected || !detection.descriptor) {
        toast.error("No se detectó un rostro utilizable");
        setLiveResults(null);
        setLiveDecision(null);
        return;
      }

      const descriptor = detection.descriptor;
      const results = faces
        .filter(
          (face): face is RegisteredFace & { descriptor: number[] } =>
            Array.isArray(face.descriptor)
        )
        .map((face) => ({
          employeeId: face.employeeId,
          fullName: face.fullName,
          distance: cosineDistance(descriptor, face.descriptor),
        }))
        .sort((left, right) => left.distance - right.distance);

      setLiveResults(results);

      if (results.length > 0) {
        const decision = decideFaceMatch({
          bestDistance: results[0].distance,
          secondDistance: results[1]?.distance ?? null,
          companyThreshold: threshold,
        });
        setLiveDecision(decision.reason);
      } else {
        setLiveDecision(null);
      }
    } catch {
      toast.error("Falló la captura");
    } finally {
      setIsCapturing(false);
    }
  }, [faces, threshold]);

  const distances = pairs.map((pair) => pair.distance);
  const minInterPerson = distances.length > 0 ? distances[0] : null;
  const medianInterPerson =
    distances.length > 0 ? percentile(distances, 0.5) : null;

  // Un umbral seguro se queda por debajo del par de personas distintas más
  // cercano; el colchón evita que una toma con peor luz cruce la frontera.
  const suggestedThreshold =
    minInterPerson === null
      ? null
      : Math.max(
          FACE_MATCH_THRESHOLD_MIN,
          Math.min(
            FACE_MATCH_THRESHOLD_MAX,
            Math.min(FACE_MATCH_HARD_MAX_DISTANCE, minInterPerson - 0.1)
          )
        );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ajustes
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Diagnóstico facial</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mide las distancias reales entre los rostros de tu empresa para elegir el
          umbral con datos en vez de a ojo. Todo se calcula en este navegador.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Separación entre empleados</CardTitle>
            <CardDescription>
              Distancia coseno entre cada par de personas distintas. Cuanto más alta,
              más difícil es confundirlas.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchFaces()}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalcular
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando rostros...
            </div>
          ) : faces.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Se necesitan al menos dos empleados con rostro registrado. Si acabas de
              migrar, primero ejecuta la{" "}
              <Link
                href="/settings/face-migration"
                className="font-medium underline underline-offset-4"
              >
                reconstrucción de embeddings
              </Link>
              .
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Rostros comparados</p>
                  <p className="text-2xl font-semibold">{faces.length}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Par más cercano</p>
                  <p className="text-2xl font-semibold">
                    {minInterPerson?.toFixed(3) ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Mediana</p>
                  <p className="text-2xl font-semibold">
                    {medianInterPerson?.toFixed(3) ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Umbral actual</p>
                  <p className="text-2xl font-semibold">{threshold.toFixed(2)}</p>
                </div>
              </div>

              {suggestedThreshold !== null && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p>
                    Umbral sugerido:{" "}
                    <strong>{suggestedThreshold.toFixed(2)}</strong>. Queda por debajo
                    del par de personas distintas más cercano
                    {minInterPerson !== null && ` (${minInterPerson.toFixed(3)})`}, con
                    holgura para tomas con peor iluminación. Ajústalo en{" "}
                    <Link
                      href="/settings"
                      className="font-medium underline underline-offset-4"
                    >
                      Ajustes
                    </Link>
                    .
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">
                  Pares más riesgosos
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-right">Distancia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pairs.slice(0, 10).map((pair) => (
                      <TableRow key={`${pair.a}-${pair.b}`}>
                        <TableCell>{pair.a}</TableCell>
                        <TableCell>{pair.b}</TableCell>
                        <TableCell className="text-right font-mono">
                          {pair.distance.toFixed(3)}
                          {pair.distance < threshold && (
                            <Badge variant="destructive" className="ml-2">
                              riesgo
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prueba en vivo</CardTitle>
          <CardDescription>
            Captura un rostro y observa su distancia contra todos los empleados. Sirve
            para confirmar que la persona correcta queda muy por debajo del resto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {!isCameraOn ? (
              <Button onClick={() => void startCamera()}>
                <Camera className="w-4 h-4 mr-2" />
                Encender cámara
              </Button>
            ) : (
              <>
                <Button onClick={() => void capture()} disabled={isCapturing}>
                  {isCapturing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ScanFace className="w-4 h-4 mr-2" />
                  )}
                  Capturar y comparar
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Apagar cámara
                </Button>
              </>
            )}
            {backend && (
              <Badge variant="secondary">Motor ArcFace: {backend}</Badge>
            )}
          </div>

          <video
            ref={videoRef}
            playsInline
            muted
            className={
              isCameraOn
                ? "w-full max-w-md rounded-lg border bg-black"
                : "hidden"
            }
          />

          {liveDecision && (
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-medium">
                {DECISION_LABELS[liveDecision] ?? liveDecision}
              </p>
            </div>
          )}

          {liveResults && liveResults.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Distancia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveResults.slice(0, 10).map((result) => (
                  <TableRow key={result.employeeId}>
                    <TableCell>{result.fullName}</TableCell>
                    <TableCell className="text-right font-mono">
                      {result.distance.toFixed(3)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
