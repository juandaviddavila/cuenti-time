import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { createAuthenticatedLoginResponse } from "@/lib/login-session";
import { issueLoginOtp } from "@/lib/login-otp";
import { normalizeToE164 } from "@/lib/phone/e164";

const loginSchema = z
  .object({
    method: z.enum(["password", "email_code", "whatsapp"]).default("password"),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    password: z.string().min(1).max(128).optional(),
    phoneE164: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === "whatsapp") {
      if (!normalizeToE164(data.phoneE164)) {
        ctx.addIssue({
          code: "custom",
          path: ["phoneE164"],
          message: "Ingresa un celular válido",
        });
      }
      return;
    }
    if (!data.email) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "El correo es requerido",
      });
    }
    if (data.method === "password" && !data.password) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "La contraseña es requerida",
      });
    }
  });

const LOGIN_WITHOUT_OTP_ROLES = new Set(["FACE_REGISTRAR"]);

const userSelect = {
  id: true,
  name: true,
  email: true,
  phoneE164: true,
  password: true,
  status: true,
  emailVerifiedAt: true,
  role: true,
  companyId: true,
  avatar: true,
  bypassGeofence: true,
  canManageIntegrations: true,
  createdAt: true,
} as const;

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
  const phoneE164 = normalizeToE164(parsed.data.phoneE164);

  try {
    const user =
      method === "whatsapp"
        ? await prisma.user.findUnique({
            where: { phoneE164: phoneE164 ?? "__none__" },
            select: userSelect,
          })
        : await prisma.user.findUnique({
            where: { email: email ?? "" },
            select: userSelect,
          });

    if (method === "whatsapp") {
      if (!user) {
        return NextResponse.json(
          { error: "El celular no está registrado", code: "PHONE_NOT_FOUND" },
          { status: 404 }
        );
      }
      if (user.status === "INACTIVE") {
        return NextResponse.json(
          { error: "Esta cuenta está inactiva", code: "ACCOUNT_INACTIVE" },
          { status: 403 }
        );
      }

      const payload = await issueLoginOtp({ user, channel: "whatsapp" });
      if (!payload.ok) {
        return NextResponse.json({ error: payload.error }, { status: payload.status });
      }
      return NextResponse.json(payload);
    }

    if (method === "email_code") {
      if (!user) {
        return NextResponse.json(
          { error: "El correo no está registrado", code: "EMAIL_NOT_FOUND" },
          { status: 404 }
        );
      }
      if (user.status === "INACTIVE") {
        return NextResponse.json(
          { error: "Esta cuenta está inactiva", code: "ACCOUNT_INACTIVE" },
          { status: 403 }
        );
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

      const payload = await issueLoginOtp({ user, channel: "email" });
      if (!payload.ok) {
        return NextResponse.json({ error: payload.error }, { status: payload.status });
      }
      return NextResponse.json(payload);
    }

    const dummyHash =
      "$2b$12$invalidhashtopreventtimingattacksonuserenumeration00000";
    const passwordValid = await bcrypt.compare(
      password ?? "",
      user?.password ?? dummyHash
    );

    if (!user) {
      return NextResponse.json(
        { error: "El correo no está registrado", code: "EMAIL_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (user.status === "INACTIVE") {
      return NextResponse.json(
        { error: "Esta cuenta está inactiva", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }
    if (!passwordValid) {
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

    if (LOGIN_WITHOUT_OTP_ROLES.has(user.role)) {
      return createAuthenticatedLoginResponse(user);
    }

    const payload = await issueLoginOtp({ user, channel: "email" });
    if (!payload.ok) {
      return NextResponse.json({ error: payload.error }, { status: payload.status });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
