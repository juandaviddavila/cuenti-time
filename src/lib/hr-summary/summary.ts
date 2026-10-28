import type { DayEvaluation, DayOutcome } from "@/lib/hr/day-evaluation";

/**
 * Motor de resumen ejecutivo de RR. HH. (T2 / S1–S2 del roadmap).
 *
 * Función pura y determinista: el mismo conjunto de evaluaciones siempre
 * produce el mismo resumen, con orden estable en todos los listados.
 * No incluye scoring de trabajadores, sanciones ni comportamiento pre-nómina.
 */

export type HrSummaryKind = "daily" | "weekly";

export interface HrSummaryTotals {
  /** Días laborales evaluados (empleado × día con turno). */
  workDays: number;
  present: number;
  late: number;
  absent: number;
  justifiedAbsent: number;
  earlyLeave: number;
  /** Entradas sin salida (día abierto). */
  openDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  /** % de días laborales sin ausencia ni tardanza. */
  punctualityRate: number;
}

export interface HrSummaryEmployeeHighlight {
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  days: number;
  /** Minutos acumulados (tardanza para topLate, 0 para ausencias). */
  minutes: number;
}

export type HrSummaryAnomalyKind = "SIN_SALIDA" | "TARDE_Y_SALIDA_ANTICIPADA";

export interface HrSummaryAnomaly {
  employeeId: string;
  employeeName: string;
  branchName: string;
  date: string;
  kind: HrSummaryAnomalyKind;
  label: string;
}

export interface HrSummaryBranch {
  branchId: string;
  branchName: string;
  late: number;
  absent: number;
  justifiedAbsent: number;
  earlyLeave: number;
  openDays: number;
  totalLateMinutes: number;
}

export interface ExecutiveSummary {
  totals: HrSummaryTotals;
  /** Hasta 5 empleados con más minutos de tardanza. */
  topLateEmployees: HrSummaryEmployeeHighlight[];
  /** Hasta 5 empleados con más días ausente. */
  topAbsentEmployees: HrSummaryEmployeeHighlight[];
  /** Días abiertos y tardanza + salida anticipada combinadas. */
  anomalies: HrSummaryAnomaly[];
  byBranch: HrSummaryBranch[];
}

const HIGHLIGHT_LIMIT = 5;

const ANOMALY_OUTCOMES: ReadonlySet<DayOutcome> = new Set<DayOutcome>([
  "SIN_SALIDA",
  "TARDE_Y_SALIDA_ANTICIPADA",
]);

const PRESENT_OUTCOMES: ReadonlySet<DayOutcome> = new Set<DayOutcome>([
  "PRESENTE",
  "TARDE",
  "SALIDA_ANTICIPADA",
  "TARDE_Y_SALIDA_ANTICIPADA",
  "SIN_SALIDA",
]);

/** Determinista: métrica descendente, desempate por nombre (locale es), luego id. */
function compareHighlights(
  a: HrSummaryEmployeeHighlight,
  b: HrSummaryEmployeeHighlight
): number {
  if (b.minutes !== a.minutes) return b.minutes - a.minutes;
  const byName = a.employeeName.localeCompare(b.employeeName, "es");
  if (byName !== 0) return byName;
  return a.employeeId.localeCompare(b.employeeId);
}

function compareAbsences(
  a: HrSummaryEmployeeHighlight,
  b: HrSummaryEmployeeHighlight
): number {
  if (b.days !== a.days) return b.days - a.days;
  const byName = a.employeeName.localeCompare(b.employeeName, "es");
  if (byName !== 0) return byName;
  return a.employeeId.localeCompare(b.employeeId);
}

interface EmployeeAccum {
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  lateDays: number;
  lateMinutes: number;
  absentDays: number;
}

interface BranchAccum {
  branchId: string;
  branchName: string;
  late: number;
  absent: number;
  justifiedAbsent: number;
  earlyLeave: number;
  openDays: number;
  totalLateMinutes: number;
}

/**
 * Construye el resumen ejecutivo a partir de las evaluaciones del motor RR.HH.
 * Mismas reglas de conteo que el dashboard y `/api/reports/hr`:
 * tardanza = minutos tarde > 0 sin excusa; ausencia = outcome AUSENTE.
 */
export function buildExecutiveSummary(
  evaluations: DayEvaluation[]
): ExecutiveSummary {
  const workDays = evaluations.filter((r) => r.isWorkDay);

  const totals: HrSummaryTotals = {
    workDays: workDays.length,
    present: 0,
    late: 0,
    absent: 0,
    justifiedAbsent: 0,
    earlyLeave: 0,
    openDays: 0,
    totalLateMinutes: 0,
    totalEarlyLeaveMinutes: 0,
    punctualityRate: 0,
  };

  const byEmployee = new Map<string, EmployeeAccum>();
  const byBranch = new Map<string, BranchAccum>();
  const anomalies: HrSummaryAnomaly[] = [];

  const employeeAccum = (row: DayEvaluation): EmployeeAccum => {
    let acc = byEmployee.get(row.employeeId);
    if (!acc) {
      acc = {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        branchId: row.branchId,
        branchName: row.branchName,
        lateDays: 0,
        lateMinutes: 0,
        absentDays: 0,
      };
      byEmployee.set(row.employeeId, acc);
    }
    return acc;
  };

  const branchAccum = (row: DayEvaluation): BranchAccum => {
    let acc = byBranch.get(row.branchId);
    if (!acc) {
      acc = {
        branchId: row.branchId,
        branchName: row.branchName,
        late: 0,
        absent: 0,
        justifiedAbsent: 0,
        earlyLeave: 0,
        openDays: 0,
        totalLateMinutes: 0,
      };
      byBranch.set(row.branchId, acc);
    }
    return acc;
  };

  for (const row of workDays) {
    const branch = branchAccum(row);

    const countsLate = row.lateMinutes > 0 && !row.novelty?.excusesLate;
    const countsEarly =
      row.earlyLeaveMinutes > 0 && !row.novelty?.excusesEarlyLeave;

    if (PRESENT_OUTCOMES.has(row.outcome)) totals.present += 1;
    if (countsLate) {
      totals.late += 1;
      totals.totalLateMinutes += row.lateMinutes;
      branch.late += 1;
      branch.totalLateMinutes += row.lateMinutes;
      const acc = employeeAccum(row);
      acc.lateDays += 1;
      acc.lateMinutes += row.lateMinutes;
    }
    if (countsEarly) {
      totals.earlyLeave += 1;
      totals.totalEarlyLeaveMinutes += row.earlyLeaveMinutes;
      branch.earlyLeave += 1;
    }
    if (row.outcome === "AUSENTE") {
      totals.absent += 1;
      branch.absent += 1;
      employeeAccum(row).absentDays += 1;
    }
    if (row.outcome === "AUSENCIA_JUSTIFICADA") {
      totals.justifiedAbsent += 1;
      branch.justifiedAbsent += 1;
    }
    if (row.outcome === "SIN_SALIDA") {
      totals.openDays += 1;
      branch.openDays += 1;
    }

    if (ANOMALY_OUTCOMES.has(row.outcome)) {
      anomalies.push({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        branchName: row.branchName,
        date: row.date,
        kind: row.outcome as HrSummaryAnomalyKind,
        label: row.outcomeLabel,
      });
    }
  }

  const punctualDays =
    totals.workDays - totals.absent - totals.justifiedAbsent - totals.late;
  totals.punctualityRate =
    totals.workDays > 0
      ? Math.round((punctualDays / totals.workDays) * 100)
      : 0;

  const topLateEmployees = Array.from(byEmployee.values())
    .filter((acc) => acc.lateMinutes > 0)
    .map((acc) => ({
      employeeId: acc.employeeId,
      employeeName: acc.employeeName,
      branchId: acc.branchId,
      branchName: acc.branchName,
      days: acc.lateDays,
      minutes: acc.lateMinutes,
    }))
    .sort(compareHighlights)
    .slice(0, HIGHLIGHT_LIMIT);

  const topAbsentEmployees = Array.from(byEmployee.values())
    .filter((acc) => acc.absentDays > 0)
    .map((acc) => ({
      employeeId: acc.employeeId,
      employeeName: acc.employeeName,
      branchId: acc.branchId,
      branchName: acc.branchName,
      days: acc.absentDays,
      minutes: 0,
    }))
    .sort(compareAbsences)
    .slice(0, HIGHLIGHT_LIMIT);

  anomalies.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.employeeName.localeCompare(b.employeeName, "es") ||
      a.employeeId.localeCompare(b.employeeId)
  );

  const branchList = Array.from(byBranch.values())
    .map((b) => ({
      branchId: b.branchId,
      branchName: b.branchName,
      late: b.late,
      absent: b.absent,
      justifiedAbsent: b.justifiedAbsent,
      earlyLeave: b.earlyLeave,
      openDays: b.openDays,
      totalLateMinutes: b.totalLateMinutes,
    }))
    .sort(
      (a, b) =>
        a.branchName.localeCompare(b.branchName, "es") ||
        a.branchId.localeCompare(b.branchId)
    );

  return {
    totals,
    topLateEmployees,
    topAbsentEmployees,
    anomalies,
    byBranch: branchList,
  };
}
