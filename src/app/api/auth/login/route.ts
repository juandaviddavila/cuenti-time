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
import { createAuthenticatedLoginResponse } from "@/lib/login-session";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  /** password = email+contraseña (y OTP salvo FACE_REGISTRAR); email_code = solo correo + código */
  method: z.enum(["password", "email_code"]).default("password"),
  password: z.string().min(1).max(128).optional(),
}).superRefine((data, ctx) => {
  if (data.method === "password" && !data.password) {
    ctx.addIssue({
      code: "custom",
      path: ["password"],
      message: "La contraseña es requerida",
    });
  }
});

/** Roles que, con contraseña, inician sesión sin OTP por correo. */
const LOGIN_WITHOUT_OTP_ROLES = new Set(["FACE_REGISTRAR"]);

async function issueLoginCode(user: { id: bigint; name: string; email: string }) {
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

  return {
    requiresLoginCode: true as const,
    message: "Te enviamos un código de 6 dígitos a tu correo.",
    email: user.email,
    ...(process.env.NODE_ENV === "development" ? { devCode: loginCode } : {}),
  };
}

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

  const { email, password, method } = parsed.data;

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
        role: true,
        companyId: true,
        avatar: true,
        bypassGeofence: true,
        canManageIntegrations: true,
        createdAt: true,
      },
    });

    // ── Login solo con código al correo ────────────────────────────────────
    if (method === "email_code") {
      // Respuesta genérica si no existe / inactivo (evita enumeración)
      if (!user || user.status === "INACTIVE") {
        return NextResponse.json({
          requiresLoginCode: true,
          message: "Si el correo está registrado, te enviamos un código de 6 dígitos.",
          email,
        });
      }

      if (!user.emailVerifiedAt && !LOGIN_WITHOUT_OTP_ROLES.has(user.role)) {
        return NextResponse.json(
          {
            error: "Debes verificar tu correo antes de iniciar sesión",
            code: "EMAIL_NOT_VERIFIED",
            email: user.email,
          },
          { status: 403 }
        );
      }

      const payload = await issueLoginCode(user);
      return NextResponse.json(payload);
    }

    // ── Login con contraseña ───────────────────────────────────────────────
    const dummyHash =
      "$2b$12$invalidhashtopreventtimingattacksonuserenumeration00000";
    const passwordValid = await bcrypt.compare(
      password ?? "",
      user?.password ?? dummyHash
    );

    if (!user || user.status === "INACTIVE" || !passwordValid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    if (!user.emailVerifiedAt && !LOGIN_WITHOUT_OTP_ROLES.has(user.role)) {
      return NextResponse.json(
        {
          error: "Debes verificar tu correo antes de iniciar sesión",
          code: "EMAIL_NOT_VERIFIED",
          email: user.email,
        },
        { status: 403 }
      );
    }

    // Registrador facial: login directo sin código por correo
    if (LOGIN_WITHOUT_OTP_ROLES.has(user.role)) {
      return createAuthenticatedLoginResponse(user);
    }

    const payload = await issueLoginCode(user);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
