import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { verifyVerificationCode } from "@/lib/verification-code";
import { createAuthenticatedLoginResponse } from "@/lib/login-session";

const verifyLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // Clients sometimes send OTP as JSON number; coerce to string.
  code: z.coerce
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = rateLimit(`login-verify:${ip}`, { limit: 10, windowMs: 15 * 60_000 });
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

  const parsed = verifyLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        avatar: true,
        status: true,
        bypassGeofence: true,
        canManageIntegrations: true,
        createdAt: true,
        emailVerifiedAt: true,
        loginOtpHash: true,
        loginOtpExpiresAt: true,
      },
    });

    if (!user || user.status === "INACTIVE" || !user.emailVerifiedAt) {
      return NextResponse.json({ error: "Código inválido o vencido" }, { status: 400 });
    }

    if (
      !user.loginOtpHash ||
      !user.loginOtpExpiresAt ||
      user.loginOtpExpiresAt <= new Date()
    ) {
      return NextResponse.json(
        { error: "El código venció. Inicia sesión de nuevo para recibir uno nuevo." },
        { status: 400 }
      );
    }

    const valid = await verifyVerificationCode(code, user.loginOtpHash);
    if (!valid) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }

    return createAuthenticatedLoginResponse(user);
  } catch (error) {
    console.error("Login verify error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
