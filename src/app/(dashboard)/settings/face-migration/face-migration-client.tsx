"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, ScanFace, XCircle } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { detectFace, loadModels } from "@/lib/ai/face-api-service";
import { getArcFaceBackend } from "@/lib/ai/arcface-service";

interface Candidate {
  employeeId: string;
  fullName: string;
  photo: string;
  branchName: string | null;
}

interface Stats {
  total: number;
  withEmbedding: number;
  pending: number;
  withoutPhoto: number;
}

type ResultStatus = "ok" | "no-face" | "error";

interface ProcessedResult {
  employeeId: string;
  fullName: string;
  status: ResultStatus;
  detail?: string;
  elapsedMs?: number;
}

const RESULT_LABELS: Record<ResultStatus, string> = {
  ok: "Reconstruido",
  "no-face": "Sin rostro detectable",
  error: "Error al guardar",
};

async function loadImage(source: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = source;

  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  });

  if (!image.complete || image.naturalWidth === 0) return null;
  return image;
}

export function FaceMigrationClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [processed, setProcessed] = useState<ProcessedResult[]>([]);
  const [backend, setBackend] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/face/backfill-candidates");
      if (!response.ok) {
        toast.error("No se pudieron cargar los empleados pendientes");
        return;
      }
      const data = (await response.json()) as {
        stats: Stats;
        candidates: Candidate[];
      };
      setStats(data.stats);
      setCandidates(data.candidates);
    } catch {
      toast.error("No se pudieron cargar los empleados pendientes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCandidates();
  }, [fetchCandidates]);

  const runBackfill = useCallback(async () => {
    if (candidates.length === 0) return;

    setIsRunning(true);
    setProcessed([]);

    try {
      await loadModels();
      setBackend(getArcFaceBackend());
    } catch {
      toast.error("No se pudo cargar el modelo de reconocimiento facial");
      setIsRunning(false);
      return;
    }

    const results: ProcessedResult[] = [];

    for (const candidate of candidates) {
      const startedAt = performance.now();
      let result: ProcessedResult;

      try {
        const image = await loadImage(candidate.photo);
        if (!image) {
          result = {
            employeeId: candidate.employeeId,
            fullName: candidate.fullName,
            status: "no-face",
            detail: "La foto no se pudo abrir",
          };
        } else {
          const detection = await detectFace(image);

          if (!detection.detected || !detection.descriptor) {
            result = {
              employeeId: candidate.employeeId,
              fullName: candidate.fullName,
              status: "no-face",
              detail: detection.detected
                ? "Rostro detectado pero no se pudo alinear"
                : "No se detectó ningún rostro en la foto",
            };
          } else {
            const response = await fetch(`/api/employees/${candidate.employeeId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                faceRegistered: true,
                faceRegisteredAt: new Date().toISOString(),
                faceEmbedding: detection.descriptor,
              }),
            });

            if (!response.ok) {
              const payload = (await response
                .json()
                .catch(() => ({}))) as { error?: string };
              result = {
                employeeId: candidate.employeeId,
                fullName: candidate.fullName,
                status: "error",
                detail: payload.error ?? `HTTP ${response.status}`,
              };
            } else {
              result = {
                employeeId: candidate.employeeId,
                fullName: candidate.fullName,
                status: "ok",
                elapsedMs: Math.round(performance.now() - startedAt),
              };
            }
          }
        }
      } catch (error) {
        result = {
          employeeId: candidate.employeeId,
          fullName: candidate.fullName,
          status: "error",
          detail: error instanceof Error ? error.message : "Error inesperado",
        };
      }

      results.push(result);
      setProcessed([...results]);
    }

    setIsRunning(false);

    const succeeded = results.filter((item) => item.status === "ok").length;
    if (succeeded === results.length) {
      toast.success(`${succeeded} empleados reconstruidos correctamente`);
    } else {
      toast.warning(
        `${succeeded} de ${results.length} reconstruidos; revisa los pendientes`
      );
    }

    void fetchCandidates();
  }, [candidates, fetchCandidates]);

  const succeeded = processed.filter((item) => item.status === "ok").length;
  const failed = processed.length - succeeded;
  const progressValue =
    candidates.length === 0
      ? 0
      : Math.round((processed.length / candidates.length) * 100);

  const measured = processed.filter((item) => typeof item.elapsedMs === "number");
  const averageMs =
    measured.length === 0
      ? null
      : Math.round(
          measured.reduce((sum, item) => sum + (item.elapsedMs ?? 0), 0) /
            measured.length
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Migración de reconocimiento facial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          El motor pasó a ArcFace de 512 dimensiones. Los vectores anteriores no son
          convertibles, pero se pueden reconstruir desde la foto guardada de cada
          empleado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado actual</CardTitle>
          <CardDescription>
            El procesamiento ocurre en este navegador: la foto no se envía a ningún
            servicio externo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando empleados...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Empleados activos</p>
                  <p className="text-2xl font-semibold">{stats?.total ?? 0}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Con rostro migrado</p>
                  <p className="text-2xl font-semibold text-emerald-600">
                    {stats?.withEmbedding ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Reconstruibles</p>
                  <p className="text-2xl font-semibold text-amber-600">
                    {stats?.pending ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Requieren enrolamiento</p>
                  <p className="text-2xl font-semibold">{stats?.withoutPhoto ?? 0}</p>
                </div>
              </div>

              {(stats?.withoutPhoto ?? 0) > 0 && (
                <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  <p>
                    {stats?.withoutPhoto} empleados no tienen foto guardada, así que
                    deben registrarse en vivo desde{" "}
                    <Link
                      href="/facial-registration"
                      className="font-medium underline underline-offset-4"
                    >
                      Registro facial
                    </Link>
                    .
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => void runBackfill()}
                  disabled={isRunning || candidates.length === 0}
                >
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ScanFace className="w-4 h-4 mr-2" />
                  )}
                  {isRunning
                    ? "Procesando..."
                    : `Reconstruir ${candidates.length} embeddings`}
                </Button>

                {backend && (
                  <Badge variant="secondary">Motor ArcFace: {backend}</Badge>
                )}
                {averageMs !== null && (
                  <Badge variant="secondary">{averageMs} ms por rostro</Badge>
                )}
              </div>

              {processed.length > 0 && (
                <div className="space-y-3">
                  <Progress value={progressValue} />
                  <p className="text-sm text-muted-foreground">
                    {processed.length} de {candidates.length} procesados
                    {failed > 0 && ` · ${failed} con incidencias`}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {processed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
            <CardDescription>
              Los empleados sin rostro detectable en su foto deben registrarse en vivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {processed.map((item) => (
                <li
                  key={item.employeeId}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.fullName}</p>
                    {item.detail && (
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {typeof item.elapsedMs === "number" && (
                      <span className="text-xs text-muted-foreground">
                        {item.elapsedMs} ms
                      </span>
                    )}
                    {item.status === "ok" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {RESULT_LABELS[item.status]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
