import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";

const updateIncidentTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
  countsAsAbsence: z.boolean().optional(),
  excusesLate: z.boolean().optional(),
  excusesEarlyLeave: z.boolean().optional(),
});

type RouteParams = { params: { id: string } };

async function getIncidentTypeIfAllowed(id: string, session: Awaited<ReturnType<typeof requireSession>>) {
  const type = await prisma.incidentType.findUnique({ where: { id } });
  if (!type) return null;
  if (session.role !== "SAAS_SUPER_ADMIN" && type.companyId !== session.companyId) return null;
  return type;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const type = await getIncidentTypeIfAllowed(params.id, session);
  if (!type) return NextResponse.json({ error: "Tipo no encontrado" }, { status: 404 });
  return NextResponse.json(type);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const parsed = updateIncidentTypeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const type = await getIncidentTypeIfAllowed(params.id, session);
  if (!type) return NextResponse.json({ error: "Tipo no encontrado" }, { status: 404 });
  try {
    const updated = await prisma.incidentType.update({ where: { id: params.id }, data: parsed.data });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "INCIDENT_TYPE",
      entityId: updated.id,
      companyId: type.companyId,
      oldValues: { id: type.id, name: type.name, active: type.active },
      newValues: { id: updated.id, name: updated.name, active: updated.active },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un tipo de novedad con ese nombre" }, { status: 409 });
    }
    console.error("PUT /api/incident-types/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const type = await getIncidentTypeIfAllowed(params.id, session);
  if (!type) return NextResponse.json({ error: "Tipo no encontrado" }, { status: 404 });
  try {
    await prisma.incidentType.update({ where: { id: params.id }, data: { active: false } });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "INCIDENT_TYPE",
      entityId: params.id,
      companyId: type.companyId,
      oldValues: { id: type.id, name: type.name },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/incident-types/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
