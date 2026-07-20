import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";

// ─── Schema ───────────────────────────────────────────────────────────────────

const updateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().min(1).max(200).optional(),
  taxId: z.string().min(1).max(50).optional(),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  logo: z.string().url().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  subscriptionExpiresAt: z.string().datetime().optional().nullable(),
  maxEmployees: z.number().int().min(1).optional(),
  lateToleranceMinutes: z.number().int().min(0).max(240).optional(),
  earlyLeaveToleranceMinutes: z.number().int().min(0).max(240).optional(),
  lateReportTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato HH:mm")
    .optional(),
  lateReportRecipients: z.string().max(2000).optional().nullable(),
  faceMatchThreshold: z.number().min(0.2).max(1.2).optional(),
});

type RouteParams = { params: { id: string } };

// ─── GET /api/companies/[id] ───────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: { select: { branches: true, employees: true } },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }

    // Non-super-admin can only access their own company
    if (session.role !== "SAAS_SUPER_ADMIN" && company.id !== session.companyId) {
      // Never reveal that the company exists for another tenant
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (err) {
    console.error("GET /api/companies/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT /api/companies/[id] ───────────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Only SAAS_SUPER_ADMIN or COMPANY_ADMIN of that specific company
  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    !(session.role === "COMPANY_ADMIN" && session.companyId === id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = updateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // COMPANY_ADMIN solo puede editar datos operativos de su única empresa.
  const updateData =
    session.role === "SAAS_SUPER_ADMIN"
      ? parsed.data
      : {
          name: parsed.data.name,
          legalName: parsed.data.legalName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          address: parsed.data.address,
          city: parsed.data.city,
          country: parsed.data.country,
          logo: parsed.data.logo,
          lateToleranceMinutes: parsed.data.lateToleranceMinutes,
          earlyLeaveToleranceMinutes: parsed.data.earlyLeaveToleranceMinutes,
          lateReportTime: parsed.data.lateReportTime,
          lateReportRecipients: parsed.data.lateReportRecipients,
        };

  const hasChanges = Object.values(updateData).some((v) => v !== undefined);
  if (!hasChanges) {
    return NextResponse.json(
      { error: "No hay campos válidos para actualizar" },
      { status: 400 }
    );
  }

  // Verify company exists (same 404 for any company not visible to caller)
  const existing = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      lateToleranceMinutes: true,
      earlyLeaveToleranceMinutes: true,
      lateReportTime: true,
      lateReportRecipients: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  try {
    const company = await prisma.company.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { branches: true, employees: true } },
      },
    });

    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "COMPANY",
      entityId: company.id,
      companyId: company.id,
      oldValues: {
        lateToleranceMinutes: existing.lateToleranceMinutes,
        earlyLeaveToleranceMinutes: existing.earlyLeaveToleranceMinutes,
        lateReportTime: existing.lateReportTime,
        lateReportRecipients: existing.lateReportRecipients,
      },
      newValues: {
        lateToleranceMinutes: company.lateToleranceMinutes,
        earlyLeaveToleranceMinutes: company.earlyLeaveToleranceMinutes,
        lateReportTime: company.lateReportTime,
        lateReportRecipients: company.lateReportRecipients,
        name: company.name,
      },
    });

    return NextResponse.json(company);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe una empresa con ese taxId" },
        { status: 409 }
      );
    }
    console.error("PUT /api/companies/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── DELETE /api/companies/[id] ── (soft-delete) ──────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "SAAS_SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;

  const existing = await prisma.company.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  try {
    await prisma.company.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/companies/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
