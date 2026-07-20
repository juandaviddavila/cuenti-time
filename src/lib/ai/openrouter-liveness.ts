/**
 * Liveness vía OpenRouter — SOLO servidor.
 * La API key NUNCA debe llevar prefijo NEXT_PUBLIC_.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.0-flash-001";

export interface LivenessResult {
  isRealPerson: boolean;
  antiSpoofingPassed: boolean;
  faceDetected: boolean;
  confidence: number;
  reason: string;
}

function simulatedLiveness(reason: string): LivenessResult {
  return {
    isRealPerson: true,
    antiSpoofingPassed: true,
    faceDetected: true,
    confidence: 0.85,
    reason,
  };
}

export async function checkLivenessWithOpenRouter(
  imageDataUrl: string
): Promise<LivenessResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return simulatedLiveness("Liveness simulado (sin API key configurada)");
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578",
        "X-Title": "cuenti time",
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a liveness detection AI. Analyze the image and determine if there is a real person in front of a camera, or if it's a photo, screen, or mask. Respond ONLY with JSON.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Analyze this camera frame. Return JSON: {"faceDetected": boolean, "isRealPerson": boolean, "antiSpoofingPassed": boolean, "confidence": number 0-1, "reason": "brief explanation in Spanish"}. Consider: is it a printed photo? a screen? a mask? good lighting? face centered?',
              },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const parsed = JSON.parse(content) as LivenessResult;

    return {
      isRealPerson: parsed.isRealPerson ?? false,
      antiSpoofingPassed: parsed.antiSpoofingPassed ?? false,
      faceDetected: parsed.faceDetected ?? false,
      confidence: parsed.confidence ?? 0,
      reason: parsed.reason ?? "Sin descripción",
    };
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
