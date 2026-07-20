import { createHmac } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isWebhookEvent,
  parseSubscriptionEvents,
  type WebhookEventType,
} from "@/lib/webhooks/events";

/** Intento inicial + hasta 3 reintentos. */
export const WEBHOOK_MAX_RETRIES = 3;
export const WEBHOOK_MAX_ATTEMPTS = 1 + WEBHOOK_MAX_RETRIES; // 4
/** Intervalo entre reintentos. */
export const WEBHOOK_RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 min

export interface WebhookEnvelope {
  id: string;
  event: WebhookEventType;
  createdAt: string;
  companyId: string;
  data: Record<string, unknown>;
}

const inProcessRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();

type WebhookLogLevel = "info" | "warn" | "error";

/** Log estructurado de sucesos de webhooks (éxito y error). Filtrar por `[webhook]`. */
function logWebhook(
  level: WebhookLogLevel,
  message: string,
  meta: Record<string, unknown> = {}
): void {
  const payload = {
    ts: new Date().toISOString(),
    scope: "webhook",
    message,
    ...meta,
  };
  const line = `[webhook] ${message} ${JSON.stringify(payload)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function safeWebhookUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "(url-inválida)";
  }
}

function signPayload(secret: string, body: string): string {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

/**
 * Programa el siguiente reintento en este proceso (dev / long-running).
 * Complementa `POST /api/webhooks/retry` para entornos multi-instancia.
 */
function scheduleInProcessRetry(deliveryId: string, delayMs: number): void {
  const prev = inProcessRetryTimers.get(deliveryId);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(() => {
    inProcessRetryTimers.delete(deliveryId);
    void runScheduledRetry(deliveryId).catch((err) => {
      console.error(`Webhook retry timer ${deliveryId}:`, err);
    });
  }, delayMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
  inProcessRetryTimers.set(deliveryId, timer);
}

async function runScheduledRetry(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true, attempt: true, nextRetryAt: true },
  });

  if (!delivery || delivery.status !== "PENDING") return;
  if (delivery.attempt >= WEBHOOK_MAX_ATTEMPTS) return;
  // Si nextRetryAt aún no venció (reloj / race), reprogramar.
  if (delivery.nextRetryAt && delivery.nextRetryAt.getTime() > Date.now() + 500) {
    scheduleInProcessRetry(
      deliveryId,
      delivery.nextRetryAt.getTime() - Date.now()
    );
    return;
  }

  logWebhook("info", "timer reintento disparado", {
    deliveryId,
    previousAttempt: delivery.attempt,
    nextAttempt: delivery.attempt + 1,
  });

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { attempt: delivery.attempt + 1, nextRetryAt: null },
  });
  await attemptDelivery(deliveryId);
}

/**
 * Encola deliveries para suscripciones activas de la empresa que escuchan el evento
 * e intenta el primer envío en background. Nunca filtra por otra empresa.
 */
export async function emitWebhookEvent(params: {
  companyId: string;
  event: WebhookEventType;
  data: Record<string, unknown>;
}): Promise<void> {
  const { companyId, event, data } = params;
  if (!companyId || !isWebhookEvent(event)) return;

  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { companyId, active: true },
    select: {
      id: true,
      url: true,
      secret: true,
      events: true,
      timeoutMs: true,
      companyId: true,
    },
  });

  const matching = subscriptions.filter((sub) =>
    parseSubscriptionEvents(sub.events).includes(event)
  );
  if (matching.length === 0) {
    logWebhook("info", "evento sin suscriptores", { companyId, event });
    return;
  }

  logWebhook("info", "evento emitido", {
    companyId,
    event,
    subscriptions: matching.length,
  });

  const createdAt = new Date();

  for (const sub of matching) {
    if (sub.companyId !== companyId) continue;

    const payload = {
      event,
      companyId,
      data,
      createdAt: createdAt.toISOString(),
    } as Prisma.InputJsonValue;

    const delivery = await prisma.webhookDelivery.create({
      data: {
        subscriptionId: sub.id,
        companyId,
        event,
        payload,
        attempt: 1,
        status: "PENDING",
        scheduledAt: createdAt,
      },
    });

    logWebhook("info", "delivery encolado", {
      deliveryId: delivery.id,
      companyId,
      event,
      subscriptionId: sub.id,
      url: safeWebhookUrl(sub.url),
      attempt: 1,
    });

    void attemptDelivery(delivery.id).catch((err) => {
      logWebhook("error", "delivery excepción no controlada", {
        deliveryId: delivery.id,
        companyId,
        event,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

/** Disparo no bloqueante seguro para API routes. */
export function scheduleWebhookEvent(params: {
  companyId: string;
  event: WebhookEventType;
  data: Record<string, unknown>;
}): void {
  void emitWebhookEvent(params).catch((err) => {
    logWebhook("error", "emitWebhookEvent falló", {
      companyId: params.companyId,
      event: params.event,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export async function attemptDelivery(
  deliveryId: string
): Promise<"SUCCESS" | "FAILED" | "PENDING"> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      subscription: {
        select: {
          id: true,
          url: true,
          secret: true,
          timeoutMs: true,
          active: true,
          companyId: true,
        },
      },
    },
  });

  if (!delivery) {
    logWebhook("error", "delivery no encontrado", { deliveryId });
    return "FAILED";
  }

  const url = safeWebhookUrl(delivery.subscription.url);
  const baseMeta = {
    deliveryId,
    companyId: delivery.companyId,
    event: delivery.event,
    subscriptionId: delivery.subscriptionId,
    url,
    attempt: delivery.attempt,
    maxAttempts: WEBHOOK_MAX_ATTEMPTS,
  };

  if (delivery.companyId !== delivery.subscription.companyId) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        errorMessage: "Inconsistencia de empresa entre delivery y suscripción",
        deliveredAt: new Date(),
        nextRetryAt: null,
      },
    });
    logWebhook("error", "delivery fallido (tenant)", {
      ...baseMeta,
      status: "FAILED",
      error: "Inconsistencia de empresa entre delivery y suscripción",
    });
    return "FAILED";
  }

  if (!delivery.subscription.active) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        errorMessage: "Suscripción inactiva",
        deliveredAt: new Date(),
        nextRetryAt: null,
      },
    });
    logWebhook("warn", "delivery fallido (suscripción inactiva)", {
      ...baseMeta,
      status: "FAILED",
      error: "Suscripción inactiva",
    });
    return "FAILED";
  }

  if (delivery.status === "SUCCESS") return "SUCCESS";

  logWebhook("info", "intento de entrega", baseMeta);

  const payload = delivery.payload as Record<string, unknown>;
  const envelope: WebhookEnvelope = {
    id: delivery.id,
    event: delivery.event as WebhookEventType,
    createdAt:
      typeof payload.createdAt === "string"
        ? payload.createdAt
        : delivery.scheduledAt.toISOString(),
    companyId: delivery.companyId,
    data:
      payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>)
        : payload,
  };

  const body = JSON.stringify(envelope);
  const signature = signPayload(delivery.subscription.secret, body);
  const timeoutMs = Math.min(Math.max(delivery.subscription.timeoutMs, 500), 30000);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(delivery.subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "cuenti-time-webhooks/1.0",
        "X-Cuenti-Event": delivery.event,
        "X-Cuenti-Delivery": delivery.id,
        "X-Cuenti-Signature": signature,
        "X-Cuenti-Timestamp": envelope.createdAt,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const responseBody = (await res.text()).slice(0, 4000);

    if (res.ok) {
      const prevTimer = inProcessRetryTimers.get(deliveryId);
      if (prevTimer) {
        clearTimeout(prevTimer);
        inProcessRetryTimers.delete(deliveryId);
      }
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "SUCCESS",
          responseStatus: res.status,
          responseBody,
          errorMessage: null,
          deliveredAt: new Date(),
          nextRetryAt: null,
        },
      });
      logWebhook("info", "delivery exitoso", {
        ...baseMeta,
        status: "SUCCESS",
        httpStatus: res.status,
        responsePreview: responseBody.slice(0, 200),
      });
      return "SUCCESS";
    }

    return await markDeliveryFailure(deliveryId, delivery.attempt, {
      responseStatus: res.status,
      responseBody,
      errorMessage: `HTTP ${res.status}`,
      meta: baseMeta,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de red";
    return markDeliveryFailure(deliveryId, delivery.attempt, {
      errorMessage: message,
      meta: baseMeta,
    });
  }
}

async function markDeliveryFailure(
  deliveryId: string,
  attempt: number,
  details: {
    responseStatus?: number;
    responseBody?: string;
    errorMessage: string;
    meta?: Record<string, unknown>;
  }
): Promise<"FAILED" | "PENDING"> {
  const meta = details.meta ?? { deliveryId, attempt };

  // Tras el intento N: si N ya alcanzó 1+3 reintentos → FAILED.
  if (attempt >= WEBHOOK_MAX_ATTEMPTS) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        responseStatus: details.responseStatus ?? null,
        responseBody: details.responseBody ?? null,
        errorMessage: details.errorMessage,
        deliveredAt: new Date(),
        nextRetryAt: null,
      },
    });
    logWebhook("error", "delivery fallido definitivo", {
      ...meta,
      status: "FAILED",
      httpStatus: details.responseStatus ?? null,
      error: details.errorMessage,
      responsePreview: details.responseBody?.slice(0, 200) ?? null,
    });
    return "FAILED";
  }

  const nextRetryAt = new Date(Date.now() + WEBHOOK_RETRY_INTERVAL_MS);
  const retriesLeft = WEBHOOK_MAX_ATTEMPTS - attempt;
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "PENDING",
      responseStatus: details.responseStatus ?? null,
      responseBody: details.responseBody ?? null,
      errorMessage: details.errorMessage,
      nextRetryAt,
    },
  });

  logWebhook("warn", "delivery fallido; reintento programado", {
    ...meta,
    status: "PENDING",
    httpStatus: details.responseStatus ?? null,
    error: details.errorMessage,
    retriesLeft,
    nextRetryAt: nextRetryAt.toISOString(),
    retryInMs: WEBHOOK_RETRY_INTERVAL_MS,
    responsePreview: details.responseBody?.slice(0, 200) ?? null,
  });

  // Reintento automático a los 10 min (hasta 3 veces).
  scheduleInProcessRetry(deliveryId, WEBHOOK_RETRY_INTERVAL_MS);
  return "PENDING";
}

/**
 * Procesa deliveries pendientes con nextRetryAt vencido.
 * Política: 1 envío inmediato + hasta 3 reintentos cada 10 min → FAILED.
 * Usado por cron externo (`POST /api/webhooks/retry`) como respaldo.
 */
export async function processWebhookRetries(limit = 50): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  pending: number;
}> {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: new Date() },
      attempt: { lt: WEBHOOK_MAX_ATTEMPTS },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
    select: { id: true, attempt: true },
  });

  let succeeded = 0;
  let failed = 0;
  let pending = 0;

  if (due.length > 0) {
    logWebhook("info", "worker reintentos iniciado", { due: due.length, limit });
  }

  for (const row of due) {
    // Evitar doble envío si el timer in-process ya lo tomó.
    const claimed = await prisma.webhookDelivery.updateMany({
      where: {
        id: row.id,
        status: "PENDING",
        attempt: row.attempt,
      },
      data: { attempt: row.attempt + 1, nextRetryAt: null },
    });
    if (claimed.count === 0) continue;

    logWebhook("info", "worker reintento", {
      deliveryId: row.id,
      previousAttempt: row.attempt,
      nextAttempt: row.attempt + 1,
    });

    const result = await attemptDelivery(row.id);
    if (result === "SUCCESS") succeeded += 1;
    else if (result === "FAILED") failed += 1;
    else pending += 1;
  }

  if (due.length > 0) {
    logWebhook("info", "worker reintentos finalizado", {
      processed: due.length,
      succeeded,
      failed,
      pending,
    });
  }

  return { processed: due.length, succeeded, failed, pending };
}
