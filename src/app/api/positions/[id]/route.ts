import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { stringToBigint } from "@/lib/bigint";

const updatePositionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

type RouteParams = { params: { id: string } };

async function getPositionIfAllowed(id: bigint, session: Awaited<ReturnType<typeof requireSession>>) {
  const _companyFilter = getCompanyFilter(session);
  const position = await prisma.position.findUnique({
    where: { id },
  });

  if (!position) return null;
  if (session.role !== "SAAS_SUPER_ADMIN" && position.companyId.toString() !== session.companyId) {
    return null;
  }
  return position;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const position = await getPositionIfAllowed(stringToBigint(params.id), session);
    if (!position) {
      return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
    }
    return NextResponse.json(position);
  } catch (err) {
    console.error("GET /api/positions/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = updatePositionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const position = await getPositionIfAllowed(stringToBigint(params.id), session);
  if (!position) {
    return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
  }

  try {
    const oldValues = { name: position.name, active: position.active };
    const updated = await prisma.position.update({
      where: { id: stringToBigint(params.id) },
      data: parsed.data,
    });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "POSITION",
      entityId: updated.id,
      companyId: updated.companyId,
      oldValues,
      newValues: { name: updated.name, active: updated.active },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un cargo con ese nombre en esta empresa" },
        { status: 409 }
      );
    }
    console.error("PUT /api/positions/[id] error:", err);
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

  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const position = await getPositionIfAllowed(stringToBigint(params.id), session);
  if (!position) {
    return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
  }

  try {
    await prisma.position.update({
      where: { id: stringToBigint(params.id) },
      data: { active: false },
    });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "POSITION",
      entityId: position.id,
      companyId: position.companyId,
      oldValues: { name: position.name, active: position.active },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/positions/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
