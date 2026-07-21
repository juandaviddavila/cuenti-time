import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { scheduleWebhookEvent } from "@/lib/webhooks/dispatch";
import { stringToBigint } from "@/lib/bigint";

// ─── Schema ───────────────────────────────────────────────────────────────────

const updateBranchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  duplicateWindowMinutes: z.number().min(0.1).max(1440).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  googlePlaceId: z.string().max(255).nullable().optional(),
  radiusMeters: z.number().int().min(1).max(100000).optional(),
});

type RouteParams = { params: { id: string } };

// ─── GET /api/branches/[id] ────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = stringToBigint(params.id);

  try {
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        company: { select: { name: true } },
        _count: { select: { employees: true } },
      },
    });

    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }

    // Verify tenant isolation
    if (
      session.role !== "SAAS_SUPER_ADMIN" &&
      branch.companyId.toString() !== session.companyId
    ) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }

    return NextResponse.json(branch);
  } catch (err) {
    console.error("GET /api/branches/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT /api/branches/[id] ────────────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = stringToBigint(params.id);

  const existing = await prisma.branch.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  // Verify tenant isolation
  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    existing.companyId.toString() !== session.companyId
  ) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = updateBranchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const oldValues = { name: existing.name, code: existing.code, status: existing.status, duplicateWindowMinutes: existing.duplicateWindowMinutes };
    const branch = await prisma.branch.update({
      where: { id },
      data: parsed.data,
      include: {
        company: { select: { name: true } },
        _count: { select: { employees: true } },
      },
    });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "BRANCH",
      entityId: branch.id,
      companyId: branch.companyId,
      oldValues,
      newValues: { name: branch.name, code: branch.code, status: branch.status, duplicateWindowMinutes: branch.duplicateWindowMinutes },
    });
    scheduleWebhookEvent({
      companyId: branch.companyId,
      event: "branch.updated",
      data: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        status: branch.status,
        city: branch.city,
        latitude: branch.latitude,
        longitude: branch.longitude,
        radiusMeters: branch.radiusMeters,
        duplicateWindowMinutes: branch.duplicateWindowMinutes,
      },
    });
    return NextResponse.json(branch);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe una sucursal con ese código en esta empresa" },
        { status: 409 }
      );
    }
    console.error("PUT /api/branches/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── DELETE /api/branches/[id] ── (soft-delete) ───────────────────────────────

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

  const id = stringToBigint(params.id);

  const existing = await prisma.branch.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  // Verify tenant isolation
  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    existing.companyId.toString() !== session.companyId
  ) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  try {
    await prisma.branch.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "BRANCH",
      entityId: existing.id,
      companyId: existing.companyId,
      oldValues: { name: existing.name, code: existing.code, status: existing.status },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/branches/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
