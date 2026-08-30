"use client";

import {
  toFivePointsFromMediaPipe,
  type Point,
} from "@/lib/ai/face-align";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_URL = "/models/face_landmarker.task";

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FacePresence {
  detected: boolean;
  box: FaceBox | null;
  fivePoints: Point[] | null;
}

interface MediaPipeVision {
  FilesetResolver: {
    forVisionTasks: (path: string) => Promise<unknown>;
  };
  FaceLandmarker: {
    createFromOptions: (
      fileset: unknown,
      options: Record<string, unknown>
    ) => Promise<{
      detect: (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
        faceLandmarks: Array<Array<{ x: number; y: number }>>;
      };
    }>;
  };
}

type Landmarker = Awaited<
  ReturnType<MediaPipeVision["FaceLandmarker"]["createFromOptions"]>
>;

let landmarker: Landmarker | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadVisionBundle(): Promise<MediaPipeVision> {
  // Igual que ORT: no pasar el paquete por webpack (rompe import.meta / WASM).
  // Variable + webpackIgnore: tsc no resuelve la ruta pública absoluta.
  const bundleUrl = "/mediapipe/vision_bundle.mjs";
  const vision = await import(/* webpackIgnore: true */ bundleUrl);
  return vision as MediaPipeVision;
}

export async function loadMediaPipeFace(): Promise<void> {
  if (landmarker) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const vision = await Promise.race([
      loadVisionBundle(),
      new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new Error("MediaPipe: timeout cargando vision_bundle")),
          8000
        );
      }),
    ]);
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
    // Un solo landmarker en IMAGE: detect() acepta video, canvas e imagen.
    // CPU es más fiable que GPU en Next/PWA (WebGL a veces "arranca" y no detecta).
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
      minFaceDetectionConfidence: 0.3,
      minFacePresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  })();

  try {
    await loadingPromise;
  } catch (error) {
    loadingPromise = null;
    landmarker = null;
    throw error;
  }
}

export function isMediaPipeLoaded(): boolean {
  return landmarker !== null;
}

function sourceSize(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): { width: number; height: number } {
  if (input instanceof HTMLVideoElement) {
    return { width: input.videoWidth, height: input.videoHeight };
  }
  if (input instanceof HTMLImageElement) {
    return { width: input.naturalWidth, height: input.naturalHeight };
  }
  return { width: input.width, height: input.height };
}

function presenceFromLandmarks(
  landmarks: readonly { x: number; y: number }[] | undefined,
  width: number,
  height: number
): FacePresence {
  if (!landmarks || landmarks.length === 0 || width <= 0 || height <= 0) {
    return { detected: false, box: null, fivePoints: null };
  }

  const fivePoints = toFivePointsFromMediaPipe(landmarks, width, height);
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return {
    detected: true,
    box: {
      x: minX * width,
      y: minY * height,
      width: (maxX - minX) * width,
      height: (maxY - minY) * height,
    },
    fivePoints,
  };
}

export function detectMediaPipePresence(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): FacePresence {
  if (!landmarker) {
    return { detected: false, box: null, fivePoints: null };
  }
  const { width, height } = sourceSize(input);
  if (input instanceof HTMLVideoElement && input.readyState < 2) {
    return { detected: false, box: null, fivePoints: null };
  }
  const result = landmarker.detect(input);
  return presenceFromLandmarks(result.faceLandmarks[0], width, height);
}
