import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ExecutiveSummary, HrSummaryKind } from "@/lib/hr-summary/summary";
import type { HrSummaryPeriod } from "@/lib/hr-summary/period";

function row(label: string, value: string | number): string {
  return `
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:14px">${label}</td>
      <td style="padding:6px 0;text-align:right;font-weight:bold;font-size:14px">${value}</td>
    </tr>`;
}

/**
 * HTML del correo de resumen ejecutivo. Builder puro y determinista
 * (mismo resumen + período → mismo HTML), reutilizando el estilo de
 * los correos transaccionales existentes en src/lib/email.ts.
 */
export function buildHrSummaryEmailHtml(params: {
  companyName: string;
  kind: HrSummaryKind;
  period: HrSummaryPeriod;
  summary: ExecutiveSummary;
}): string {
  const { companyName, kind, period, summary } = params;
  const t = summary.totals;
  const rangeLabel = `${format(period.from, "d MMM", { locale: es })} – ${format(period.to, "d MMM yyyy", { locale: es })}`;
  const title =
    kind === "weekly"
      ? "Resumen ejecutivo semanal de RR. HH."
      : "Resumen ejecutivo diario de RR. HH.";

  const highlights =
    summary.topLateEmployees.length === 0 &&
    summary.topAbsentEmployees.length === 0
      ? `<p style="color:#6b7280;font-size:13px">Sin destacados de tardanza o ausencia en el período.</p>`
      : `
        ${summary.topLateEmployees
          .map(
            (e) => `
          <tr>
            <td style="padding:4px 0;font-size:13px">${e.employeeName}</td>
            <td style="padding:4px 0;text-align:right;font-size:13px;color:#92400e">${e.days} día(s) · ${e.minutes} min</td>
          </tr>`
          )
          .join("")}
        ${summary.topAbsentEmployees
          .map(
            (e) => `
          <tr>
            <td style="padding:4px 0;font-size:13px">${e.employeeName}</td>
            <td style="padding:4px 0;text-align:right;font-size:13px;color:#b91c1c">${e.days} día(s) ausente</td>
          </tr>`
          )
          .join("")}`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
      <h1 style="color:#f97316;font-size:20px">${title}</h1>
      <p>Hola equipo de <strong>${companyName}</strong>,</p>
      <p style="color:#6b7280;font-size:13px;margin-top:-6px">${rangeLabel}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        ${row("Días laborales evaluados", t.workDays)}
        ${row("Presentes", t.present)}
        ${row("Tardanzas", `${t.late} (${t.totalLateMinutes} min)`)}
        ${row("Ausencias", `${t.absent} (+${t.justifiedAbsent} justificadas)`)}
        ${row("Salidas anticipadas", `${t.earlyLeave} (${t.totalEarlyLeaveMinutes} min)`)}
        ${row("Sin salida (días abiertos)", t.openDays)}
        ${row("Índice de puntualidad", `${t.punctualityRate}%`)}
      </table>
      ${
        summary.anomalies.length > 0
          ? `<p style="font-size:13px;color:#b91c1c;font-weight:bold">Anomalías: ${summary.anomalies.length} día(s) sin salida o con tardanza y salida anticipada.</p>`
          : ""
      }
      <table style="width:100%;border-collapse:collapse;margin:8px 0 16px">${highlights}</table>
      <p style="font-size:12px;color:#6b7280">Resumen automático de cuenti time. Consulta el dashboard para el detalle por empleado y sucursal.</p>
    </div>
  `;
}
