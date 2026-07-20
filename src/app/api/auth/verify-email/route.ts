import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { verifyVerificationCode } from "@/lib/verification-code";

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
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

  const rl = rateLimit(`verify-email:${ip}`, { limit: 10, windowMs: 15 * 60_000 });
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

  const parsed = verifySchema.safeParse(body);
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
        emailVerifiedAt: true,
        emailVerificationToken: true,
        emailVerificationExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Código inválido o vencido" }, { status: 400 });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ message: "El correo ya está verificado" });
    }

    if (
      !user.emailVerificationToken ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt <= new Date()
    ) {
      return NextResponse.json(
        { error: "El código venció. Solicita uno nuevo." },
        { status: 400 }
      );
    }

    const valid = await verifyVerificationCode(code, user.emailVerificationToken);
    if (!valid) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    return NextResponse.json({
      message: "Correo verificado correctamente. Ya puedes iniciar sesión.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
