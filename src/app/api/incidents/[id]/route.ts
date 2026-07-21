import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { scheduleWebhookEvent } from "@/lib/webhooks/dispatch";
import { stringToBigint } from "@/lib/bigint";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const updateIncidentSchema = z.object({
  employeeId: z.coerce.bigint().positive().nullish(),
  branchId: z.coerce.bigint().positive().nullish(),
  incidentTypeId: z.coerce.bigint().positive().optional(),
  date: z.string().datetime().optional(),
  overrideStart: z.string().regex(timePattern).optional().nullable(),
  overrideEnd: z.string().regex(timePattern).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

type RouteParams = { params: { id: string } };

async function getIncidentIfAllowed(id: bigint, session: Awaited<ReturnType<typeof requireSession>>) {
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: { employee: { select: { companyId: true } }, branch: { select: { companyId: true } } },
  });
  if (!incident) return null;
  const companyId = incident.employee?.companyId ?? incident.branch?.companyId ?? incident.companyId;
  if (session.role !== "SAAS_SUPER_ADMIN" && companyId.toString() !== session.companyId) return null;
  return incident;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const incident = await getIncidentIfAllowed(stringToBigint(params.id), session);
  if (!incident) return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });
  return NextResponse.json(incident);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN" && session.role !== "BRANCH_SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const parsed = updateIncidentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const incident = await getIncidentIfAllowed(stringToBigint(params.id), session);
  if (!incident) return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.employeeId !== undefined) data.employeeId = parsed.data.employeeId;
  if (parsed.data.branchId !== undefined) data.branchId = parsed.data.branchId;
  if (parsed.data.incidentTypeId) data.incidentTypeId = parsed.data.incidentTypeId;
  if (parsed.data.date) data.date = new Date(parsed.data.date);
  if (parsed.data.overrideStart !== undefined) data.overrideStart = parsed.data.overrideStart;
  if (parsed.data.overrideEnd !== undefined) data.overrideEnd = parsed.data.overrideEnd;
  if (parsed.data.reason !== undefined) data.reason = parsed.data.reason;

  try {
    const updated = await prisma.incident.update({
      where: { id: stringToBigint(params.id) },
      data,
      include: {
        employee: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
        incidentType: { select: { id: true, name: true } },
      },
    });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "INCIDENT",
      entityId: updated.id,
      companyId: incident.companyId,
      oldValues: { id: incident.id, employeeId: incident.employeeId, branchId: incident.branchId, incidentTypeId: incident.incidentTypeId, date: incident.date },
      newValues: { id: updated.id, employee: updated.employee, branch: updated.branch, incidentType: updated.incidentType, date: updated.date },
    });
    scheduleWebhookEvent({
      companyId: incident.companyId,
      event: "incident.updated",
      data: {
        id: updated.id,
        employeeId: updated.employeeId,
        branchId: updated.branchId,
        incidentTypeId: updated.incidentTypeId,
        date: updated.date.toISOString(),
        reason: updated.reason,
        employee: updated.employee,
        branch: updated.branch,
        incidentType: updated.incidentType,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/incidents/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN" && session.role !== "BRANCH_SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const incident = await getIncidentIfAllowed(stringToBigint(params.id), session);
  if (!incident) return NextResponse.json({ error: "Novedad no encontrada" }, { status: 404 });
  try {
    await prisma.incident.delete({ where: { id: stringToBigint(params.id) } });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "INCIDENT",
      entityId: params.id,
      companyId: incident.companyId,
      oldValues: { id: incident.id, employeeId: incident.employeeId, branchId: incident.branchId, incidentTypeId: incident.incidentTypeId },
    });
    scheduleWebhookEvent({
      companyId: incident.companyId,
      event: "incident.deleted",
      data: {
        id: incident.id,
        employeeId: incident.employeeId,
        branchId: incident.branchId,
        incidentTypeId: incident.incidentTypeId,
        date: incident.date.toISOString(),
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/incidents/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
