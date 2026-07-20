import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, loginCodeEmailHtml } from "@/lib/email";
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashVerificationCode,
} from "@/lib/verification-code";

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
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
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  const { email } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        loginOtpHash: true,
      },
    });

    if (
      !user ||
      user.status === "INACTIVE" ||
      !user.emailVerifiedAt ||
      !user.loginOtpHash
    ) {
      return NextResponse.json({
        message: "Si hay un inicio de sesión pendiente, enviaremos un nuevo código.",
      });
    }

    const loginCode = generateVerificationCode();
    const loginOtpHash = await hashVerificationCode(loginCode);
    const loginOtpExpiresAt = getVerificationExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: { loginOtpHash, loginOtpExpiresAt },
    });

    await sendEmail({
      to: user.email,
      subject: "Tu código de acceso — cuenti time",
      html: loginCodeEmailHtml(user.name, loginCode),
    });

    return NextResponse.json({
      message: "Código reenviado a tu correo.",
      ...(process.env.NODE_ENV === "development" ? { devCode: loginCode } : {}),
    });
  } catch (error) {
    console.error("Login resend error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
