import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, verificationCodeEmailHtml } from "@/lib/email";
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashVerificationCode,
} from "@/lib/verification-code";

const resendSchema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = rateLimit(`resend-verification:${ip}`, { limit: 3, windowMs: 15 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos antes de reenviar." },
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
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  const { email } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerifiedAt: true },
    });

    // Respuesta genérica para no revelar si el correo existe
    if (!user || user.emailVerifiedAt) {
      return NextResponse.json({
        message: "Si el correo está pendiente de verificación, enviamos un nuevo código.",
      });
    }

    const code = generateVerificationCode();
    const hashedCode = await hashVerificationCode(code);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedCode,
        emailVerificationExpiresAt: getVerificationExpiry(),
      },
    });

    await sendEmail({
      to: email,
      subject: "Tu código de verificación — cuenti time",
      html: verificationCodeEmailHtml(user.name, code),
    });

    return NextResponse.json({
      message: "Si el correo está pendiente de verificación, enviamos un nuevo código.",
      ...(process.env.NODE_ENV === "development" ? { devCode: code } : {}),
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
