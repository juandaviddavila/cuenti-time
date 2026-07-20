import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";

// ─── Schema ───────────────────────────────────────────────────────────────────

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(254).toLowerCase().optional(),
  role: z
    .enum([
      "SAAS_SUPER_ADMIN",
      "COMPANY_ADMIN",
      "BRANCH_SUPERVISOR",
      "FACE_REGISTRAR",
      "REPORT_VIEWER",
      "DEVELOPER",
    ])
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  avatar: z.string().url().optional(),
  branchId: z.string().cuid().optional().nullable(),
  bypassGeofence: z.boolean().optional(),
  canManageIntegrations: z.boolean().optional(),
  // Password changes are intentionally NOT allowed here (use a dedicated endpoint)
});

type RouteParams = { params: { id: string } };

// ─── GET /api/users/[id] ───────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        branchId: true,
        bypassGeofence: true,
        canManageIntegrations: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verify tenant isolation (super admin can see all)
    if (
      session.role !== "SAAS_SUPER_ADMIN" &&
      user.companyId !== session.companyId
    ) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error("GET /api/users/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT /api/users/[id] ───────────────────────────────────────────────────────

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

  const { id } = params;

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, companyId: true, name: true, email: true, role: true, status: true, branchId: true, bypassGeofence: true, canManageIntegrations: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Verify tenant isolation
  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    existing.companyId !== session.companyId
  ) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // COMPANY_ADMIN cannot assign or remove SAAS_SUPER_ADMIN role
  if (session.role === "COMPANY_ADMIN" && parsed.data.role === "SAAS_SUPER_ADMIN") {
    return NextResponse.json(
      { error: "No tienes permiso para asignar ese rol" },
      { status: 403 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        branchId: true,
        bypassGeofence: true,
        canManageIntegrations: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "USER",
      entityId: user.id,
      companyId: user.companyId,
      oldValues: { name: existing.name, email: existing.email, role: existing.role, status: existing.status, branchId: existing.branchId, bypassGeofence: existing.bypassGeofence, canManageIntegrations: existing.canManageIntegrations },
      newValues: { name: user.name, email: user.email, role: user.role, status: user.status, branchId: user.branchId, bypassGeofence: user.bypassGeofence, canManageIntegrations: user.canManageIntegrations },
    });
    return NextResponse.json(user);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }
    console.error("PUT /api/users/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── DELETE /api/users/[id] ── (soft-delete: status = INACTIVE) ───────────────

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

  // Prevent self-deactivation
  if (session.userId === id) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta" },
      { status: 422 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, companyId: true, name: true, email: true, role: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Verify tenant isolation
  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    existing.companyId !== session.companyId
  ) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "USER",
      entityId: existing.id,
      companyId: existing.companyId,
      oldValues: { name: existing.name, email: existing.email, role: existing.role, status: existing.status },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/users/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
