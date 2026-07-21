import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { stringToBigint } from "@/lib/bigint";

const employeeShiftSchema = z.object({
  employeeId: z.coerce.bigint().positive(),
  shiftId: z.coerce.bigint().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
});

export async function GET(request: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const companyFilter = getCompanyFilter(session);
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const employeeIdBigInt = employeeId ? stringToBigint(employeeId) : undefined;
  const activeOnly = searchParams.get("activeOnly") === "true";
  const now = new Date();

  try {
    const assignments = await prisma.employeeShift.findMany({
      where: {
        ...(employeeId ? { employeeId: employeeIdBigInt } : {}),
        ...(activeOnly ? { startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] } : {}),
        employee: { ...companyFilter },
      },
      orderBy: { startDate: "desc" },
      include: {
        employee: { select: { id: true, fullName: true } },
        shift: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ data: assignments });
  } catch (err) {
    console.error("GET /api/employee-shifts error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN" && session.role !== "BRANCH_SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const parsed = employeeShiftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { employeeId, shiftId, startDate, endDate } = parsed.data;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
  if (!employee) return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  if (session.role !== "SAAS_SUPER_ADMIN" && employee.companyId.toString() !== session.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { companyId: true } });
  if (!shift || shift.companyId !== employee.companyId) {
    return NextResponse.json({ error: "El turno no pertenece a la empresa del empleado" }, { status: 422 });
  }

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  if (end && end <= start) {
    return NextResponse.json({ error: "La fecha final debe ser posterior a la inicial" }, { status: 422 });
  }

  try {
    const assignment = await prisma.employeeShift.create({
      data: { employeeId, shiftId, startDate: start, endDate: end },
      include: {
        employee: { select: { id: true, fullName: true } },
        shift: { select: { id: true, name: true } },
      },
    });
    await createAuditLog({
      request,
      session,
      action: "CREATE",
      entity: "EMPLOYEE_SHIFT",
      entityId: assignment.id,
      companyId: employee.companyId,
      newValues: { id: assignment.id, employee: assignment.employee, shift: assignment.shift },
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    console.error("POST /api/employee-shifts error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
