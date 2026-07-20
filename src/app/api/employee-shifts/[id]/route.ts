import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";

const updateEmployeeShiftSchema = z.object({
  shiftId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
});

type RouteParams = { params: { id: string } };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN" && session.role !== "BRANCH_SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const parsed = updateEmployeeShiftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  const assignment = await prisma.employeeShift.findUnique({
    where: { id: params.id },
    include: { employee: { select: { companyId: true } }, shift: { select: { companyId: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
  if (session.role !== "SAAS_SUPER_ADMIN" && assignment.employee.companyId !== session.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.shiftId) {
    const shift = await prisma.shift.findUnique({ where: { id: parsed.data.shiftId }, select: { companyId: true } });
    if (!shift || shift.companyId !== assignment.employee.companyId) {
      return NextResponse.json({ error: "El turno no pertenece a la empresa" }, { status: 422 });
    }
    data.shiftId = parsed.data.shiftId;
  }
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate !== undefined) data.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;

  const start = (data.startDate as Date | undefined) ?? assignment.startDate;
  const end = (data.endDate as Date | null | undefined) ?? assignment.endDate;
  if (end && end <= start) {
    return NextResponse.json({ error: "La fecha final debe ser posterior a la inicial" }, { status: 422 });
  }

  try {
    const updated = await prisma.employeeShift.update({
      where: { id: params.id },
      data,
      include: { employee: { select: { id: true, fullName: true } }, shift: { select: { id: true, name: true } } },
    });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "EMPLOYEE_SHIFT",
      entityId: updated.id,
      companyId: assignment.employee.companyId,
      oldValues: { id: assignment.id, shiftId: assignment.shiftId, startDate: assignment.startDate, endDate: assignment.endDate },
      newValues: { id: updated.id, employee: updated.employee, shift: updated.shift, startDate: updated.startDate, endDate: updated.endDate },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/employee-shifts/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN" && session.role !== "BRANCH_SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const assignment = await prisma.employeeShift.findUnique({
    where: { id: params.id },
    include: { employee: { select: { companyId: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
  if (session.role !== "SAAS_SUPER_ADMIN" && assignment.employee.companyId !== session.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await prisma.employeeShift.delete({ where: { id: params.id } });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "EMPLOYEE_SHIFT",
      entityId: params.id,
      companyId: assignment.employee.companyId,
      oldValues: { id: assignment.id, employeeId: assignment.employeeId, shiftId: assignment.shiftId },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/employee-shifts/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
