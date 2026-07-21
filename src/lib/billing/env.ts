function envFlag(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getCuentiPayEnv() {
  return {
    enabled: envFlag("CUENTI_PAY_ENABLED", false),
    authToken: process.env.CUENTI_PAY_AUTH_TOKEN?.trim() ?? "",
    apiUrl:
      process.env.CUENTI_PAY_API_URL?.trim() ||
      "https://api.cuenti.co/jServerj4ErpPro/api/token/grabarDocumentoSimple",
    voidApiUrl:
      process.env.CUENTI_PAY_VOID_API_URL?.trim() ||
      "https://api.cuenti.co/jServerj4ErpPro/com/j4ErpPro/server/transacion/anularTransacion",
    empresaId: envInt("CUENTI_PAY_EMPRESA_ID", 2),
    empleadoId: envInt("CUENTI_PAY_EMPLEADO_ID", 1),
    gtm: process.env.CUENTI_PAY_GTM?.trim() || "GMT-0500",
    webhookSecret: process.env.BILLING_WEBHOOK_SECRET?.trim() || "",
  };
}

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(/\/$/, "");
}
