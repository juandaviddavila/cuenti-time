export type MarketingBillingConfig = {
  freeEmployeeLimit: number;
  priceCopPerEmployeeMonthly: number;
  priceUsdPerEmployeeMonthly: number;
  billingPeriodDays: number;
};

export function getAppApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:7578";
}

/** Lee precios desde el SaaS (`GET /api/billing/config`). Revalida cada 60s. */
export async function fetchBillingConfig(): Promise<MarketingBillingConfig> {
  try {
    const res = await fetch(`${getAppApiUrl()}/api/billing/config`, {
      next: { revalidate: 60, tags: ["billing-config"] },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Billing config respondió HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: Partial<MarketingBillingConfig>;
    };
    const data = json.data;
    if (
      !data ||
      typeof data.freeEmployeeLimit !== "number" ||
      typeof data.priceCopPerEmployeeMonthly !== "number" ||
      typeof data.priceUsdPerEmployeeMonthly !== "number"
    ) {
      throw new Error("Billing config devolvió datos inválidos");
    }
    return {
      freeEmployeeLimit: data.freeEmployeeLimit,
      priceCopPerEmployeeMonthly: data.priceCopPerEmployeeMonthly,
      priceUsdPerEmployeeMonthly: data.priceUsdPerEmployeeMonthly,
      billingPeriodDays:
        typeof data.billingPeriodDays === "number" ? data.billingPeriodDays : 30,
    };
  } catch (error) {
    throw new Error(
      `No se pudo leer la configuración de billing desde la base de datos: ${
        error instanceof Error ? error.message : "error desconocido"
      }`
    );
  }
}

export function formatCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
