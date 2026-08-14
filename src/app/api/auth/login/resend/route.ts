import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { issueLoginOtp } from "@/lib/login-otp";
import { normalizeToE164 } from "@/lib/phone/e164";

const resendSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    phoneE164: z.string().optional(),
    channel: z.enum(["email", "whatsapp"]).optional(),
  })
  .refine((data) => Boolean(data.email) || Boolean(normalizeToE164(data.phoneE164)), {
    message: "Correo o celular requerido",
  });

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = rateLimit(`login-resend:${ip}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const phoneE164 = normalizeToE164(parsed.data.phoneE164);
  const channel = parsed.data.channel ?? (phoneE164 ? "whatsapp" : "email");

  try {
    const user = phoneE164
      ? await prisma.user.findUnique({
          where: { phoneE164 },
          select: {
            id: true,
            name: true,
            email: true,
            phoneE164: true,
            status: true,
            emailVerifiedAt: true,
            role: true,
          },
        })
      : await prisma.user.findUnique({
          where: { email: parsed.data.email ?? "" },
          select: {
            id: true,
            name: true,
            email: true,
            phoneE164: true,
            status: true,
            emailVerifiedAt: true,
            role: true,
          },
        });

    if (!user || user.status === "INACTIVE") {
      return NextResponse.json({
        message: "Si hay un inicio de sesión pendiente, enviaremos un nuevo código.",
      });
    }

    if (
      channel === "email" &&
      !user.emailVerifiedAt &&
      user.role !== "FACE_REGISTRAR"
    ) {
      return NextResponse.json({
        message: "Si hay un inicio de sesión pendiente, enviaremos un nuevo código.",
      });
    }

    const payload = await issueLoginOtp({ user, channel });
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: payload.status });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Login resend error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
