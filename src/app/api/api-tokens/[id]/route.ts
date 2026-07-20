import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireIntegrationAccess } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";

const updateTokenSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

type RouteParams = { params: { id: string } };

async function getTokenIfAllowed(
  id: string,
  session: Awaited<ReturnType<typeof requireSession>>
) {
  // Multi-tenant estricto: el token solo es visible si pertenece a la empresa de la sesión.
  if (!session.companyId) return null;
  return prisma.apiToken.findFirst({
    where: { id, companyId: session.companyId },
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    await requireIntegrationAccess(session);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const parsed = updateTokenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const token = await getTokenIfAllowed(params.id, session);
  if (!token) return NextResponse.json({ error: "Token no encontrado" }, { status: 404 });
  try {
    const updated = await prisma.apiToken.update({
      where: { id: params.id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        scopes: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
        companyId: true,
      },
    });
    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "API_TOKEN",
      entityId: updated.id,
      companyId: updated.companyId,
      oldValues: { name: token.name, active: token.active },
      newValues: { name: updated.name, active: updated.active },
    });
    const { companyId: _companyId, ...safe } = updated;
    return NextResponse.json(safe);
  } catch (err) {
    console.error("PUT /api/api-tokens/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    await requireIntegrationAccess(session);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const token = await getTokenIfAllowed(params.id, session);
  if (!token) return NextResponse.json({ error: "Token no encontrado" }, { status: 404 });
  try {
    // Borrado definitivo. Para pausar y recuperar use PUT { active: false|true }.
    await prisma.apiToken.delete({ where: { id: params.id } });
    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "API_TOKEN",
      entityId: token.id,
      companyId: token.companyId,
      oldValues: { name: token.name, active: token.active, scopes: token.scopes },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/api-tokens/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
