import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireIntegrationAccess } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { isWebhookEvent } from "@/lib/webhooks/events";

const updateWebhookSchema = z.object({
  url: z.string().url().max(2000).optional(),
  events: z
    .array(z.string().min(1).max(100))
    .min(1)
    .refine((events) => events.every(isWebhookEvent), {
      message: "Uno o más eventos no son válidos",
    })
    .optional(),
  active: z.boolean().optional(),
  timeoutMs: z.number().int().min(500).max(30000).optional(),
});

type RouteParams = { params: { id: string } };

async function getWebhookIfAllowed(
  id: string,
  session: Awaited<ReturnType<typeof requireSession>>
) {
  // Multi-tenant estricto: solo la empresa de la sesión.
  if (!session.companyId) return null;
  return prisma.webhookSubscription.findFirst({
    where: { id, companyId: session.companyId },
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireIntegrationAccess(session);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getWebhookIfAllowed(params.id, session);
  if (!existing) {
    return NextResponse.json({ error: "Webhook no encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = updateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { events, ...rest } = parsed.data;

  try {
    const updated = await prisma.webhookSubscription.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(events ? { events: JSON.stringify(events) } : {}),
      },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        timeoutMs: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      request,
      session,
      action: "UPDATE",
      entity: "WEBHOOK",
      entityId: updated.id,
      companyId: existing.companyId,
      oldValues: {
        url: existing.url,
        active: existing.active,
        events: existing.events,
      },
      newValues: {
        url: updated.url,
        active: updated.active,
        events: updated.events,
      },
    });

    return NextResponse.json({
      ...updated,
      events: JSON.parse(updated.events) as string[],
    });
  } catch (err) {
    console.error("PUT /api/webhooks/[id] error:", err);
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

  try {
    await requireIntegrationAccess(session);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getWebhookIfAllowed(params.id, session);
  if (!existing) {
    return NextResponse.json({ error: "Webhook no encontrado" }, { status: 404 });
  }

  try {
    await prisma.webhookSubscription.update({
      where: { id: params.id },
      data: { active: false },
    });

    await createAuditLog({
      request,
      session,
      action: "DELETE",
      entity: "WEBHOOK",
      entityId: existing.id,
      companyId: existing.companyId,
      oldValues: { url: existing.url, active: existing.active },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/webhooks/[id] error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
