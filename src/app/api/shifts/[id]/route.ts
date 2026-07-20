import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const updateShiftSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  mondayStart: z.string().regex(timePattern).optional().nullable(),
  mondayEnd: z.string().regex(timePattern).optional().nullable(),
  tuesdayStart: z.string().regex(timePattern).optional().nullable(),
  tuesdayEnd: z.string().regex(timePattern).optional().nullable(),
  wednesdayStart: z.string().regex(timePattern).optional().nullable(),
  wednesdayEnd: z.string().regex(timePattern).optional().nullable(),
  thursdayStart: z.string().regex(timePattern).optional().nullable(),
  thursdayEnd: z.string().regex(timePattern).optional().nullable(),
  fridayStart: z.string().regex(timePattern).optional().nullable(),
  fridayEnd: z.string().regex(timePattern).optional().nullable(),
  saturdayStart: z.string().regex(timePattern).optional().nullable(),
  saturdayEnd: z.string().regex(timePattern).optional().nullable(),
  sundayStart: z.string().regex(timePattern).optional().nullable(),
  sundayEnd: z.string().regex(timePattern).optional().nullable(),
  active: z.boolean().optional(),
});

type RouteParams = { params: { id: string } };

async function getShiftIfAllowed(id: string, session: Awaited<ReturnType<typeof requireSession>>) {
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) return null;
  if (session.role !== "SAAS_SUPER_ADMIN" && shift.companyId !== session.companyId) return null;
  return shift;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const shift = await getShiftIfAllowed(params.id, session);
    if (!shift) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    return NextResponse.json(shift);
  } catch (err) {
    console.error("GET /api/shifts/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const shift = await getShiftIfAllowed(params.id, session);
  if (!shift) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  try {
    const oldValues = { name: shift.name, active: shift.active };
    const updated = await prisma.shift.update({ where: { id: params.id }, data: parsed.data });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "SHIFT",
      entityId: updated.id,
      companyId: updated.companyId,
      oldValues,
      newValues: { name: updated.name, active: updated.active },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/shifts/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const shift = await getShiftIfAllowed(params.id, session);
  if (!shift) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  try {
    await prisma.shift.update({ where: { id: params.id }, data: { active: false } });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "SHIFT",
      entityId: shift.id,
      companyId: shift.companyId,
      oldValues: { name: shift.name, active: shift.active },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/shifts/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
