import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { stringToBigint } from "@/lib/bigint";

type RouteParams = { params: { id: string } };

const CAN_MANAGE = new Set(["SAAS_SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_SUPERVISOR"]);

const updateAttendanceSchema = z.object({
  recordedAt: z.string().datetime(),
  notes: z.string().max(500).optional().nullable(),
});

async function getRecordIfAllowed(
  id: bigint,
  session: Awaited<ReturnType<typeof requireSession>>
) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!record) return null;
  if (session.role !== "SAAS_SUPER_ADMIN" && record.companyId.toString() !== session.companyId) {
    return null;
  }
  return record;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!CAN_MANAGE.has(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = updateAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await getRecordIfAllowed(stringToBigint(params.id), session);
  if (!existing) {
    return NextResponse.json({ error: "Asistencia no encontrada" }, { status: 404 });
  }

  try {
    const updated = await prisma.attendanceRecord.update({
      where: { id: stringToBigint(params.id) },
      data: {
        recordedAt: new Date(parsed.data.recordedAt),
        notes: parsed.data.notes === undefined ? existing.notes : parsed.data.notes,
        isManual: true,
        manualBy: session.userId.toString(),
      },
      include: {
        employee: { select: { fullName: true, photo: true, position: { select: { name: true } } } },
        branch: { select: { name: true } },
      },
    });

    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "ATTENDANCE",
      entityId: updated.id,
      companyId: existing.companyId,
      oldValues: {
        recordedAt: existing.recordedAt,
        type: existing.type,
        isManual: existing.isManual,
        notes: existing.notes,
      },
      newValues: {
        recordedAt: updated.recordedAt,
        type: updated.type,
        isManual: updated.isManual,
        notes: updated.notes,
        manualBy: updated.manualBy,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/attendance/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!CAN_MANAGE.has(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getRecordIfAllowed(stringToBigint(params.id), session);
  if (!existing) {
    return NextResponse.json({ error: "Asistencia no encontrada" }, { status: 404 });
  }

  try {
    await prisma.attendanceRecord.delete({ where: { id: stringToBigint(params.id) } });

    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "ATTENDANCE",
      entityId: existing.id,
      companyId: existing.companyId,
      oldValues: {
        employeeId: existing.employeeId,
        branchId: existing.branchId,
        type: existing.type,
        recordedAt: existing.recordedAt,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/attendance/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
