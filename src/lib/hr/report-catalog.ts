import {
  Building2,
  CalendarClock,
  CalendarX2,
  Clock,
  LogOut,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { HrReportKind } from "@/lib/hr/day-evaluation";

/** Slug de URL pública (kebab-case). */
export type ReportSlug =
  | "absences"
  | "lates"
  | "early-leaves"
  | "open-days"
  | "employee-summary"
  | "branch-summary"
  | "daily";

export interface ReportCatalogItem {
  slug: ReportSlug;
  kind: HrReportKind;
  title: string;
  question: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export const REPORT_CATALOG: ReportCatalogItem[] = [
  {
    slug: "absences",
    kind: "absences",
    title: "¿Quién faltó?",
    question: "Ausencias del período",
    description: "Días laborales sin entrada, con o sin novedad justificativa.",
    icon: CalendarX2,
    href: "/reports/absences",
  },
  {
    slug: "lates",
    kind: "lates",
    title: "¿Quién llegó tarde?",
    question: "Tardanzas con minutos",
    description: "Comparado contra turno + tolerancia de entrada de la empresa.",
    icon: Clock,
    href: "/reports/lates",
  },
  {
    slug: "early-leaves",
    kind: "early_leaves",
    title: "¿Quién salió antes?",
    question: "Salidas anticipadas",
    description: "Salida antes del fin de turno − tolerancia de salida.",
    icon: LogOut,
    href: "/reports/early-leaves",
  },
  {
    slug: "open-days",
    kind: "open_days",
    title: "¿Quién no cerró el día?",
    question: "Entrada sin salida",
    description: "Marcaciones abiertas: CHECK_IN sin CHECK_OUT.",
    icon: CalendarClock,
    href: "/reports/open-days",
  },
  {
    slug: "employee-summary",
    kind: "employee_summary",
    title: "Resumen por empleado",
    question: "KPIs del rango",
    description: "Días laborales, ausencias, puntualidad y minutos acumulados.",
    icon: Users,
    href: "/reports/employee-summary",
  },
  {
    slug: "branch-summary",
    kind: "branch_summary",
    title: "Resumen por sucursal",
    question: "Vista multi-sucursal",
    description: "Mismos KPIs agregados por sucursal.",
    icon: Building2,
    href: "/reports/branch-summary",
  },
  {
    slug: "daily",
    kind: "daily",
    title: "Diario operativo",
    question: "Snapshot del día",
    description: "Presentes, tardanzas, ausentes y sin salida (hoy o rango).",
    icon: Sun,
    href: "/reports/daily",
  },
];

const BY_SLUG = new Map(REPORT_CATALOG.map((r) => [r.slug, r]));

export function isReportSlug(value: string): value is ReportSlug {
  return BY_SLUG.has(value as ReportSlug);
}

export function getReportBySlug(slug: string): ReportCatalogItem | null {
  return BY_SLUG.get(slug as ReportSlug) ?? null;
}

export const EMPTY_REPORT_MESSAGES: Record<HrReportKind, string> = {
  absences: "Sin ausencias en el período",
  lates: "Sin tardanzas en el período",
  early_leaves: "Sin salidas anticipadas en el período",
  open_days: "Todos cerraron el día en el período",
  employee_summary: "Sin datos de empleados en el período",
  branch_summary: "Sin datos de sucursales en el período",
  daily: "Sin días laborales en el período",
};
