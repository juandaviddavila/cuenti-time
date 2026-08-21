"use client";

import * as faceapi from "@vladmandic/face-api";
import {
  decideFaceMatch,
  DEFAULT_FACE_MATCH_MARGIN,
  DEFAULT_FACE_MATCH_THRESHOLD,
} from "@/lib/face-match-threshold";
import {
  embedFaceFromLandmarks,
  getArcFaceBackend,
  loadArcFaceModel,
} from "@/lib/ai/arcface-service";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const MODEL_URL = "/models";
/** Fallback si el caller no pasa el umbral de la empresa. */
const DISTANCE_THRESHOLD = DEFAULT_FACE_MATCH_THRESHOLD;

interface TensorFlowBackend {
  setBackend: (backendName: string) => Promise<boolean>;
  ready: () => Promise<void>;
}

/**
 * face-api se conserva solo para detección y landmarks; el embedding lo produce
 * ArcFace (512-D) vía onnxruntime-web.
 */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const tf = faceapi.tf as unknown as TensorFlowBackend;

    // Avoid TFJS trying to load a WASM file from Next.js chunks.
    // WebGL is preferred in browsers; CPU is a reliable fallback.
    try {
      await tf.setBackend("webgl");
    } catch {
      await tf.setBackend("cpu");
    }
    await tf.ready();

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      loadArcFaceModel(),
    ]);
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
  return modelsLoaded;
}

export { getArcFaceBackend };

export interface FaceDetectionResult {
  detected: boolean;
  descriptor: number[] | null;
  box: { x: number; y: number; width: number; height: number } | null;
  landmarks: faceapi.FaceLandmarks | null;
}

export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceDetectionResult> {
  if (!modelsLoaded) await loadModels();

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5,
  });

  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks();

  if (!result) {
    return { detected: false, descriptor: null, box: null, landmarks: null };
  }

  const box = {
    x: result.detection.box.x,
    y: result.detection.box.y,
    width: result.detection.box.width,
    height: result.detection.box.height,
  };

  // Un rostro detectado sin embedding utilizable se trata como no identificable:
  // los callers ya exigen descriptor antes de intentar un match.
  let descriptor: number[] | null = null;
  try {
    descriptor = await embedFaceFromLandmarks(
      input,
      result.landmarks.positions
    );
  } catch {
    descriptor = null;
  }

  return {
    detected: true,
    descriptor,
    box,
    landmarks: result.landmarks,
  };
}

/**
 * Distancia coseno entre embeddings normalizados, en la misma escala que el
 * operador `<=>` de pgvector para que cliente y servidor decidan igual.
 */
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

export interface MatchResult {
  employeeId: string;
  distance: number;
  confidence: number;
  secondDistance?: number;
  ambiguous?: boolean;
}

/**
 * Mejor match por distancia coseno. Devuelve null si no hay candidatos.
 * Marca `ambiguous` / rechaza calidad débil con las mismas reglas del servidor.
 */
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
    // `ambiguous` alimenta el mensaje de UI; weak_match y no_match se tratan
    // simplemente como ausencia de match vía isConfidentMatch.
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

/** Acepta solo si pasa umbral estricto + no ambiguo. */
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
