import { endOfDay, endOfWeek, startOfDay, startOfWeek } from "date-fns";
import type { HrSummaryKind } from "@/lib/hr-summary/summary";

export interface HrSummaryPeriod {
  kind: HrSummaryKind;
  from: Date;
  to: Date;
  /**
   * Ancla de idempotencia escrita en LateReportLog.date.
   * Diario = medianoche local del día; semanal = mediodía local del lunes
   * de la semana. Así ambos resúmenes conviven en el mismo modelo
   * LateReportLog (que no tiene columna de "kind") sin colisionar, y sin
   * requerir cambios de schema ni migración.
   */
  anchor: Date;
}

/** Semana laboral de inicio en lunes (convención del negocio, locale es). */
const WEEK_STARTS_ON = 1;

export function dailySummaryPeriod(now: Date = new Date()): HrSummaryPeriod {
  const from = startOfDay(now);
  return { kind: "daily", from, to: endOfDay(now), anchor: from };
}

export function weeklySummaryPeriod(now: Date = new Date()): HrSummaryPeriod {
  const from = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const to = endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  // Mediodía local: marca inequívoca del resumen semanal frente al diario.
  const anchor = new Date(from);
  anchor.setHours(12, 0, 0, 0);
  return { kind: "weekly", from, to, anchor };
}

export function resolveSummaryPeriod(
  kind: HrSummaryKind,
  now: Date = new Date()
): HrSummaryPeriod {
  return kind === "weekly" ? weeklySummaryPeriod(now) : dailySummaryPeriod(now);
}
