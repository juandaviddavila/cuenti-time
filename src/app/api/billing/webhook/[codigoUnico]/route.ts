import { NextRequest, NextResponse } from "next/server";
import {
  BillingConflictError,
  BillingValidationError,
  handleBillingWebhook,
} from "@/lib/billing/service";
import { getCuentiPayEnv } from "@/lib/billing/env";
import { isNumericCodigoUnico } from "@/lib/billing/codigo-unico";

interface RouteParams {
  params: { codigoUnico: string };
}

/**
 * Webhook público Cuenti Pay.
 * Riesgos: quien conozca codigoUnico puede marcar paid.
 * Mitigación: BILLING_WEBHOOK_SECRET (header x-billing-webhook-secret) si está configurado.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { codigoUnico } = params;
  if (!isNumericCodigoUnico(codigoUnico)) {
    return NextResponse.json({ error: "codigoUnico inválido" }, { status: 400 });
  }

  const env = getCuentiPayEnv();
  if (env.webhookSecret) {
    const provided = request.headers.get("x-billing-webhook-secret");
    if (provided !== env.webhookSecret) {
      return NextResponse.json({ error: "Webhook no autorizado" }, { status: 401 });
    }
  }

  let payload: unknown = null;
  try {
    const text = await request.text();
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: "non-json-body" };
  }

  try {
    await handleBillingWebhook(codigoUnico, payload);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BillingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof BillingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("billing webhook error", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
