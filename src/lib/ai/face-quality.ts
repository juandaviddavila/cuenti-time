"use client";

import type { Point } from "@/lib/ai/face-align";

export type ExpectedTurn = "left" | "right" | null;

export interface FaceQualityReport {
  ok: boolean;
  sharpness: number;
  luminance: number;
  rollDeg: number;
  /** Asimetría horizontal nariz/ojos con signo: >0 gira a SU izquierda. */
  yawAsymmetry: number;
  issues: string[];
}

const SHARPNESS_MIN = 40;
const LUMINANCE_MIN = 35;
const LUMINANCE_MAX = 225;
const ROLL_MAX_DEG = 15;
const FRONTAL_YAW_MAX = 0.16;
const TURN_YAW_MIN = 0.08;

function readGrayStats(canvas: HTMLCanvasElement): {
  gray: Float32Array;
  width: number;
  height: number;
} {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { gray: new Float32Array(0), width: 0, height: 0 };
  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return { gray, width, height };
}

/** Varianza del Laplaciano: proxy de nitidez (bajo = borroso/movido). */
export function measureSharpness(canvas: HTMLCanvasElement): number {
  const { gray, width, height } = readGrayStats(canvas);
  if (width < 3 || height < 3 || gray.length === 0) return 0;

  let sum = 0;
  let count = 0;
  const values: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const laplacian =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      values.push(laplacian);
      sum += laplacian;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  let variance = 0;
  for (const value of values) variance += (value - mean) * (value - mean);
  return variance / count;
}

export function measureLuminance(canvas: HTMLCanvasElement): number {
  const { gray } = readGrayStats(canvas);
  if (gray.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

export function measureRollDeg(fivePoints: readonly Point[]): number {
  const [leftEye, rightEye] = fivePoints;
  return (
    (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) /
    Math.PI
  );
}

/** >0 el rostro gira a SU izquierda (nariz hacia la derecha de la imagen). */
export function measureYawAsymmetry(fivePoints: readonly Point[]): number {
  const [leftEye, rightEye, nose] = fivePoints;
  const dLeft = Math.abs(nose.x - leftEye.x);
  const dRight = Math.abs(rightEye.x - nose.x);
  const total = dLeft + dRight;
  if (total <= 0) return 0;
  return (dLeft - dRight) / total;
}

export function evaluateAlignedFace(
  alignedCanvas: HTMLCanvasElement,
  fivePoints: readonly Point[],
  expectTurn: ExpectedTurn = null
): FaceQualityReport {
  const issues: string[] = [];

  const sharpness = measureSharpness(alignedCanvas);
  if (sharpness < SHARPNESS_MIN) issues.push("Rostro borroso — manténgase quieto");

  const luminance = measureLuminance(alignedCanvas);
  if (luminance < LUMINANCE_MIN) issues.push("Muy oscuro — mejore la iluminación");
  if (luminance > LUMINANCE_MAX) issues.push("Demasiada luz — evite contraluz");

  const rollDeg = measureRollDeg(fivePoints);
  if (Math.abs(rollDeg) > ROLL_MAX_DEG) issues.push("Enderece la cabeza");

  const yawAsymmetry = measureYawAsymmetry(fivePoints);
  if (expectTurn === null) {
    if (Math.abs(yawAsymmetry) > FRONTAL_YAW_MAX) {
      issues.push("Mire de frente al cámara");
    }
  } else if (expectTurn === "left") {
    if (yawAsymmetry < TURN_YAW_MIN) {
      issues.push("Gire levemente el rostro a su izquierda");
    }
  } else if (yawAsymmetry > -TURN_YAW_MIN) {
    issues.push("Gire levemente el rostro a su derecha");
  }

  return {
    ok: issues.length === 0,
    sharpness,
    luminance,
    rollDeg,
    yawAsymmetry,
    issues,
  };
}
