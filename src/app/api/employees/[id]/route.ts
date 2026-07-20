import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { toPgVector } from "@/lib/ai/pgvector";
import { createAuditLog } from "@/lib/audit";
import { canRegisterAdditionalFace, requireActiveCompanySubscription } from "@/lib/subscription";
import { scheduleWebhookEvent } from "@/lib/webhooks/dispatch";

// ─── Schema ───────────────────────────────────────────────────────────────────

const updateEmployeeSchema = z.object({
  branchId: z.string().cuid().optional(),
  fullName: z.string().min(1).max(200).optional(),
  documentType: z.enum(["CC", "CE", "PASSPORT", "NIT", "OTHER"]).optional(),
  documentNumber: z.string().min(1).max(50).optional(),
  position: z.string().max(200).optional(),
  email: z.string().email().max(254).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().max(20).optional().or(z.literal("").transform(() => undefined)),
  photo: z
    .string()
    .max(5_000_000, "La foto es demasiado grande")
    .refine(
      value => value.startsWith("data:image/") || /^https?:\/\//.test(value),
      "La foto debe ser una imagen válida"
    )
    .optional()
    .nullable(),
  faceRegistered: z.boolean().optional(),
  faceRegisteredAt: z.string().datetime().optional().nullable(),
  biometricConsentAt: z.string().datetime().optional().nullable(),
  // Puede ser cuid o id fijo del seed/registro (p.ej. pos-general-<companyId>)
  positionId: z.string().min(1).max(100).optional().nullable().or(z.literal("").transform(() => null)),
  faceEmbedding: z.array(z.number()).length(128).optional().nullable(),
  faceEmbeddingId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  hireDate: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  internalCode: z.string().max(50).optional().or(z.literal("").transform(() => undefined)),
});

type RouteParams = { params: { id: string } };

// ─── GET /api/employees/[id] ───────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        branch: { select: { name: true } },
        position: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    // Verify tenant isolation
    if (
      session.role !== "SAAS_SUPER_ADMIN" &&
      employee.companyId !== session.companyId
    ) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (err) {
    console.error("GET /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT /api/employees/[id] ───────────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    session.role !== "COMPANY_ADMIN" &&
    session.role !== "FACE_REGISTRAR"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { position: { select: { id: true, name: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  // Verify tenant isolation
  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    existing.companyId !== session.companyId
  ) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  const subscription = await requireActiveCompanySubscription(session);
  if (!subscription.ok) {
    return NextResponse.json(
      { error: subscription.error, code: subscription.code },
      { status: subscription.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const isRegisteringNewFace =
    !existing.faceRegistered &&
    (parsed.data.faceRegistered === true || parsed.data.faceEmbedding !== undefined && parsed.data.faceEmbedding !== null);

  if (isRegisteringNewFace) {
    const faceLimit = await canRegisterAdditionalFace(existing.companyId);
    if (!faceLimit.ok) {
      return NextResponse.json(
        { error: faceLimit.error, code: faceLimit.code },
        { status: faceLimit.status }
      );
    }
  }

  // If changing branch, verify it belongs to the same company
  if (parsed.data.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: parsed.data.branchId },
      select: { companyId: true },
    });
    if (!branch || branch.companyId !== existing.companyId) {
      return NextResponse.json(
        { error: "La sucursal no pertenece a la empresa del empleado" },
        { status: 422 }
      );
    }
  }

  try {
    // Build update data, stripping undefined values (Prisma doesn't accept them in spread)
    // Validate positionId belongs to same company
    if (parsed.data.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: parsed.data.positionId },
        select: { companyId: true, active: true },
      });
      if (!position || position.companyId !== existing.companyId) {
        return NextResponse.json(
          { error: "El cargo no pertenece a la empresa del empleado" },
          { status: 422 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updateData[key] = value;
    }
    delete updateData.faceEmbedding;
    updateData.hireDate = parsed.data.hireDate ? new Date(parsed.data.hireDate) : undefined;
    updateData.faceRegisteredAt = parsed.data.faceRegistered
      ? (parsed.data.faceRegisteredAt ? new Date(parsed.data.faceRegisteredAt) : new Date())
      : undefined;
    updateData.biometricConsentAt = parsed.data.faceRegistered
      ? (parsed.data.biometricConsentAt ? new Date(parsed.data.biometricConsentAt) : new Date())
      : undefined;
    // Remove keys with undefined values
    for (const k of Object.keys(updateData)) {
      if (updateData[k] === undefined) delete updateData[k];
    }

    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id },
        data: updateData,
        include: {
          branch: { select: { name: true } },
          position: { select: { id: true, name: true } },
        },
      });

      if (parsed.data.faceEmbedding !== undefined) {
        if (parsed.data.faceEmbedding === null) {
          await tx.$executeRaw`UPDATE "Employee" SET "faceEmbedding" = NULL WHERE "id" = ${id}`;
        } else {
          await tx.$executeRaw`UPDATE "Employee" SET "faceEmbedding" = ${toPgVector(parsed.data.faceEmbedding)}::vector WHERE "id" = ${id}`;
        }
      }

      return updated;
    });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "EMPLOYEE",
      entityId: employee.id,
      companyId: employee.companyId,
      oldValues: { fullName: existing.fullName, branchId: existing.branchId, positionId: existing.positionId, status: existing.status },
      newValues: { fullName: employee.fullName, branchId: employee.branchId, positionId: employee.positionId, status: employee.status },
    });

    if (isRegisteringNewFace) {
      scheduleWebhookEvent({
        companyId: employee.companyId,
        event: "employee.face_registered",
        data: {
          id: employee.id,
          fullName: employee.fullName,
          branchId: employee.branchId,
          faceRegisteredAt: employee.faceRegisteredAt?.toISOString() ?? null,
        },
      });
    }

    if (
      existing.status === "ACTIVE" &&
      employee.status === "INACTIVE"
    ) {
      scheduleWebhookEvent({
        companyId: employee.companyId,
        event: "employee.deactivated",
        data: {
          id: employee.id,
          fullName: employee.fullName,
          documentNumber: employee.documentNumber,
          branchId: employee.branchId,
        },
      });
    } else {
      scheduleWebhookEvent({
        companyId: employee.companyId,
        event: "employee.updated",
        data: {
          id: employee.id,
          fullName: employee.fullName,
          documentNumber: employee.documentNumber,
          branchId: employee.branchId,
          positionId: employee.positionId,
          status: employee.status,
          faceRegistered: employee.faceRegistered,
        },
      });
    }

    return NextResponse.json(employee);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un empleado con ese número de documento en esta empresa" },
        { status: 409 }
      );
    }
    console.error("PUT /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── DELETE /api/employees/[id] ── (soft-delete) ──────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;

  const existing = await prisma.employee.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  // Verify tenant isolation
  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    existing.companyId !== session.companyId
  ) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  try {
    await prisma.employee.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "EMPLOYEE",
      entityId: existing.id,
      companyId: existing.companyId,
      oldValues: { fullName: existing.fullName, documentNumber: existing.documentNumber, status: existing.status },
    });
    scheduleWebhookEvent({
      companyId: existing.companyId,
      event: "employee.deactivated",
      data: {
        id: existing.id,
        fullName: existing.fullName,
        documentNumber: existing.documentNumber,
        branchId: existing.branchId,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
