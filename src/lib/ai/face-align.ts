"use client";

/**
 * Alineación canónica de rostros para ArcFace.
 *
 * ArcFace fue entrenado sobre recortes deformados a una plantilla fija de 112x112.
 * Pasarle un recorte cuadrado sin esta transformación degrada la precisión de forma
 * notable, así que este paso no es opcional.
 */

export const ARCFACE_INPUT_SIZE = 112;

/** Plantilla canónica de 5 puntos de InsightFace para salida de 112x112. */
const ARCFACE_TEMPLATE: readonly Point[] = [
  { x: 38.2946, y: 51.6963 }, // ojo lado izquierdo de la imagen
  { x: 73.5318, y: 51.5014 }, // ojo lado derecho de la imagen
  { x: 56.0252, y: 71.7366 }, // punta de la nariz
  { x: 41.5493, y: 92.3655 }, // comisura izquierda de la boca
  { x: 70.7299, y: 92.2041 }, // comisura derecha de la boca
];

/**
 * Índices del esquema iBUG-68 que produce face-api.
 * 36-41 y 48 caen en el lado izquierdo de la imagen; 42-47 y 54 en el derecho,
 * que es el mismo orden que espera la plantilla de InsightFace.
 */
const LEFT_EYE_INDICES = [36, 37, 38, 39, 40, 41] as const;
const RIGHT_EYE_INDICES = [42, 43, 44, 45, 46, 47] as const;
const NOSE_TIP_INDEX = 30;
const MOUTH_LEFT_INDEX = 48;
const MOUTH_RIGHT_INDEX = 54;

export interface Point {
  x: number;
  y: number;
}

/**
 * Matriz de transformación de similitud en el orden que consume
 * `CanvasRenderingContext2D.setTransform`.
 */
export interface SimilarityTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

function centroid(points: readonly Point[], indices: readonly number[]): Point {
  let sumX = 0;
  let sumY = 0;
  for (const index of indices) {
    sumX += points[index].x;
    sumY += points[index].y;
  }
  return { x: sumX / indices.length, y: sumY / indices.length };
}

/** Reduce los 68 landmarks de face-api a los 5 puntos que usa ArcFace. */
export function toFivePoints(positions: readonly Point[]): Point[] | null {
  if (positions.length < 68) return null;

  return [
    centroid(positions, LEFT_EYE_INDICES),
    centroid(positions, RIGHT_EYE_INDICES),
    positions[NOSE_TIP_INDEX],
    positions[MOUTH_LEFT_INDEX],
    positions[MOUTH_RIGHT_INDEX],
  ];
}

/**
 * MediaPipe Face Landmarker (478 o 468 puntos, coords normalizadas 0–1).
 * Orden InsightFace: ojo izq. de la imagen, ojo der., nariz, comisura izq., der.
 * "Izquierda/derecha" es de la imagen (persona de frente: 33/473 = der. del sujeto).
 */
export function toFivePointsFromMediaPipe(
  landmarks: readonly Point[],
  width: number,
  height: number
): Point[] | null {
  if (landmarks.length < 292 || width <= 0 || height <= 0) return null;

  const pixel = (index: number): Point => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height,
  });

  const hasIris = landmarks.length >= 478;
  return [
    hasIris ? pixel(473) : pixel(33),
    hasIris ? pixel(468) : pixel(263),
    pixel(1),
    pixel(61),
    pixel(291),
  ];
}

/**
 * Solución de mínimos cuadrados para la transformación de similitud 2D
 * (rotación + escala uniforme + traslación, sin reflexión ni cizalladura).
 *
 * Forma cerrada de Procrustes: al restringirse a similitud, el sistema es lineal
 * en (a, b, tx, ty) y no hace falta SVD.
 *
 *   u = a*x - b*y + tx
 *   v = b*x + a*y + ty
 */
export function estimateSimilarityTransform(
  source: readonly Point[],
  target: readonly Point[]
): SimilarityTransform | null {
  const n = source.length;
  if (n < 2 || n !== target.length) return null;

  let meanSrcX = 0;
  let meanSrcY = 0;
  let meanDstX = 0;
  let meanDstY = 0;

  for (let i = 0; i < n; i++) {
    meanSrcX += source[i].x;
    meanSrcY += source[i].y;
    meanDstX += target[i].x;
    meanDstY += target[i].y;
  }
  meanSrcX /= n;
  meanSrcY /= n;
  meanDstX /= n;
  meanDstY /= n;

  let numeratorA = 0;
  let numeratorB = 0;
  let srcVariance = 0;

  for (let i = 0; i < n; i++) {
    const dx = source[i].x - meanSrcX;
    const dy = source[i].y - meanSrcY;
    const du = target[i].x - meanDstX;
    const dv = target[i].y - meanDstY;

    numeratorA += dx * du + dy * dv;
    numeratorB += dx * dv - dy * du;
    srcVariance += dx * dx + dy * dy;
  }

  if (srcVariance <= Number.EPSILON) return null;

  const a = numeratorA / srcVariance;
  const b = numeratorB / srcVariance;

  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  return {
    a,
    b,
    c: -b,
    d: a,
    e: meanDstX - (a * meanSrcX - b * meanSrcY),
    f: meanDstY - (b * meanSrcX + a * meanSrcY),
  };
}

/**
 * Recorta y alinea el rostro a 112x112 sobre un canvas.
 *
 * Canvas 2D aplica exactamente una transformación afín, y una similitud es un caso
 * particular de ella, así que el warp sale gratis sin dependencias externas.
 */
export function alignFaceToCanvasFromFivePoints(
  input: CanvasImageSource,
  fivePoints: readonly Point[],
  size: number = ARCFACE_INPUT_SIZE
): HTMLCanvasElement | null {
  if (fivePoints.length < 5) return null;

  const scale = size / ARCFACE_INPUT_SIZE;
  const template = ARCFACE_TEMPLATE.map((point) => ({
    x: point.x * scale,
    y: point.y * scale,
  }));

  const transform = estimateSimilarityTransform(fivePoints, template);
  if (!transform) return null;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.setTransform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f
  );
  context.drawImage(input, 0, 0);

  return canvas;
}

export function alignFaceToCanvas(
  input: CanvasImageSource,
  positions: readonly Point[],
  size: number = ARCFACE_INPUT_SIZE
): HTMLCanvasElement | null {
  const fivePoints = toFivePoints(positions);
  if (!fivePoints) return null;
  return alignFaceToCanvasFromFivePoints(input, fivePoints, size);
}
