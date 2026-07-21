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
  "control-de-asistencia-de-empleados",
  "registro-de-asistencia-facial",
  "software-de-recursos-humanos-en-colombia",
  "control-de-horarios-y-turnos",
  "reporte-de-tardanzas-y-ausencias",
  "geolocalizacion-para-marcacion-laboral",
  "gestion-de-sucursales",
  "api-de-control-de-asistencia",
  "mcp-para-recursos-humanos",
  "seguridad-de-datos-biometricos",
] as const;

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${siteConfig.siteUrl}/`).toString();
}

export function appUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${siteConfig.appUrl}/`).toString();
}
