import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession, requireIntegrationAccess } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import {
  WEBHOOK_EVENT_CATALOG,
  WEBHOOK_EVENTS,
  isWebhookEvent,
} from "@/lib/webhooks/events";
import { stringToBigint, serializeRecord } from "@/lib/bigint";

const createWebhookSchema = z.object({
  url: z.string().url().max(2000),
  events: z
    .array(z.string().min(1).max(100))
    .min(1)
    .refine((events) => events.every(isWebhookEvent), {
      message: "Uno o más eventos no son válidos",
    }),
  active: z.boolean().default(true),
  timeoutMs: z.number().int().min(500).max(30000).default(2000),
});

export async function GET() {
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

  if (!session.companyId) {
    return NextResponse.json(
      { error: "Tu cuenta no tiene empresa asociada." },
      { status: 422 }
    );
  }

  try {
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: { companyId: stringToBigint(session.companyId) },
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json({
      data: subscriptions.map((s) => ({
        ...s,
        events: JSON.parse(s.events) as string[],
      })),
      availableEvents: [...WEBHOOK_EVENTS],
      eventCatalog: WEBHOOK_EVENT_CATALOG,
    });
  } catch (err) {
    console.error("GET /api/webhooks error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const companyId = session.companyId;
  if (!companyId) {
    return NextResponse.json(
      { error: "Tu cuenta no tiene empresa asociada. No se puede crear un webhook multi-tenant." },
      { status: 422 }
    );
  }

  const secret = randomBytes(32).toString("hex");

  try {
    const subscription = await prisma.webhookSubscription.create({
      data: {
        companyId: stringToBigint(companyId),
        url: parsed.data.url,
        events: JSON.stringify(parsed.data.events),
        secret,
        active: parsed.data.active,
        timeoutMs: parsed.data.timeoutMs,
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
      action: "CREATE",
      entity: "WEBHOOK",
      entityId: subscription.id,
      companyId,
      newValues: { url: subscription.url, events: parsed.data.events },
    });

    return NextResponse.json(
      serializeRecord({
        ...subscription,
        events: parsed.data.events,
        secret,
      }),
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/webhooks error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
