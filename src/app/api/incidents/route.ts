import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { scheduleWebhookEvent } from "@/lib/webhooks/dispatch";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const incidentSchema = z.object({
  employeeId: z.string().cuid().optional().nullable(),
  branchId: z.string().cuid().optional().nullable(),
  incidentTypeId: z.string().cuid(),
  date: z.string().datetime(),
  overrideStart: z.string().regex(timePattern).optional().nullable(),
  overrideEnd: z.string().regex(timePattern).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const companyFilter = getCompanyFilter(session);
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const branchId = searchParams.get("branchId") ?? undefined;
  const date = searchParams.get("date");

  const dateFilter = date
    ? { gte: startOfDay(new Date(date)), lte: endOfDay(new Date(date)) }
    : undefined;

  try {
    const incidents = await prisma.incident.findMany({
      where: {
        ...companyFilter,
        ...(employeeId ? { employeeId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: { date: "desc" },
      include: {
        employee: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
        incidentType: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ data: incidents });
  } catch (err) {
    console.error("GET /api/incidents error:", err);
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
  const parsed = incidentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { employeeId, branchId, incidentTypeId, date, overrideStart, overrideEnd, reason } = parsed.data;

  if (!employeeId && !branchId) {
    return NextResponse.json({ error: "Debe indicar empleado o sucursal" }, { status: 422 });
  }

  const companyId = session.companyId ?? "";
  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
    if (!employee || (session.role !== "SAAS_SUPER_ADMIN" && employee.companyId !== companyId)) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
  }
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { companyId: true } });
    if (!branch || (session.role !== "SAAS_SUPER_ADMIN" && branch.companyId !== companyId)) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }
  }
  const type = await prisma.incidentType.findUnique({ where: { id: incidentTypeId }, select: { companyId: true } });
  if (!type || (session.role !== "SAAS_SUPER_ADMIN" && type.companyId !== companyId)) {
    return NextResponse.json({ error: "Tipo de novedad no encontrado" }, { status: 404 });
  }

  try {
    const incident = await prisma.incident.create({
      data: {
        companyId,
        employeeId,
        branchId,
        incidentTypeId,
        date: new Date(date),
        overrideStart,
        overrideEnd,
        reason,
      },
      include: {
        employee: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
        incidentType: { select: { id: true, name: true } },
      },
    });
    await createAuditLog({
      request,
      session,
      action: "CREATE",
      entity: "INCIDENT",
      entityId: incident.id,
      companyId,
      newValues: { id: incident.id, employee: incident.employee, branch: incident.branch, incidentType: incident.incidentType },
    });
    scheduleWebhookEvent({
      companyId,
      event: "incident.created",
      data: {
        id: incident.id,
        employeeId: incident.employeeId,
        branchId: incident.branchId,
        incidentTypeId: incident.incidentTypeId,
        date: incident.date.toISOString(),
        reason: incident.reason,
        employee: incident.employee,
        branch: incident.branch,
        incidentType: incident.incidentType,
      },
    });
    return NextResponse.json(incident, { status: 201 });
  } catch (err) {
    console.error("POST /api/incidents error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
