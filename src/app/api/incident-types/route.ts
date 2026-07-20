import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";

const incidentTypeSchema = z.object({
  name: z.string().min(1).max(100),
  active: z.boolean().default(true),
  countsAsAbsence: z.boolean().default(false),
  excusesLate: z.boolean().default(false),
  excusesEarlyLeave: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const companyFilter = getCompanyFilter(session);
  const { searchParams } = new URL(request.url);
  const active = searchParams.get("active");

  try {
    const types = await prisma.incidentType.findMany({
      where: { ...companyFilter, ...(active ? { active: active === "true" } : {}) },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: types });
  } catch (err) {
    console.error("GET /api/incident-types error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const parsed = incidentTypeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  const companyId = session.role === "SAAS_SUPER_ADMIN" && body && typeof body === "object" && "companyId" in body
    ? (body as { companyId?: string }).companyId ?? session.companyId
    : session.companyId;
  if (!companyId) return NextResponse.json({ error: "No se pudo determinar la empresa" }, { status: 422 });

  try {
    const type = await prisma.incidentType.create({ data: { companyId, ...parsed.data } });
    await createAuditLog({
      request,
      session,
      action: "CREATE",
      entity: "INCIDENT_TYPE",
      entityId: type.id,
      companyId,
      newValues: { id: type.id, name: type.name },
    });
    return NextResponse.json(type, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un tipo de novedad con ese nombre" }, { status: 409 });
    }
    console.error("POST /api/incident-types error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
