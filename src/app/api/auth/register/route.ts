import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, verificationCodeEmailHtml } from "@/lib/email";
import { getBillingConfig } from "@/lib/billing/config";
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashVerificationCode,
} from "@/lib/verification-code";

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(254).toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(128)
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  companyLegalName: z.string().min(2).max(200).trim(),
  companyTaxId: z.string().min(5).max(30).trim(),
});

export async function POST(request: NextRequest) {
  // ── Rate limiting: 5 registrations per 15 minutes per IP ──────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = rateLimit(`register:${ip}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos de registro. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }

  // ── Input validation ──────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, password, companyLegalName, companyTaxId } =
    parsed.data;

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "El correo ya está registrado" },
        { status: 409 }
      );
    }

    // Check if taxId already exists
    const existingCompany = await prisma.company.findUnique({
      where: { taxId: companyTaxId },
    });
    if (existingCompany) {
      return NextResponse.json(
        { error: "El NIT/identificación fiscal ya está registrado" },
        { status: 409 }
      );
    }

    const billingConfig = await getBillingConfig();
    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationCode = generateVerificationCode();
    const verificationToken = await hashVerificationCode(verificationCode);
    const verificationExpiresAt = getVerificationExpiry();

    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyLegalName,
          legalName: companyLegalName,
          taxId: companyTaxId,
          email,
          plan: "free",
          subscriptionStatus: "none",
          subscriptionExpiresAt: null,
          maxEmployees: billingConfig.freeEmployeeLimit,
        },
      });

      await tx.position.create({
        data: {
          companyId: company.id,
          name: "general",
          active: true,
        },
      });

      await tx.incidentType.create({
        data: {
          companyId: company.id,
          name: "general",
          active: true,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "COMPANY_ADMIN",
          companyId: company.id,
          emailVerificationToken: verificationToken,
          emailVerificationExpiresAt: verificationExpiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          userId: user.id,
          action: "CREATE",
          entity: "COMPANY",
          entityId: company.id.toString(),
          newValues: {
            name: companyLegalName,
            email,
            plan: "free",
            maxEmployees: billingConfig.freeEmployeeLimit,
          },
        },
      });

      return { company, user };
    });

    await sendEmail({
      to: email,
      subject: "Tu código de verificación — cuenti time",
      html: verificationCodeEmailHtml(name, verificationCode),
    });

    return NextResponse.json(
      {
        message: "Cuenta creada. Revisa tu correo e ingresa el código de 6 dígitos para activar tu cuenta.",
        requiresEmailVerification: true,
        email,
        ...(process.env.NODE_ENV === "development" ? { devCode: verificationCode } : {}),
        plan: "free",
        maxEmployees: billingConfig.freeEmployeeLimit,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
