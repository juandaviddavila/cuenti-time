export type MarketingBillingConfig = {
  freeEmployeeLimit: number;
  priceCopPerEmployeeMonthly: number;
  priceUsdPerEmployeeMonthly: number;
  billingPeriodDays: number;
};

/** Mismos defaults que `src/lib/billing/config.ts` (tabla BillingConfig). */
export const FALLBACK_BILLING_CONFIG: MarketingBillingConfig = {
  freeEmployeeLimit: 3,
  priceCopPerEmployeeMonthly: 3500,
  priceUsdPerEmployeeMonthly: 1,
  billingPeriodDays: 30,
};

export function getAppApiUrl(): string {
  // En build local: opcional apuntar al SaaS en marcha (evita depender del dominio prod).
  const buildOverride = process.env.MARKETING_BILLING_API_URL?.trim();
  if (buildOverride) return buildOverride.replace(/\/$/, "");

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:7578";
}

function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Lee precios desde el SaaS (`GET /api/billing/config`). Revalida cada 60s. */
export async function fetchBillingConfig(): Promise<MarketingBillingConfig> {
  const url = `${getAppApiUrl()}/api/billing/config`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 60, tags: ["billing-config"] },
      headers: { Accept: "application/json" },
      // Evita colgar el `next build` si el host no responde
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
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
      throw new Error("payload inválido");
    }
    return {
      freeEmployeeLimit: data.freeEmployeeLimit,
      priceCopPerEmployeeMonthly: data.priceCopPerEmployeeMonthly,
      priceUsdPerEmployeeMonthly: data.priceUsdPerEmployeeMonthly,
      billingPeriodDays:
        typeof data.billingPeriodDays === "number" ? data.billingPeriodDays : 30,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "error desconocido";
    // Build / dominio aún no público: no tumbar SSG. En runtime ISR reintentará a los 60s.
    console.warn(
      `[marketing] billing config no disponible (${url}): ${reason}. Usando defaults.`
    );
    if (isProductionBuild()) {
      return FALLBACK_BILLING_CONFIG;
    }
    // También en runtime: mejor página con defaults que 500
    return FALLBACK_BILLING_CONFIG;
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
