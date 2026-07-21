import type { BillingInvoice, Company, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bigintToString, stringToBigint } from "@/lib/bigint";
import {
  getBillingConfig,
  toBillingConfigPublic,
  toCuentiConfig,
} from "@/lib/billing/config";
import { generateCodigoUnicoNumeric } from "@/lib/billing/codigo-unico";
import { createPaymentDocument, voidTransaction } from "@/lib/billing/cuenti-pay.client";
import { getAppBaseUrl, getCuentiPayEnv } from "@/lib/billing/env";
import {
  assertInvoiceCancellable,
  BillingConflictError,
} from "@/lib/billing/invoice-rules";
export { BillingConflictError } from "@/lib/billing/invoice-rules";
import { computeBillingQuote, BILLING_PERIOD_DAYS } from "@/lib/billing/pricing";
import type {
  BillingCheckoutInput,
  BillingInvoiceDto,
  BillingInvoiceStatus,
  BillingQuote,
  BillingQuoteInput,
  SubscriptionStatus,
} from "@/lib/billing/types";
import { BILLING_INVOICE_ALREADY_PAID_MESSAGE } from "@/lib/billing/types";

export class BillingValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "BillingValidationError";
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function createUniqueCodigoUnico(
  idEmpresa: number,
  tipoDocumento: number,
  idUsuario: number
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const codigoUnico = generateCodigoUnicoNumeric({
      idEmpresa,
      tipoDocumento,
      idUsuario,
      suffixLen: 8,
    });
    const exists = await prisma.billingInvoice.findUnique({
      where: { codigoUnico },
      select: { id: true },
    });
    if (!exists) return codigoUnico;
  }
  throw new BillingConflictError("No se pudo generar un código de pago único");
}

export function toBillingInvoiceDto(invoice: BillingInvoice): BillingInvoiceDto {
  return {
    id: bigintToString(invoice.id),
    codigoUnico: invoice.codigoUnico,
    companyId: bigintToString(invoice.companyId),
    status: invoice.status as BillingInvoiceStatus,
    kind: invoice.kind as BillingInvoiceDto["kind"],
    currency: invoice.currency as BillingInvoiceDto["currency"],
    targetEmployeeSlots: invoice.targetEmployeeSlots,
    billedEmployeeQuantity: invoice.billedEmployeeQuantity,
    unitPrice: invoice.unitPrice,
    totalAmount: invoice.totalAmount,
    proratedDays: invoice.proratedDays,
    periodStart: invoice.periodStart.toISOString(),
    periodEnd: invoice.periodEnd.toISOString(),
    billingCustomer: {
      nombre_cliente: invoice.customerNombre,
      identificacion: invoice.customerIdentificacion,
      telefono1: invoice.customerTelefono,
      id_tipo_persona: invoice.customerTipoPersona === 2 ? 2 : 1,
    },
    paymentUrl: invoice.paymentUrl,
    invoiceUrlExternal: invoice.invoiceUrlExternal,
    cuentiTransactionId: invoice.cuentiTransactionId,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
  };
}

export async function countUsedEmployeeSlots(companyId: bigint): Promise<number> {
  return prisma.employee.count({
    where: { companyId, status: "ACTIVE" },
  });
}

export async function syncCompanySubscriptionStatus(
  company: Company
): Promise<Company> {
  if (company.plan === "free") {
    if (company.subscriptionStatus !== "none" && company.subscriptionStatus !== "pending_payment") {
      return prisma.company.update({
        where: { id: company.id },
        data: { subscriptionStatus: "none", subscriptionExpiresAt: null },
      });
    }
    return company;
  }

  if (
    company.subscriptionExpiresAt &&
    company.subscriptionExpiresAt.getTime() <= Date.now() &&
    company.subscriptionStatus !== "pending_payment"
  ) {
    if (company.subscriptionStatus !== "expired") {
      return prisma.company.update({
        where: { id: company.id },
        data: { subscriptionStatus: "expired" },
      });
    }
  }

  return company;
}

export async function buildQuote(
  company: Company,
  input: BillingQuoteInput
): Promise<BillingQuote> {
  const config = await getBillingConfig();
  const usedSlots = await countUsedEmployeeSlots(company.id);
  try {
    return computeBillingQuote(
      input,
      {
        priceCopPerEmployeeMonthly: config.priceCopPerEmployeeMonthly,
        priceUsdPerEmployeeMonthly: config.priceUsdPerEmployeeMonthly,
      },
      {
        usedSlots,
        currentEmployeeSlots: company.maxEmployees,
        subscriptionExpiresAt: company.subscriptionExpiresAt,
        subscriptionStatus: company.subscriptionStatus,
      }
    );
  } catch (err) {
    throw new BillingValidationError(
      err instanceof Error ? err.message : "Cotización inválida"
    );
  }
}

export async function getCompanyBillingStatus(companyId: bigint) {
  let company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new BillingValidationError("Empresa no encontrada");

  company = await syncCompanySubscriptionStatus(company);
  const config = await getBillingConfig();
  const usedSlots = await countUsedEmployeeSlots(company.id);
  const pendingInvoice = await prisma.billingInvoice.findFirst({
    where: { companyId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  const recentInvoices = await prisma.billingInvoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    plan: company.plan,
    subscriptionStatus: company.subscriptionStatus as SubscriptionStatus,
    subscriptionExpiresAt: company.subscriptionExpiresAt?.toISOString() ?? null,
    maxEmployees: company.maxEmployees,
    usedSlots,
    freeEmployeeLimit: config.freeEmployeeLimit,
    hasPendingInvoice: Boolean(pendingInvoice),
    pendingInvoice: pendingInvoice ? toBillingInvoiceDto(pendingInvoice) : null,
    recentInvoices: recentInvoices.map(toBillingInvoiceDto),
    publicConfig: toBillingConfigPublic(config),
  };
}

export async function getPublicBillingConfig() {
  const config = await getBillingConfig();
  return toBillingConfigPublic(config);
}

export async function createCheckout(
  company: Company,
  userId: bigint,
  input: BillingCheckoutInput
): Promise<BillingInvoiceDto> {
  const existingPending = await prisma.billingInvoice.findFirst({
    where: { companyId: company.id, status: "pending" },
    select: { id: true },
  });
  if (existingPending) {
    throw new BillingConflictError(
      "Ya tienes un pago pendiente. Cancélalo antes de generar uno nuevo."
    );
  }

  const quote = await buildQuote(company, input);
  const config = await getBillingConfig();
  const cuentiEnv = getCuentiPayEnv();
  const codigoUnico = await createUniqueCodigoUnico(
    cuentiEnv.empresaId,
    config.tipoDocumento,
    cuentiEnv.empleadoId
  );

  const invoice = await prisma.billingInvoice.create({
    data: {
      codigoUnico,
      companyId: company.id,
      createdByUserId: userId,
      status: "pending",
      kind: quote.kind,
      currency: quote.currency,
      targetEmployeeSlots: quote.targetEmployeeSlots,
      billedEmployeeQuantity: quote.billedEmployeeQuantity,
      unitPrice: quote.unitPrice,
      totalAmount: quote.totalAmount,
      proratedDays: quote.proratedDays,
      periodStart: new Date(quote.periodStart),
      periodEnd: new Date(quote.periodEnd),
      customerNombre: input.billingCustomer.nombre_cliente,
      customerIdentificacion: input.billingCustomer.identificacion,
      customerTelefono: input.billingCustomer.telefono1,
      customerTipoPersona: input.billingCustomer.id_tipo_persona,
    },
  });

  const appBaseUrl = getAppBaseUrl();
  const webhookUrl = `${appBaseUrl}/api/billing/webhook/${codigoUnico}`;
  const cuentiResult = await createPaymentDocument({
    codigoUnico,
    invoiceId: bigintToString(invoice.id),
    currency: quote.currency,
    quantity: quote.billedEmployeeQuantity,
    unitTotal: quote.totalAmount,
    description: config.descripcionProducto,
    billingCustomer: input.billingCustomer,
    cuenti: toCuentiConfig(config),
    appBaseUrl,
    webhookUrl,
  });

  if (!cuentiResult.success) {
    await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "failed",
        cuentiErrorMessage: cuentiResult.message,
        cuentiRawResponse: cuentiResult.raw as Prisma.InputJsonValue,
      },
    });
    throw new BillingValidationError(cuentiResult.message);
  }

  const updated = await prisma.billingInvoice.update({
    where: { id: invoice.id },
    data: {
      paymentUrl: cuentiResult.paymentUrl,
      invoiceUrlExternal: cuentiResult.invoiceUrlExternal,
      cuentiInternalUrl: cuentiResult.internalUrl,
      cuentiTransactionId: cuentiResult.transactionId,
      cuentiRawResponse: cuentiResult.raw as Prisma.InputJsonValue,
    },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { subscriptionStatus: "pending_payment" },
  });

  return toBillingInvoiceDto(updated);
}

export async function cancelPendingInvoice(
  companyId: bigint,
  invoiceId: string
): Promise<BillingInvoiceDto> {
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: stringToBigint(invoiceId), companyId },
  });
  if (!invoice) {
    throw new BillingValidationError("Factura no encontrada");
  }

  assertInvoiceCancellable(invoice);

  if (invoice.cuentiTransactionId) {
    const voidResult = await voidTransaction({
      id_transacion: invoice.cuentiTransactionId,
      nota: "Anulación de pago pendiente cuenti time",
      observacion: `Cancelación factura ${invoice.codigoUnico}`,
    });
    if (!voidResult.success) {
      throw new BillingValidationError(voidResult.message);
    }
  }

  const updated = await prisma.billingInvoice.updateMany({
    where: {
      id: invoice.id,
      companyId,
      status: "pending",
      paidAt: null,
    },
    data: { status: "cancelled" },
  });

  if (updated.count === 0) {
    const latest = await prisma.billingInvoice.findUnique({ where: { id: invoice.id } });
    if (latest?.status === "paid" || latest?.paidAt) {
      throw new BillingConflictError(BILLING_INVOICE_ALREADY_PAID_MESSAGE);
    }
    throw new BillingConflictError("El pago ya no se puede cancelar");
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (company?.subscriptionStatus === "pending_payment") {
    const stillPending = await prisma.billingInvoice.findFirst({
      where: { companyId, status: "pending" },
      select: { id: true },
    });
    if (!stillPending) {
      let nextStatus: SubscriptionStatus = "none";
      if (
        company.subscriptionExpiresAt &&
        company.subscriptionExpiresAt.getTime() > Date.now()
      ) {
        nextStatus = "active";
      } else if (company.subscriptionExpiresAt) {
        nextStatus = "expired";
      }
      await prisma.company.update({
        where: { id: companyId },
        data: { subscriptionStatus: nextStatus },
      });
    }
  }

  const cancelled = await prisma.billingInvoice.findUniqueOrThrow({
    where: { id: invoice.id },
  });
  return toBillingInvoiceDto(cancelled);
}

export async function handleBillingWebhook(
  codigoUnico: string,
  payload: unknown
): Promise<void> {
  const invoice = await prisma.billingInvoice.findUnique({ where: { codigoUnico } });
  if (!invoice) {
    throw new BillingValidationError("Factura no encontrada");
  }
  if (invoice.status === "paid") return;
  if (invoice.status !== "pending") {
    throw new BillingConflictError("La factura no está pendiente de pago");
  }

  const previousRaw =
    invoice.cuentiRawResponse && typeof invoice.cuentiRawResponse === "object"
      ? (invoice.cuentiRawResponse as Record<string, unknown>)
      : {};

  await prisma.billingInvoice.update({
    where: { id: invoice.id },
    data: {
      status: "paid",
      paidAt: new Date(),
      cuentiRawResponse: {
        ...previousRaw,
        webhook: payload,
      } as Prisma.InputJsonValue,
    },
  });

  const company = await prisma.company.findUnique({ where: { id: invoice.companyId } });
  if (!company) {
    throw new BillingValidationError("Empresa no encontrada");
  }

  const data: Prisma.CompanyUpdateInput = {
    plan: "paid",
    maxEmployees: invoice.targetEmployeeSlots,
    subscriptionStatus: "active",
    subscriptionRenewalReminderFor: null,
  };

  if (invoice.kind === "addon") {
    data.subscriptionExpiresAt = invoice.periodEnd;
  } else {
    const base =
      company.subscriptionExpiresAt && company.subscriptionExpiresAt.getTime() > Date.now()
        ? company.subscriptionExpiresAt
        : new Date();
    data.subscriptionExpiresAt = addDays(base, BILLING_PERIOD_DAYS);
  }

  await prisma.company.update({
    where: { id: company.id },
    data,
  });
}

export async function listInvoices(companyId: bigint): Promise<BillingInvoiceDto[]> {
  const invoices = await prisma.billingInvoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return invoices.map(toBillingInvoiceDto);
}
