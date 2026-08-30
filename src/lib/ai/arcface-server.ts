/**
 * ArcFace en el servidor (Fase 2) con onnxruntime-node.
 * SOLO servidor: nunca importar desde componentes "use client".
 * Mismo modelo y normalización que el cliente (w600k_mbf, 512-D),
 * así los vectores son comparables en pgvector.
 */
import path from "node:path";
import type * as Ort from "onnxruntime-node";

const ARCFACE_INPUT_SIZE = 112;
const ARCFACE_EMBEDDING_SIZE = 512;
const PIXEL_MEAN = 127.5;
const PIXEL_SCALE = 1 / 127.5;

let ortPromise: Promise<typeof Ort> | null = null;
let sessionPromise: Promise<Ort.InferenceSession> | null = null;

function getOrt(): Promise<typeof Ort> {
  if (!ortPromise) ortPromise = import("onnxruntime-node");
  return ortPromise;
}

async function getSession(): Promise<Ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await getOrt();
      const modelPath = path.join(
        process.cwd(),
        "public",
        "models",
        "w600k_mbf.onnx"
      );
      return ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
      });
    })();
  }
  return sessionPromise;
}

/**
 * Recibe bytes RGBA crudos del crop alineado 112x112 y devuelve el
 * descriptor 512-D normalizado a norma 1.
 */
export async function embedAlignedRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Promise<number[]> {
  if (width !== ARCFACE_INPUT_SIZE || height !== ARCFACE_INPUT_SIZE) {
    throw new Error(
      `Crop alineado debe ser ${ARCFACE_INPUT_SIZE}x${ARCFACE_INPUT_SIZE}, llegó ${width}x${height}`
    );
  }
  const pixelCount = width * height;
  if (rgba.length < pixelCount * 4) {
    throw new Error("Bytes RGBA insuficientes para el crop alineado");
  }

  const session = await getSession();
  const tensor = new Float32Array(3 * pixelCount);
  const greenOffset = pixelCount;
  const blueOffset = pixelCount * 2;

  for (let i = 0; i < pixelCount; i++) {
    const source = i * 4;
    tensor[i] = (rgba[source] - PIXEL_MEAN) * PIXEL_SCALE;
    tensor[greenOffset + i] = (rgba[source + 1] - PIXEL_MEAN) * PIXEL_SCALE;
    tensor[blueOffset + i] = (rgba[source + 2] - PIXEL_MEAN) * PIXEL_SCALE;
  }

  const ort = await getOrt();
  const input = new ort.Tensor("float32", tensor, [
    1,
    3,
    ARCFACE_INPUT_SIZE,
    ARCFACE_INPUT_SIZE,
  ]);
  const outputs = await session.run({ [session.inputNames[0]]: input });
  const raw = outputs[session.outputNames[0]].data as Float32Array;

  if (raw.length !== ARCFACE_EMBEDDING_SIZE) {
    throw new Error(
      `ArcFace devolvió ${raw.length} dimensiones, se esperaban ${ARCFACE_EMBEDDING_SIZE}`
    );
  }

  let sumOfSquares = 0;
  for (let i = 0; i < raw.length; i++) sumOfSquares += raw[i] * raw[i];
  const norm = Math.sqrt(sumOfSquares);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("El embedding facial resultó degenerado");
  }
  return Array.from(raw, (value) => value / norm);
}
