"use client";

import * as faceapi from "@vladmandic/face-api";
import { DEFAULT_FACE_MATCH_THRESHOLD } from "@/lib/face-match-threshold";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const MODEL_URL = "/models";
/** Fallback si el caller no pasa el umbral de la empresa. */
const DISTANCE_THRESHOLD = DEFAULT_FACE_MATCH_THRESHOLD;

interface TensorFlowBackend {
  setBackend: (backendName: string) => Promise<boolean>;
  ready: () => Promise<void>;
}

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
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return loadingPromise;
}

export function isModelsLoaded(): boolean {
  return modelsLoaded;
}

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
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) {
    return { detected: false, descriptor: null, box: null, landmarks: null };
  }

  return {
    detected: true,
    descriptor: Array.from(result.descriptor),
    box: {
      x: result.detection.box.x,
      y: result.detection.box.y,
      width: result.detection.box.width,
      height: result.detection.box.height,
    },
    landmarks: result.landmarks,
  };
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export interface MatchResult {
  employeeId: string;
  distance: number;
  confidence: number;
}

export function findBestMatch(
  queryDescriptor: number[],
  registered: { employeeId: string; descriptor: number[] }[],
  threshold: number = DISTANCE_THRESHOLD
): MatchResult | null {
  if (registered.length === 0) return null;

  let best: MatchResult | null = null;
  const safeThreshold = threshold > 0 ? threshold : DISTANCE_THRESHOLD;

  for (const entry of registered) {
    const dist = euclideanDistance(queryDescriptor, entry.descriptor);
    if (!best || dist < best.distance) {
      best = {
        employeeId: entry.employeeId,
        distance: dist,
        confidence: Math.max(0, 1 - dist / safeThreshold),
      };
    }
  }

  return best;
}

export function isMatch(
  distance: number,
  threshold: number = DISTANCE_THRESHOLD
): boolean {
  return distance < threshold;
}

export { DISTANCE_THRESHOLD };
