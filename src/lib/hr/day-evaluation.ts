import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  getShiftEndTime,
  getShiftStartTime,
  minutesEarlyLeave,
  minutesLate,
  pickActiveShiftForDate,
  type EmployeeShiftAssignment,
  type ShiftScheduleLike,
} from "@/lib/shift-schedule";
import { localDateKey } from "@/lib/hr/local-date";

export type DayOutcome =
  | "PRESENTE"
  | "TARDE"
  | "SALIDA_ANTICIPADA"
  | "TARDE_Y_SALIDA_ANTICIPADA"
  | "SIN_SALIDA"
  | "AUSENTE"
  | "AUSENCIA_JUSTIFICADA"
  | "SIN_TURNO";

export const DAY_OUTCOME_LABELS: Record<DayOutcome, string> = {
  PRESENTE: "Presente",
  TARDE: "Llegó tarde",
  SALIDA_ANTICIPADA: "Salida anticipada",
  TARDE_Y_SALIDA_ANTICIPADA: "Tarde y salida anticipada",
  SIN_SALIDA: "Sin salida",
  AUSENTE: "Ausente",
  AUSENCIA_JUSTIFICADA: "Ausencia justificada",
  SIN_TURNO: "Sin turno",
};

export interface IncidentTypeFlags {
  name: string;
  countsAsAbsence: boolean;
  excusesLate: boolean;
  excusesEarlyLeave: boolean;
}

export interface NoveltyInput {
  employeeId: string | null;
  branchId: string | null;
  shiftId: string | null;
  date: Date;
  overrideStart: string | null;
  overrideEnd: string | null;
  reason: string | null;
  incidentType: IncidentTypeFlags;
}

export interface AttendanceMark {
  employeeId: string;
  type: "CHECK_IN" | "CHECK_OUT" | string;
  recordedAt: Date;
}

export interface EmployeeDayContext {
  id: string;
  fullName: string;
  documentNumber: string;
  branchId: string;
  branchName: string;
  positionName: string | null;
  companyId: string;
}

export interface DayEvaluation {
  date: string;
  dayName: string;
  employeeId: string;
  employeeName: string;
  documentNumber: string;
  branchId: string;
  branchName: string;
  positionName: string;
  shiftId: string | null;
  shiftName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  checkIn: string | null;
  checkOut: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  /** Tolerancia aplicada a la entrada (llegada tarde). */
  toleranceMinutes: number;
  /** Tolerancia aplicada a la salida (salida anticipada). */
  earlyLeaveToleranceMinutes: number;
  outcome: DayOutcome;
  outcomeLabel: string;
  novelty: {
    typeName: string;
    reason: string | null;
    countsAsAbsence: boolean;
    excusesLate: boolean;
    excusesEarlyLeave: boolean;
  } | null;
  isWorkDay: boolean;
}

function toTimeString(date: Date): string {
  return format(date, "HH:mm", { locale: es });
}

function noveltyScopeScore(n: NoveltyInput): number {
  if (n.employeeId) return 3;
  if (n.shiftId) return 2;
  if (n.branchId) return 1;
  return 0;
}

interface ResolvedNovelty {
  countsAsAbsence: boolean;
  excusesLate: boolean;
  excusesEarlyLeave: boolean;
  overrideStart: string | null;
  overrideEnd: string | null;
  display: NoveltyInput;
}

/**
 * Une todas las novedades del día (empleado / turno / sucursal).
 * Flags se combinan con OR; overrides vienen de la más específica que los tenga.
 */
function resolveNoveltiesForDay(
  novelties: NoveltyInput[],
  employee: EmployeeDayContext,
  day: Date,
  shiftId: string | null
): ResolvedNovelty | null {
  const dayKey = localDateKey(day);
  const matches = novelties.filter((n) => {
    if (localDateKey(n.date) !== dayKey) return false;
    if (n.employeeId) return n.employeeId === employee.id;
    if (n.shiftId) return Boolean(shiftId && n.shiftId === shiftId);
    if (n.branchId) return n.branchId === employee.branchId;
    return false;
  });

  if (matches.length === 0) return null;

  const ranked = [...matches].sort(
    (a, b) => noveltyScopeScore(b) - noveltyScopeScore(a)
  );

  const withOverride =
    ranked.find((n) => n.overrideStart || n.overrideEnd) ?? null;

  // Ausencia justificada también exonera puntualidad si la persona igual marca
  // (p.ej. permiso/medio día y regresa a trabajar).
  const countsAsAbsence = matches.some((n) => n.incidentType.countsAsAbsence);
  const excusesLate = matches.some(
    (n) => n.incidentType.excusesLate || n.incidentType.countsAsAbsence
  );
  const excusesEarlyLeave = matches.some(
    (n) => n.incidentType.excusesEarlyLeave || n.incidentType.countsAsAbsence
  );

  return {
    countsAsAbsence,
    excusesLate,
    excusesEarlyLeave,
    overrideStart: withOverride?.overrideStart ?? null,
    overrideEnd: withOverride?.overrideEnd ?? null,
    // Preferir mostrar la que justifica/excusa; si no, la más específica
    display:
      ranked.find(
        (n) =>
          n.incidentType.excusesLate ||
          n.incidentType.excusesEarlyLeave ||
          n.incidentType.countsAsAbsence
      ) ?? ranked[0],
  };
}

function buildRecordsByDay(
  records: AttendanceMark[]
): Map<string, AttendanceMark[]> {
  const map = new Map<string, AttendanceMark[]>();
  for (const r of records) {
    const key = `${r.employeeId}:${localDateKey(r.recordedAt)}`;
    const list = map.get(key);
    if (list) {
      list.push(r);
    } else {
      map.set(key, [r]);
    }
  }
  return map;
}

export function evaluateEmployeeDay(params: {
  employee: EmployeeDayContext;
  day: Date;
  assignments: EmployeeShiftAssignment[];
  records?: AttendanceMark[];
  recordsByDay?: Map<string, AttendanceMark[]>;
  novelties: NoveltyInput[];
  toleranceMinutes: number;
  earlyLeaveToleranceMinutes?: number;
}): DayEvaluation {
  const {
    employee,
    day,
    assignments,
    records,
    recordsByDay,
    novelties,
    toleranceMinutes,
    earlyLeaveToleranceMinutes = 0,
  } = params;

  const dayKey = localDateKey(day);

  const assignment = pickActiveShiftForDate(assignments, employee.id, day);
  const shift = assignment?.shift ?? null;
  const shiftId =
    assignment?.shiftId ??
    (shift && "id" in shift ? (shift.id as string | undefined) : undefined) ??
    null;
  const shiftName =
    shift && "name" in shift && typeof shift.name === "string"
      ? shift.name
      : null;

  let scheduledStart = shift ? getShiftStartTime(shift, day) : null;
  let scheduledEnd = shift ? getShiftEndTime(shift, day) : null;

  const resolved = resolveNoveltiesForDay(novelties, employee, day, shiftId);
  if (resolved?.overrideStart) scheduledStart = resolved.overrideStart;
  if (resolved?.overrideEnd) scheduledEnd = resolved.overrideEnd;

  const isWorkDay = Boolean(scheduledStart);
  const dayRecords = recordsByDay
    ? (recordsByDay.get(`${employee.id}:${dayKey}`) ?? [])
    : records?.filter(
        (r) =>
          r.employeeId === employee.id &&
          localDateKey(r.recordedAt) === dayKey
      ) ?? [];
  const checkInRec = dayRecords.find((r) => r.type === "CHECK_IN");
  const checkOutRec = [...dayRecords]
    .reverse()
    .find((r) => r.type === "CHECK_OUT");

  const checkIn = checkInRec ? toTimeString(checkInRec.recordedAt) : null;
  const checkOut = checkOutRec ? toTimeString(checkOutRec.recordedAt) : null;

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let outcome: DayOutcome;

  const excusesLate = Boolean(resolved?.excusesLate);
  const excusesEarlyLeave = Boolean(resolved?.excusesEarlyLeave);
  const countsAsAbsence = Boolean(resolved?.countsAsAbsence);

  if (!isWorkDay) {
    outcome = "SIN_TURNO";
  } else if (!checkInRec) {
    outcome = countsAsAbsence ? "AUSENCIA_JUSTIFICADA" : "AUSENTE";
  } else if (!checkOutRec) {
    // Siempre calcular minutos vs horario (con overrides); la excusa solo afecta el outcome/filtros
    if (scheduledStart) {
      lateMinutes = minutesLate(
        checkInRec.recordedAt,
        scheduledStart,
        toleranceMinutes
      );
    }
    outcome = "SIN_SALIDA";
  } else {
    if (scheduledStart) {
      lateMinutes = minutesLate(
        checkInRec.recordedAt,
        scheduledStart,
        toleranceMinutes
      );
    }
    if (scheduledEnd) {
      earlyLeaveMinutes = minutesEarlyLeave(
        checkOutRec.recordedAt,
        scheduledEnd,
        earlyLeaveToleranceMinutes
      );
    }

    const countsLate = lateMinutes > 0 && !excusesLate;
    const countsEarly = earlyLeaveMinutes > 0 && !excusesEarlyLeave;

    if (countsLate && countsEarly) {
      outcome = "TARDE_Y_SALIDA_ANTICIPADA";
    } else if (countsLate) {
      outcome = "TARDE";
    } else if (countsEarly) {
      outcome = "SALIDA_ANTICIPADA";
    } else {
      outcome = "PRESENTE";
    }
  }

  return {
    date: localDateKey(day),
    dayName: format(day, "EEEE", { locale: es }),
    employeeId: employee.id,
    employeeName: employee.fullName,
    documentNumber: employee.documentNumber,
    branchId: employee.branchId,
    branchName: employee.branchName,
    positionName: employee.positionName ?? "—",
    shiftId,
    shiftName,
    scheduledStart,
    scheduledEnd,
    checkIn,
    checkOut,
    checkInAt: checkInRec?.recordedAt.toISOString() ?? null,
    checkOutAt: checkOutRec?.recordedAt.toISOString() ?? null,
    lateMinutes,
    earlyLeaveMinutes,
    toleranceMinutes,
    earlyLeaveToleranceMinutes,
    outcome,
    outcomeLabel: DAY_OUTCOME_LABELS[outcome],
    novelty: resolved
      ? {
          typeName: resolved.display.incidentType.name,
          reason: resolved.display.reason,
          countsAsAbsence,
          excusesLate,
          excusesEarlyLeave,
        }
      : null,
    isWorkDay,
  };
}

export function evaluatePeriod(params: {
  employees: EmployeeDayContext[];
  days: Date[];
  assignments: EmployeeShiftAssignment[];
  records: AttendanceMark[];
  novelties: NoveltyInput[];
  toleranceByCompany: Map<string, number>;
  earlyLeaveToleranceByCompany?: Map<string, number>;
  defaultTolerance?: number;
  defaultEarlyLeaveTolerance?: number;
}): DayEvaluation[] {
  const {
    employees,
    days,
    assignments,
    records,
    novelties,
    toleranceByCompany,
    earlyLeaveToleranceByCompany,
    defaultTolerance = 10,
    defaultEarlyLeaveTolerance = 10,
  } = params;

  const rows: DayEvaluation[] = [];
  const recordsByDay = buildRecordsByDay(records);
  for (const employee of employees) {
    const tolerance =
      toleranceByCompany.get(employee.companyId) ?? defaultTolerance;
    const earlyTolerance =
      earlyLeaveToleranceByCompany?.get(employee.companyId) ??
      defaultEarlyLeaveTolerance;
    for (const day of days) {
      rows.push(
        evaluateEmployeeDay({
          employee,
          day,
          assignments,
          recordsByDay,
          novelties,
          toleranceMinutes: tolerance,
          earlyLeaveToleranceMinutes: earlyTolerance,
        })
      );
    }
  }
  return rows;
}

export type HrReportKind =
  | "absences"
  | "lates"
  | "early_leaves"
  | "open_days"
  | "employee_summary"
  | "branch_summary"
  | "daily";

export function filterEvaluationsForReport(
  rows: DayEvaluation[],
  report: HrReportKind,
  options?: { includeJustified?: boolean; onlyUnjustified?: boolean }
): DayEvaluation[] {
  const includeJustified = options?.includeJustified ?? true;
  const onlyUnjustified = options?.onlyUnjustified ?? false;

  const workDays = rows.filter((r) => r.isWorkDay);

  switch (report) {
    case "absences": {
      let abs = workDays.filter(
        (r) => r.outcome === "AUSENTE" || r.outcome === "AUSENCIA_JUSTIFICADA"
      );
      if (onlyUnjustified) abs = abs.filter((r) => r.outcome === "AUSENTE");
      if (!includeJustified)
        abs = abs.filter((r) => r.outcome !== "AUSENCIA_JUSTIFICADA");
      return abs;
    }
    case "lates":
      // Misma base que el diario: minutos tarde > 0 y sin excusa de tardanza
      return workDays.filter(
        (r) => r.lateMinutes > 0 && !r.novelty?.excusesLate
      );
    case "early_leaves":
      // Misma base que el diario: minutos anticipados > 0 y sin excusa de salida
      return workDays.filter(
        (r) => r.earlyLeaveMinutes > 0 && !r.novelty?.excusesEarlyLeave
      );
    case "open_days":
      return workDays.filter((r) => r.outcome === "SIN_SALIDA");
    case "daily":
      return workDays;
    default:
      return workDays;
  }
}

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  documentNumber: string;
  branchId: string;
  branchName: string;
  workDays: number;
  presentDays: number;
  absentDays: number;
  justifiedAbsenceDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  openDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  punctualityRate: number;
}

export interface BranchSummary {
  branchId: string;
  branchName: string;
  employees: number;
  workDays: number;
  presentDays: number;
  absentDays: number;
  justifiedAbsenceDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  openDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  punctualityRate: number;
}

function isPresentOutcome(outcome: DayOutcome): boolean {
  return (
    outcome === "PRESENTE" ||
    outcome === "TARDE" ||
    outcome === "SALIDA_ANTICIPADA" ||
    outcome === "TARDE_Y_SALIDA_ANTICIPADA" ||
    outcome === "SIN_SALIDA"
  );
}

export function summarizeByEmployee(rows: DayEvaluation[]): EmployeeSummary[] {
  const map = new Map<string, EmployeeSummary>();

  for (const r of rows) {
    if (!r.isWorkDay) continue;
    let s = map.get(r.employeeId);
    if (!s) {
      s = {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        documentNumber: r.documentNumber,
        branchId: r.branchId,
        branchName: r.branchName,
        workDays: 0,
        presentDays: 0,
        absentDays: 0,
        justifiedAbsenceDays: 0,
        lateDays: 0,
        earlyLeaveDays: 0,
        openDays: 0,
        totalLateMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        punctualityRate: 0,
      };
      map.set(r.employeeId, s);
    }
    s.workDays += 1;
    if (isPresentOutcome(r.outcome)) s.presentDays += 1;
    if (r.outcome === "AUSENTE") s.absentDays += 1;
    if (r.outcome === "AUSENCIA_JUSTIFICADA") s.justifiedAbsenceDays += 1;
    if (r.lateMinutes > 0 && !r.novelty?.excusesLate) {
      s.lateDays += 1;
      s.totalLateMinutes += r.lateMinutes;
    }
    if (r.earlyLeaveMinutes > 0 && !r.novelty?.excusesEarlyLeave) {
      s.earlyLeaveDays += 1;
      s.totalEarlyLeaveMinutes += r.earlyLeaveMinutes;
    }
    if (r.outcome === "SIN_SALIDA") s.openDays += 1;
  }

  return Array.from(map.values())
    .map((s) => ({
      ...s,
      punctualityRate:
        s.workDays > 0
          ? Math.round(
              ((s.workDays -
                s.absentDays -
                s.justifiedAbsenceDays -
                s.lateDays) /
                s.workDays) *
                100
            )
          : 0,
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "es"));
}

export function summarizeByBranch(rows: DayEvaluation[]): BranchSummary[] {
  const byEmp = summarizeByEmployee(rows);
  const map = new Map<string, BranchSummary & { employeeIds: Set<string> }>();

  for (const e of byEmp) {
    let s = map.get(e.branchId);
    if (!s) {
      s = {
        branchId: e.branchId,
        branchName: e.branchName,
        employees: 0,
        workDays: 0,
        presentDays: 0,
        absentDays: 0,
        justifiedAbsenceDays: 0,
        lateDays: 0,
        earlyLeaveDays: 0,
        openDays: 0,
        totalLateMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        punctualityRate: 0,
        employeeIds: new Set(),
      };
      map.set(e.branchId, s);
    }
    s.employeeIds.add(e.employeeId);
    s.workDays += e.workDays;
    s.presentDays += e.presentDays;
    s.absentDays += e.absentDays;
    s.justifiedAbsenceDays += e.justifiedAbsenceDays;
    s.lateDays += e.lateDays;
    s.earlyLeaveDays += e.earlyLeaveDays;
    s.openDays += e.openDays;
    s.totalLateMinutes += e.totalLateMinutes;
    s.totalEarlyLeaveMinutes += e.totalEarlyLeaveMinutes;
  }

  return Array.from(map.values())
    .map(({ employeeIds, ...s }) => {
      const evaluatedDays =
        s.workDays - s.justifiedAbsenceDays > 0
          ? s.workDays - s.justifiedAbsenceDays
          : s.workDays;
      return {
        ...s,
        employees: employeeIds.size,
        punctualityRate:
          evaluatedDays > 0
            ? Math.round(
                ((evaluatedDays - s.absentDays - s.lateDays) / evaluatedDays) *
                  100
              )
            : 0,
      };
    })
    .sort((a, b) => a.branchName.localeCompare(b.branchName, "es"));
}

/** Re-export for callers that need shift typing */
export type { ShiftScheduleLike };
