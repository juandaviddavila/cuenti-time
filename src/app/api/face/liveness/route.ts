import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkLivenessWithOpenRouter } from "@/lib/ai/openrouter-liveness";

const bodySchema = z.object({
  imageDataUrl: z
    .string()
    .min(1)
    .max(5_000_000)
    .refine(
      (v) => v.startsWith("data:image/"),
      "imageDataUrl debe ser data:image/…"
    ),
});

/**
 * Proxy de liveness: el cliente envía la foto; el servidor habla con OpenRouter.
 * La API key nunca llega al navegador.
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const limited = rateLimit(`liveness:${session.userId}:${ip}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Demasiadas verificaciones. Intenta en un momento." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await checkLivenessWithOpenRouter(parsed.data.imageDataUrl);
  return NextResponse.json(result);
}
