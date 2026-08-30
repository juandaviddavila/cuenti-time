"use client";

import {
  ARCFACE_INPUT_SIZE,
  alignFaceToCanvas,
  alignFaceToCanvasFromFivePoints,
  type Point,
} from "@/lib/ai/face-align";

/**
 * Embedding facial ArcFace (identidad). No usar para comparar prendas ni cuerpo
 * entero: el modelo ignora outfit a propósito y solo ve el recorte 112×112 de cara.
 * Alertas de cambio de ropa → pipeline aparte (`docs/clothing-checkout-alert.md`).
 *
 * onnxruntime-web se carga **fuera del bundler**, como módulo ESM nativo servido
 * desde `public/ort/`.
 *
 * Pasarlo por webpack no es viable: la librería usa `import.meta.url` en runtime
 * para localizar su binario WASM, webpack lo reescribe a una ruta `file://`
 * estática y emite el `.mjs` como asset, y ahí Terser falla al minificarlo como
 * script clásico. Desactivar `parser.javascript.importMeta` lo arregla para ORT
 * pero rompe a cualquier otra dependencia con `import.meta` (zustand, entre
 * otras). `webpackIgnore` deja la importación intacta y el navegador la resuelve.
 * https://github.com/microsoft/onnxruntime/issues/22113
 *
 * WebGPU no está disponible en este build, que registra solo `cpu` y `wasm`.
 * MobileFaceNet resuelve en decenas de milisegundos en CPU, muy por debajo del
 * intervalo de detección del kiosco. Habilitarlo exigiría el bundle `webgpu` y el
 * binario `*.jsep.wasm`, 26 MB frente a 13.
 */
type OrtModule = typeof import("onnxruntime-web/wasm");
type OrtSession = Awaited<ReturnType<OrtModule["InferenceSession"]["create"]>>;

/** Dimensiones del embedding que produce w600k_mbf (ArcFace MobileFaceNet). */
export const ARCFACE_EMBEDDING_SIZE = 512;

const MODEL_URL = "/models/w600k_mbf.onnx";

/**
 * Forma de objeto a propósito: con solo `wasm` definido, ORT usa el glue JS que
 * ya trae empaquetado el bundle y únicamente descarga el binario desde esta URL.
 * Un prefijo en string haría que además fuera a buscar el `.mjs` por separado.
 */
const WASM_PATHS = { wasm: "/ort/ort-wasm-simd-threaded.wasm" };

/** Normalización con la que se entrenó ArcFace: (px - 127.5) / 127.5. */
const PIXEL_MEAN = 127.5;
const PIXEL_SCALE = 1 / 127.5;

let session: OrtSession | null = null;
let loadingPromise: Promise<OrtSession> | null = null;
let activeBackend: string | null = null;

async function loadOrt(): Promise<OrtModule> {
  // TypeScript resuelve los especificadores que empiezan por "/" como rutas de
  // archivo, así que no admite una declaración ambiente para este módulo.
  // @ts-expect-error -- servido en runtime desde public/, no resoluble en build
  const ort: OrtModule = await import(/* webpackIgnore: true */ "/ort/ort.wasm.bundle.min.mjs");

  ort.env.wasm.wasmPaths = WASM_PATHS;
  // Los hilos requieren SharedArrayBuffer, que solo existe bajo COOP/COEP.
  // Sin aislamiento cross-origin, pedir más de un hilo hace fallar la carga.
  ort.env.wasm.numThreads =
    typeof self !== "undefined" && self.crossOriginIsolated
      ? Math.min(4, navigator.hardwareConcurrency || 1)
      : 1;

  return ort;
}

/**
 * Carga el modelo y ejecuta una inferencia de calentamiento para absorber la
 * compilación del módulo WASM antes de que haya alguien frente a la cámara.
 */
export async function loadArcFaceModel(): Promise<OrtSession> {
  if (session) return session;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ort = await loadOrt();

    const created = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    activeBackend = "wasm";

    const warmupInput = new ort.Tensor(
      "float32",
      new Float32Array(3 * ARCFACE_INPUT_SIZE * ARCFACE_INPUT_SIZE),
      [1, 3, ARCFACE_INPUT_SIZE, ARCFACE_INPUT_SIZE]
    );
    await created.run({ [created.inputNames[0]]: warmupInput });

    session = created;
    return created;
  })();

  try {
    return await loadingPromise;
  } catch (error) {
    loadingPromise = null;
    throw error;
  }
}

export function isArcFaceLoaded(): boolean {
  return session !== null;
}

/** Backend en uso, para diagnóstico y benchmarks. */
export function getArcFaceBackend(): string | null {
  return activeBackend;
}

/**
 * Convierte el canvas alineado a un tensor NCHW en RGB.
 * getImageData entrega RGBA intercalado (HWC), así que hay que transponer.
 */
function canvasToTensorData(canvas: HTMLCanvasElement): Float32Array {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("No se pudo obtener el contexto 2D del canvas alineado");
  }

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const pixelCount = width * height;
  const tensor = new Float32Array(3 * pixelCount);

  const greenOffset = pixelCount;
  const blueOffset = pixelCount * 2;

  for (let i = 0; i < pixelCount; i++) {
    const source = i * 4;
    tensor[i] = (data[source] - PIXEL_MEAN) * PIXEL_SCALE;
    tensor[greenOffset + i] = (data[source + 1] - PIXEL_MEAN) * PIXEL_SCALE;
    tensor[blueOffset + i] = (data[source + 2] - PIXEL_MEAN) * PIXEL_SCALE;
  }

  return tensor;
}

/** Normaliza a norma 1 para que la distancia coseno sea comparable entre vectores. */
function l2Normalize(vector: Float32Array): number[] {
  let sumOfSquares = 0;
  for (let i = 0; i < vector.length; i++) {
    sumOfSquares += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumOfSquares);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("El embedding facial resultó degenerado");
  }

  const normalized = new Array<number>(vector.length);
  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i] / norm;
  }
  return normalized;
}

/** Ejecuta ArcFace sobre un rostro ya alineado a 112x112. */
export async function embedAlignedFace(
  alignedCanvas: HTMLCanvasElement
): Promise<number[]> {
  const active = await loadArcFaceModel();
  const ort = await loadOrt();

  const input = new ort.Tensor("float32", canvasToTensorData(alignedCanvas), [
    1,
    3,
    ARCFACE_INPUT_SIZE,
    ARCFACE_INPUT_SIZE,
  ]);

  const outputs = await active.run({ [active.inputNames[0]]: input });
  const output = outputs[active.outputNames[0]];
  const raw = output.data;

  if (!(raw instanceof Float32Array)) {
    throw new Error("Salida inesperada del modelo ArcFace");
  }
  if (raw.length !== ARCFACE_EMBEDDING_SIZE) {
    throw new Error(
      `ArcFace devolvió ${raw.length} dimensiones, se esperaban ${ARCFACE_EMBEDDING_SIZE}`
    );
  }

  return l2Normalize(raw);
}

/**
 * Alinea con 68 landmarks (face-api legacy) y devuelve el embedding de 512.
 * Null si los landmarks no permiten estimar la transformación.
 */
export async function embedFaceFromLandmarks(
  input: CanvasImageSource,
  positions: readonly Point[]
): Promise<number[] | null> {
  const aligned = alignFaceToCanvas(input, positions);
  if (!aligned) return null;
  return embedAlignedFace(aligned);
}

/** Alinea con los 5 puntos canónicos (MediaPipe u otra fuente) y embebe. */
export async function embedFaceFromFivePoints(
  input: CanvasImageSource,
  fivePoints: readonly Point[]
): Promise<number[] | null> {
  const aligned = alignFaceToCanvasFromFivePoints(input, fivePoints);
  if (!aligned) return null;
  return embedAlignedFace(aligned);
}
