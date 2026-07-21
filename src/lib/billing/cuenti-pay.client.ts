import type { BillingConfigCuenti, BillingCurrency, BillingCustomerInput } from "@/lib/billing/types";
import { getCuentiPayEnv } from "@/lib/billing/env";

export interface CuentiPayCreateInput {
  codigoUnico: string;
  invoiceId: string;
  currency: BillingCurrency;
  quantity: number;
  /** Total a cobrar de la línea (no precio unitario suelto). */
  unitTotal: number;
  description: string;
  billingCustomer: BillingCustomerInput;
  cuenti: BillingConfigCuenti;
  appBaseUrl: string;
  webhookUrl: string;
}

export interface CuentiPayCreateResult {
  success: boolean;
  message: string;
  transactionId: number | null;
  paymentUrl: string | null;
  invoiceUrlExternal: string | null;
  internalUrl: string | null;
  raw: unknown;
}

export interface CuentiVoidTransactionResult {
  success: boolean;
  message: string;
  raw: unknown;
}

interface CuentiPayResponse {
  type?: number;
  message?: string;
  retorno?: string;
  id_transacion?: number;
  url_interna?: string;
  url_externa?: string;
  cuenti_pay?: { type?: number; url?: string };
}

function cuentiPayHeaders() {
  const env = getCuentiPayEnv();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.authToken}`,
    "x-auth-token-empresa": String(env.empresaId),
    "x-gtm": env.gtm,
    "x-id-empleado": String(env.empleadoId),
  };
}

async function parseCuentiResponse(response: Response): Promise<{
  okJson: boolean;
  raw: unknown;
  text: string;
}> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return { okJson: false, raw: null, text };
  }
  try {
    return { okJson: true, raw: JSON.parse(trimmed) as unknown, text };
  } catch {
    return { okJson: false, raw: trimmed, text };
  }
}

function asPayResponse(raw: unknown): CuentiPayResponse | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as CuentiPayResponse;
}

export async function createPaymentDocument(
  input: CuentiPayCreateInput
): Promise<CuentiPayCreateResult> {
  const env = getCuentiPayEnv();
  if (!env.enabled) {
    return {
      success: false,
      message: "La pasarela de pagos no está configurada (CUENTI_PAY_ENABLED=false)",
      transactionId: null,
      paymentUrl: null,
      invoiceUrlExternal: null,
      internalUrl: null,
      raw: null,
    };
  }

  if (!env.authToken) {
    return {
      success: false,
      message: "Falta CUENTI_PAY_AUTH_TOKEN",
      transactionId: null,
      paymentUrl: null,
      invoiceUrlExternal: null,
      internalUrl: null,
      raw: null,
    };
  }

  const idProducto =
    input.currency === "COP" ? input.cuenti.id_producto_cop : input.cuenti.id_producto_usd;

  const body = {
    tipoDocumento: input.cuenti.tipoDocumento,
    type_match_producto: input.cuenti.type_match_producto,
    id_consecutivo: input.cuenti.id_consecutivo,
    nota: `cuenti time — ${input.quantity} empleado(s)`,
    observacion: `Company billing ${input.codigoUnico}`,
    id_sucursal: input.cuenti.id_sucursal,
    id_bodega: input.cuenti.id_bodega,
    id_vendedor: input.cuenti.id_vendedor,
    id_empleado: input.cuenti.id_empleado,
    codigo_unico: input.codigoUnico,
    objClienteMini: {
      id_cliente: -1,
      nombre_cliente: input.billingCustomer.nombre_cliente,
      identificacion: input.billingCustomer.identificacion,
      telefono1: input.billingCustomer.telefono1,
      telefono2: "",
      email1: "",
      direccion: "N/A",
      id_tipo_persona: input.billingCustomer.id_tipo_persona,
      es_cliente: 1,
      es_proveedor: 0,
      departamento: "",
      pais: input.currency === "COP" ? "Colombia" : "Estados Unidos",
      ciudad: "",
      zona: "",
    },
    objDetalle: [
      {
        cantidad: input.quantity,
        id_producto: idProducto,
        descripcion: input.description,
        total: input.unitTotal,
      },
    ],
    generar_link_pago: true,
    config_link_pago: {
      responseUrl: `${input.appBaseUrl}/pricing?invoice=${input.invoiceId}`,
      country: input.currency === "COP" ? "CO" : "US",
      currency: input.currency,
      web_hook: input.webhookUrl,
      id_consecutivo: input.cuenti.id_consecutivo_link_pago,
      convertir_remision_factura: input.cuenti.convertir_remision_factura,
    },
  };

  let response: Response;
  try {
    response = await fetch(env.apiUrl, {
      method: "POST",
      headers: cuentiPayHeaders(),
      body: JSON.stringify(body),
    });
  } catch (error) {
    return {
      success: false,
      message: `Error de red al llamar Cuenti Pay: ${error instanceof Error ? error.message : "desconocido"}`,
      transactionId: null,
      paymentUrl: null,
      invoiceUrlExternal: null,
      internalUrl: null,
      raw: null,
    };
  }

  const parsed = await parseCuentiResponse(response);
  if (!parsed.okJson) {
    const preview = parsed.text.slice(0, 200);
    return {
      success: false,
      message: `Cuenti Pay devolvió una respuesta no JSON (HTTP ${response.status}): ${preview}`,
      transactionId: null,
      paymentUrl: null,
      invoiceUrlExternal: null,
      internalUrl: null,
      raw: parsed.raw,
    };
  }

  const raw = asPayResponse(parsed.raw);
  const success = raw?.type === 1;
  return {
    success: Boolean(success),
    message:
      raw?.message ??
      (success ? "Documento creado" : "Error al crear documento de pago"),
    transactionId: raw?.id_transacion ?? null,
    paymentUrl: raw?.cuenti_pay?.url ?? null,
    invoiceUrlExternal: raw?.url_externa ?? null,
    internalUrl: raw?.url_interna ?? null,
    raw: parsed.raw,
  };
}

export async function voidTransaction(input: {
  id_transacion: number;
  id_empleado?: number;
  nota?: string;
  observacion?: string;
}): Promise<CuentiVoidTransactionResult> {
  const env = getCuentiPayEnv();
  if (!env.enabled) {
    return { success: true, message: "Pasarela deshabilitada", raw: null };
  }

  const body = {
    id_encabezado_anulada: 0,
    id_transacion: input.id_transacion,
    id_empleado: input.id_empleado ?? env.empleadoId,
    observacion: input.observacion ?? "",
    nota: input.nota ?? "Anulación de pago pendiente",
    esEliminar: true,
  };

  let response: Response;
  try {
    response = await fetch(env.voidApiUrl, {
      method: "POST",
      headers: cuentiPayHeaders(),
      body: JSON.stringify(body),
    });
  } catch (error) {
    return {
      success: false,
      message: `Error de red al anular en Cuenti Pay: ${error instanceof Error ? error.message : "desconocido"}`,
      raw: null,
    };
  }

  const parsed = await parseCuentiResponse(response);
  if (!parsed.okJson) {
    return {
      success: false,
      message: `Cuenti Pay (anular) devolvió respuesta no JSON (HTTP ${response.status}): ${parsed.text.slice(0, 200)}`,
      raw: parsed.raw,
    };
  }

  const raw = asPayResponse(parsed.raw);
  const success = raw?.type === 1;
  return {
    success: Boolean(success),
    message:
      raw?.message ??
      (success ? "Transacción anulada" : "No se pudo anular la transacción"),
    raw: parsed.raw,
  };
}
