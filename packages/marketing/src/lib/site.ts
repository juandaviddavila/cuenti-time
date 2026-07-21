const DEFAULT_SITE_URL = "http://localhost:3008";
const DEFAULT_APP_URL = "http://localhost:7578";

function normalizeUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;
  return candidate.replace(/\/+$/, "");
}

export const siteConfig = {
  name: "cuenti time",
  description:
    "Software de control de asistencia y gestión de tiempo para empresas, con marcación facial, turnos, sucursales, reportes e integraciones.",
  siteUrl: normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL, DEFAULT_SITE_URL),
  appUrl: normalizeUrl(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_URL),
  locale: "es_CO",
} as const;

export const resourceSlugs = [
  "control-de-tiempo-sin-vigilancia",
  "costo-real-planilla-imperfecta",
  "buddy-punching-como-prevenirlo",
  "ley-2466-2025-horas-extra-colombia",
  "geofence-marcacion-laboral",
  "biometria-laboral-ley-1581",
  "reportes-rrhh-que-si-sirven",
  "roi-software-asistencia-90-dias",
  "rrhh-ia-api-webhooks-mcp",
  "elegir-software-asistencia-colombia",
] as const;

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${siteConfig.siteUrl}/`).toString();
}

export function appUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${siteConfig.appUrl}/`).toString();
}
