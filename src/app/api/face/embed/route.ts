import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { embedAlignedRgba } from "@/lib/ai/arcface-server";
import { requireSession } from "@/lib/server-auth";
import { rateLimit } from "@/lib/rate-limit";

const MAX_CROP_BASE64_LENGTH = 70_000;

const embedSchema = z.object({
  cropBase64: z
    .string()
    .min(100)
    .max(MAX_CROP_BASE64_LENGTH)
    .refine(
      (value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value),
      "Base64 inválido"
    ),
  width: z.literal(112),
  height: z.literal(112),
});

export async function POST(request: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const limited = rateLimit(`face-embed:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta en un momento." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = embedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(parsed.data.cropBase64, "base64");
    const descriptor = await embedAlignedRgba(
      new Uint8Array(buffer),
      parsed.data.width,
      parsed.data.height
    );
    return NextResponse.json({ descriptor, normalized: true });
  } catch (error) {
    console.error("POST /api/face/embed error:", error);
    return NextResponse.json(
      { error: "No se pudo calcular el embedding facial" },
      { status: 500 }
    );
  }
}
