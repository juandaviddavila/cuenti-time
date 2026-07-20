import { NextRequest, NextResponse } from "next/server";
import { processWebhookRetries } from "@/lib/webhooks/dispatch";

/**
 * Worker de respaldo: 1 envío inicial + hasta 3 reintentos cada 10 min → FAILED.
 * Autenticación: `Authorization: Bearer $CRON_SECRET` o `x-cron-secret`.
 * El proceso también agenda reintentos in-process; este endpoint cubre multi-instancia.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const provided = bearer ?? headerSecret;
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processWebhookRetries(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("POST /api/webhooks/retry error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
