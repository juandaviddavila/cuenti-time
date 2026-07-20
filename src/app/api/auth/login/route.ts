import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, loginCodeEmailHtml } from "@/lib/email";
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashVerificationCode,
} from "@/lib/verification-code";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = rateLimit(`login:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo en 1 minuto." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    const dummyHash =
      "$2b$12$invalidhashtopreventtimingattacksonuserenumeration00000";
    const passwordValid = await bcrypt.compare(
      password,
      user?.password ?? dummyHash
    );

    if (!user || user.status === "INACTIVE" || !passwordValid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        {
          error: "Debes verificar tu correo antes de iniciar sesión",
          code: "EMAIL_NOT_VERIFIED",
          email: user.email,
        },
        { status: 403 }
      );
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
      requiresLoginCode: true,
      message: "Te enviamos un código de 6 dígitos a tu correo.",
      email: user.email,
      ...(process.env.NODE_ENV === "development" ? { devCode: loginCode } : {}),
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
