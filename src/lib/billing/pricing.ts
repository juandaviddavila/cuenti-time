import type {
  BillingCurrency,
  BillingInvoiceKind,
  BillingQuote,
  BillingQuoteInput,
} from "@/lib/billing/types";

/** Periodo de suscripción/renovación y denominador de prorrateo de addons. */
export const BILLING_PERIOD_DAYS = 30;

export interface BillingPricingConfig {
  priceCopPerEmployeeMonthly: number;
  priceUsdPerEmployeeMonthly: number;
}

export interface BillingQuoteContext {
  usedSlots: number;
  currentEmployeeSlots: number;
  subscriptionExpiresAt: Date | null;
  subscriptionStatus: string;
  now?: Date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function roundMoney(amount: number, currency: BillingCurrency): number {
  if (currency === "COP") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

function unitPriceForCurrency(
  currency: BillingCurrency,
  config: BillingPricingConfig
): number {
  return currency === "COP"
    ? config.priceCopPerEmployeeMonthly
    : config.priceUsdPerEmployeeMonthly;
}

function hasActiveSubscription(ctx: BillingQuoteContext, now: Date): boolean {
  return Boolean(
    ctx.subscriptionExpiresAt &&
      ctx.subscriptionExpiresAt > now &&
      ctx.subscriptionStatus === "active"
  );
}

export function computeBillingQuote(
  input: BillingQuoteInput,
  config: BillingPricingConfig,
  ctx: BillingQuoteContext
): BillingQuote {
  const now = ctx.now ?? new Date();
  const usedSlots = ctx.usedSlots;
  const currentEmployeeSlots = ctx.currentEmployeeSlots;
  const minEmployeeSlots = Math.max(usedSlots, 1);

  if (input.targetEmployeeSlots < usedSlots) {
    throw new Error(
      `No puedes pagar por menos de ${usedSlots} empleado(s), que es el uso actual de la empresa.`
    );
  }

  const unitPrice = unitPriceForCurrency(input.currency, config);
  const active = hasActiveSubscription(ctx, now);

  if (active && input.targetEmployeeSlots > currentEmployeeSlots) {
    const additionalEmployees = input.targetEmployeeSlots - currentEmployeeSlots;
    const remainingMs = ctx.subscriptionExpiresAt!.getTime() - now.getTime();
    const proratedDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    const totalAmount = roundMoney(
      additionalEmployees * unitPrice * (proratedDays / BILLING_PERIOD_DAYS),
      input.currency
    );

    return {
      kind: "addon",
      currency: input.currency,
      targetEmployeeSlots: input.targetEmployeeSlots,
      billedEmployeeQuantity: additionalEmployees,
      unitPrice,
      totalAmount,
      proratedDays,
      periodStart: now.toISOString(),
      periodEnd: ctx.subscriptionExpiresAt!.toISOString(),
      minEmployeeSlots,
      currentEmployeeSlots,
      usedSlots,
      isProrated: true,
    };
  }

  if (active && input.targetEmployeeSlots <= currentEmployeeSlots) {
    throw new Error(
      "Ya tienes una suscripción activa con ese cupo o más. Solo puedes comprar empleados adicionales o esperar al vencimiento para renovar."
    );
  }

  const kind: BillingInvoiceKind =
    ctx.subscriptionStatus === "expired" ? "renewal" : "subscription";
  const periodEnd = addDays(now, BILLING_PERIOD_DAYS);
  const totalAmount = roundMoney(input.targetEmployeeSlots * unitPrice, input.currency);

  return {
    kind,
    currency: input.currency,
    targetEmployeeSlots: input.targetEmployeeSlots,
    billedEmployeeQuantity: input.targetEmployeeSlots,
    unitPrice,
    totalAmount,
    proratedDays: null,
    periodStart: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
    minEmployeeSlots,
    currentEmployeeSlots,
    usedSlots,
    isProrated: false,
  };
}
