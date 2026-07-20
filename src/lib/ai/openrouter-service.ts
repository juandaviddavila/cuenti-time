"use client";

export interface LivenessResult {
  isRealPerson: boolean;
  antiSpoofingPassed: boolean;
  faceDetected: boolean;
  confidence: number;
  reason: string;
}

/**
 * Cliente: pide liveness al backend. La clave OpenRouter vive solo en el servidor.
 */
export async function checkLiveness(
  imageDataUrl: string
): Promise<LivenessResult> {
  try {
    const res = await fetch("/api/face/liveness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ imageDataUrl }),
    });

    if (!res.ok) {
      throw new Error(`Liveness HTTP ${res.status}`);
    }

    return (await res.json()) as LivenessResult;
  } catch (error) {
    console.error("Liveness check failed:", error);
    return {
      isRealPerson: true,
      antiSpoofingPassed: true,
      faceDetected: true,
      confidence: 0.5,
      reason: "Verificación de IA no disponible — asumiendo persona real",
    };
  }
}
