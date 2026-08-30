"use client";

import * as faceapi from "@vladmandic/face-api";
import {
  decideFaceMatch,
  DEFAULT_FACE_MATCH_MARGIN,
  DEFAULT_FACE_MATCH_THRESHOLD,
} from "@/lib/face-match-threshold";
import {
  embedAlignedFace,
  getArcFaceBackend,
  isArcFaceLoaded,
  loadArcFaceModel,
} from "@/lib/ai/arcface-service";
import {
  alignFaceToCanvasFromFivePoints,
  toFivePoints,
  type Point,
} from "@/lib/ai/face-align";
import { evaluateAlignedFace, type ExpectedTurn } from "@/lib/ai/face-quality";
import type { FacePresence } from "@/lib/ai/mediapipe-face";

let modelsLoaded = false;
let faceApiLoaded = false;
let loadingPromise: Promise<void> | null = null;

const DISTANCE_THRESHOLD = DEFAULT_FACE_MATCH_THRESHOLD;
const MODEL_URL = "/models";

interface TensorFlowBackend {
  setBackend: (backendName: string) => Promise<boolean>;
  ready: () => Promise<void>;
}

async function loadFaceApiDetector(): Promise<void> {
  if (faceApiLoaded) return;
  const tf = faceapi.tf as unknown as TensorFlowBackend;
  try {
    await tf.setBackend("webgl");
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  ]);
  faceApiLoaded = true;
}

function snapshotForDetector(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): HTMLVideoElement | HTMLCanvasElement | HTMLImageElement {
  if (!(input instanceof HTMLVideoElement)) return input;
  const width = input.videoWidth;
  const height = input.videoHeight;
  if (width <= 0 || height <= 0) return input;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return input;
  context.drawImage(input, 0, 0);
  return canvas;
}

const MIN_FACE_BOX_PX = 60;
const MIN_IDENTITY_BOX_PX = 90;
/** Dos embeddings seguidos más cerca que esto = cara ya quieta. */
const STABLE_PAIR_DISTANCE = 0.2;
const MIN_IDENTITY_AREA_RATIO = 0.03;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function frameSize(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): { width: number; height: number } {
  if (input instanceof HTMLVideoElement) {
    return { width: input.videoWidth, height: input.videoHeight };
  }
  if (input instanceof HTMLImageElement) {
    return { width: input.naturalWidth, height: input.naturalHeight };
  }
  return { width: input.width, height: input.height };
}

function faceQualityScore(
  box: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number
): number {
  if (frameWidth <= 0 || frameHeight <= 0) return 0;
  const areaRatio = (box.width * box.height) / (frameWidth * frameHeight);
  const centerX = (box.x + box.width / 2) / frameWidth;
  const centerY = (box.y + box.height / 2) / frameHeight;
  const centerPenalty = Math.hypot(centerX - 0.5, centerY - 0.5);
  return areaRatio - centerPenalty * 0.4;
}

async function detectWithFaceApi(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  options?: { minScore?: number; minBoxPx?: number; withLandmarks?: boolean }
): Promise<FacePresence> {
  if (!faceApiLoaded) {
    return { detected: false, box: null, fivePoints: null };
  }

  const minScore = options?.minScore ?? 0.35;
  const minBoxPx = options?.minBoxPx ?? MIN_FACE_BOX_PX;
  const withLandmarks = options?.withLandmarks ?? true;
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: minScore,
  });
  const detector = faceapi.detectSingleFace(
    snapshotForDetector(input),
    detectorOptions
  );

  if (withLandmarks) {
    const result = await detector.withFaceLandmarks();
    if (!result) {
      return { detected: false, box: null, fivePoints: null };
    }
    const box = result.detection.box;
    if (
      result.detection.score < minScore ||
      box.width < minBoxPx ||
      box.height < minBoxPx
    ) {
      return { detected: false, box: null, fivePoints: null };
    }
    const fivePoints = toFivePoints(result.landmarks.positions);
    if (!fivePoints) {
      return { detected: false, box: null, fivePoints: null };
    }
    return {
      detected: true,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      fivePoints,
    };
  }

  // Presencia: sin landmarks, solo caja.
  const detection = await detector;
  if (!detection) {
    return { detected: false, box: null, fivePoints: null };
  }
  const box = detection.box;
  if (
    detection.score < minScore ||
    box.width < minBoxPx ||
    box.height < minBoxPx
  ) {
    return { detected: false, box: null, fivePoints: null };
  }
  return {
    detected: true,
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    fivePoints: null,
  };
}

/**
 * TinyFaceDetector + landmarks 68 + ArcFace. MediaPipe no entra aquí:
 * si su WASM se cuelga, bloqueaba la carga y no se detectaba ni enrolaba.
 */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  // Solo el detector es crítico: si ArcFace WASM falla (tablet débil, WASM
  // roto), el embedding cae al servidor vía /api/face/embed (Fase 2).
  loadingPromise = (async () => {
    await loadFaceApiDetector();
    void loadArcFaceModel().catch(() => undefined);
    modelsLoaded = true;
  })();

  try {
    return await loadingPromise;
  } catch (error) {
    loadingPromise = null;
    throw error;
  }
}

export function isModelsLoaded(): boolean {
  return modelsLoaded && faceApiLoaded;
}

export { getArcFaceBackend };

export interface FaceDetectionResult {
  detected: boolean;
  descriptor: number[] | null;
  box: { x: number; y: number; width: number; height: number } | null;
  fivePoints: Point[] | null;
  /** Canvas 112x112 alineado del MISMO fotograma del descriptor (para gates de calidad). */
  alignedCanvas: HTMLCanvasElement | null;
}

export async function detectFacePresence(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FacePresence> {
  if (!modelsLoaded) await loadModels();
  // Presencia = solo detección (sin 68 landmarks): más barato para el loop de
  // 200-300ms. Los landmarks se calculan recién al identificar/enrolar.
  return detectWithFaceApi(input, { withLandmarks: false });
}

/** Embebe un crop ya alineado: local (WASM) o servidor (Fase 2) si falla. */
async function embedFromAligned(
  aligned: HTMLCanvasElement
): Promise<number[] | null> {
  if (isArcFaceLoaded()) {
    try {
      return await embedAlignedFace(aligned);
    } catch {
      // cae al fallback de servidor
    }
  }
  return embedViaServer(aligned);
}

export async function embedDetectedFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  fivePoints: Point[] | null
): Promise<number[] | null> {
  if (!fivePoints) return null;
  if (!modelsLoaded) await loadModels();

  const aligned = alignFaceToCanvasFromFivePoints(input, fivePoints);
  if (!aligned) return null;
  return embedFromAligned(aligned);
}

/** Fallback Fase 2: el servidor corre ArcFace con onnxruntime-node. */
async function embedViaServer(alignedCanvas: HTMLCanvasElement): Promise<number[] | null> {
  try {
    const context = alignedCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    const { width, height } = alignedCanvas;
    const { data } = context.getImageData(0, 0, width, height);

    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.length);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + 0x8000))
      );
    }

    const response = await fetch("/api/face/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropBase64: btoa(binary), width, height }),
    });
    if (!response.ok) return null;
    const parsed = (await response.json()) as { descriptor?: number[] };
    if (!Array.isArray(parsed.descriptor)) return null;
    return parsed.descriptor;
  } catch {
    return null;
  }
}

export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceDetectionResult> {
  if (!modelsLoaded) await loadModels();

  // Un solo fotograma: detectar, alinear y embeber sobre el mismo canvas.
  // Si se detecta el video y se embebe 200 ms después, la distancia salta
  // de ~0.4 (match) a ~0.55 (no_match) con la misma persona.
  const frame = snapshotForDetector(input);
  const presence = await detectWithFaceApi(frame, {
    minScore: 0.45,
    minBoxPx: MIN_IDENTITY_BOX_PX,
  });
  if (!presence.detected) {
    return {
      detected: false,
      descriptor: null,
      box: null,
      fivePoints: presence.fivePoints,
      alignedCanvas: null,
    };
  }

  const alignedCanvas = presence.fivePoints
    ? alignFaceToCanvasFromFivePoints(frame, presence.fivePoints)
    : null;
  const descriptor = alignedCanvas ? await embedFromAligned(alignedCanvas) : null;

  return {
    detected: true,
    descriptor,
    box: presence.box,
    fivePoints: presence.fivePoints,
    alignedCanvas,
  };
}

/**
 * Detecta y alinea SIN calcular embedding. Para el enrolamiento: los gates de
 * calidad corren sobre el canvas alineado y el embedding (caro) se calcula
 * solo si pasan. Mantiene la garantía "mismo frame": alinea una sola vez.
 */
export async function detectAndAlignFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceDetectionResult> {
  if (!modelsLoaded) await loadModels();

  const frame = snapshotForDetector(input);
  const presence = await detectWithFaceApi(frame, {
    minScore: 0.45,
    minBoxPx: MIN_IDENTITY_BOX_PX,
  });
  if (!presence.detected) {
    return {
      detected: false,
      descriptor: null,
      box: null,
      fivePoints: presence.fivePoints,
      alignedCanvas: null,
    };
  }

  const alignedCanvas = presence.fivePoints
    ? alignFaceToCanvasFromFivePoints(frame, presence.fivePoints)
    : null;

  return {
    detected: true,
    descriptor: null,
    box: presence.box,
    fivePoints: presence.fivePoints,
    alignedCanvas,
  };
}

/** Promedia vectores ya L2-normalizados y vuelve a normalizar. */
export function averageFaceEmbeddings(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const dim = vectors[0].length;
  const acc = new Array<number>(dim).fill(0);
  let used = 0;
  for (const vector of vectors) {
    if (vector.length !== dim) continue;
    used += 1;
    for (let i = 0; i < dim; i++) acc[i] += vector[i];
  }
  if (used === 0) return null;
  let sumOfSquares = 0;
  for (let i = 0; i < dim; i++) {
    acc[i] /= used;
    sumOfSquares += acc[i] * acc[i];
  }
  const norm = Math.sqrt(sumOfSquares);
  if (!Number.isFinite(norm) || norm === 0) return null;
  return acc.map((value) => value / norm);
}

/**
 * Espera a que la cara esté quieta (2 embeddings seguidos parecidos) y
 * solo entonces devuelve el promedio de esos dos. No promedia frames
 * movidos con uno bueno: eso ensuciaba el primer /api/face/search.
 */
export async function detectFaceConsensus(
  input: HTMLVideoElement
): Promise<FaceDetectionResult> {
  const { width, height } = frameSize(input);
  const started = Date.now();
  const maxMs = 1400;
  const maxSamples = 8;
  const ranked: Array<{ result: FaceDetectionResult; score: number }> = [];
  let previous: number[] | null = null;

  for (let i = 0; i < maxSamples && Date.now() - started < maxMs; i++) {
    const result = await detectFace(input);
    if (!result.descriptor || !result.box) {
      previous = null;
      await wait(70);
      continue;
    }

    const areaRatio = (result.box.width * result.box.height) / (width * height);
    if (areaRatio < MIN_IDENTITY_AREA_RATIO) {
      previous = null;
      await wait(70);
      continue;
    }
    const score = faceQualityScore(result.box, width, height);

    ranked.push({ result, score });

    if (previous) {
      const pairDistance = cosineDistance(previous, result.descriptor);
      if (pairDistance <= STABLE_PAIR_DISTANCE) {
        const descriptor = averageFaceEmbeddings([previous, result.descriptor]);
        if (descriptor) {
          return { ...result, detected: true, descriptor };
        }
      }
    }

    previous = result.descriptor;
    await wait(70);
  }

  if (ranked.length === 0) {
    return {
      detected: false,
      descriptor: null,
      box: null,
      fivePoints: null,
      alignedCanvas: null,
    };
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked[0].result;
}

export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return Infinity;

  return 1 - dot / denominator;
}

/**
 * Captura MANUAL para enrolamiento: el usuario posa y pulsa "Capturar".
 * Toma hasta `samples` muestras estables que pasen los gates de calidad
 * dentro del presupuesto de tiempo y devuelve su promedio (una sola plantilla).
 * Gate antes que embed: el embedding ArcFace (caro) solo se calcula si los
 * gates pasan. `expectTurn` valida el giro (null = frontal, "left"/"right").
 */
export interface ManualCaptureResult {
  descriptor: number[] | null;
  issue?: string;
}

const ENROLL_OUTLIER_DISTANCE = 0.35;

export async function captureManualTemplate(
  input: HTMLVideoElement,
  expectTurn: ExpectedTurn,
  options?: { samples?: number; maxMs?: number }
): Promise<ManualCaptureResult> {
  const target = options?.samples ?? 3;
  const maxMs = options?.maxMs ?? 2200;
  const started = Date.now();
  const vectors: number[][] = [];
  let lastIssue: string | undefined;

  while (vectors.length < target && Date.now() - started < maxMs) {
    const result = await detectAndAlignFace(input);
    const aligned = result.alignedCanvas;

    if (!result.detected || !aligned || !result.fivePoints) {
      lastIssue = "Acerque la cara y mire de frente";
    } else {
      const quality = evaluateAlignedFace(aligned, result.fivePoints, expectTurn);
      if (!quality.ok) {
        lastIssue = quality.issues[0];
      } else {
        const descriptor = await embedFromAligned(aligned);
        if (!descriptor) {
          lastIssue = "Procesando rostro — un momento";
        } else {
          const isOutlier = vectors.some(
            (captured) =>
              cosineDistance(captured, descriptor) > ENROLL_OUTLIER_DISTANCE
          );
          if (!isOutlier) {
            vectors.push(descriptor);
            lastIssue = undefined;
          } else {
            lastIssue = "Mantenga la misma posición";
          }
        }
      }
    }

    if (vectors.length < target) await wait(90);
  }

  if (vectors.length === 0) return { descriptor: null, issue: lastIssue };
  return { descriptor: averageFaceEmbeddings(vectors), issue: lastIssue };
}

/** Anti-duplicados: ¿este rostro ya pertenece a OTRO empleado? */
export async function findDuplicateEnrollment(
  descriptor: number[],
  excludeEmployeeId: string
): Promise<{ employeeId: string; fullName: string } | null> {
  try {
    const response = await fetch("/api/face/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptor, excludeEmployeeId }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      match?: { employeeId: string; fullName: string } | null;
    };
    return data.match ?? null;
  } catch {
    return null;
  }
}

export interface MatchResult {
  employeeId: string;
  distance: number;
  confidence: number;
  secondDistance?: number;
  ambiguous?: boolean;
}

export function findBestMatch(
  queryDescriptor: number[],
  registered: { employeeId: string; descriptor: number[] }[],
  threshold: number = DISTANCE_THRESHOLD,
  margin: number = DEFAULT_FACE_MATCH_MARGIN
): MatchResult | null {
  if (registered.length === 0) return null;

  let best: MatchResult | null = null;
  let secondDistance = Infinity;
  const safeThreshold = threshold > 0 ? threshold : DISTANCE_THRESHOLD;

  for (const entry of registered) {
    const dist = cosineDistance(queryDescriptor, entry.descriptor);
    if (!best || dist < best.distance) {
      if (best) secondDistance = best.distance;
      best = {
        employeeId: entry.employeeId,
        distance: dist,
        confidence: Math.max(0, 1 - dist / safeThreshold),
      };
    } else if (dist < secondDistance) {
      secondDistance = dist;
    }
  }

  if (!best) return null;

  const hasSecond = Number.isFinite(secondDistance);
  const decision = decideFaceMatch({
    bestDistance: best.distance,
    secondDistance: hasSecond ? secondDistance : null,
    companyThreshold: safeThreshold,
    margin,
  });

  return {
    ...best,
    secondDistance: hasSecond ? secondDistance : undefined,
    ambiguous: !decision.ok && decision.reason === "ambiguous",
  };
}

export function isMatch(
  distance: number,
  threshold: number = DISTANCE_THRESHOLD
): boolean {
  const decision = decideFaceMatch({
    bestDistance: distance,
    secondDistance: null,
    companyThreshold: threshold,
  });
  return decision.ok;
}

export function isConfidentMatch(
  match: MatchResult | null,
  threshold: number = DISTANCE_THRESHOLD
): boolean {
  if (!match) return false;
  const decision = decideFaceMatch({
    bestDistance: match.distance,
    secondDistance: match.secondDistance ?? null,
    companyThreshold: threshold,
  });
  return decision.ok;
}

export { DISTANCE_THRESHOLD, DEFAULT_FACE_MATCH_MARGIN };
export type { FacePresence };

export function keepFacesWithDescriptor<T extends { descriptor: number[] | null }>(
  data: T[]
): Array<T & { descriptor: number[] }> {
  return data.filter((item): item is T & { descriptor: number[] } =>
    Array.isArray(item.descriptor)
  );
}
