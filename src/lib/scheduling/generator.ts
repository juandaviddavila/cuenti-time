/**
 * Generador determinista de borradores de horario.
 *
 * Reglas soportadas (MVP): un turno-plantilla por borrador, aplicado a un
 * conjunto de empleados activos de una sucursal durante un rango de fechas
 * inclusive. El turno ya codifica sus horas por día de la semana, así que la
 * propuesta es una asignación (empleado, turno, rango) — igual que una
 * asignación manual creada desde /shifts.
 *
 * La generación NUNCA escribe asignaciones: solo produce propuestas y
 * conflictos. Los conflictos se vuelven a calcular contra datos vigentes al
 * aprobar (ver service.ts).
 */

export const MAX_RANGE_DAYS = 62;
export const MAX_PROPOSALS = 500;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface GeneratorEmployee {
  id: string;
  fullName: string;
  status: string;
  branchId: string;
}

export interface GeneratorShift {
  id: string;
  name: string;
  companyId: string;
  active: boolean;
}

export interface GeneratorAssignment {
  employeeId: string;
  shiftId: string;
  shiftName: string;
  startDate: string | Date;
  endDate: string | Date | null;
}

export type ScheduleConflictType =
  | "overlap"
  | "employee_inactive"
  | "employee_other_branch";

export interface ScheduleConflict {
  type: ScheduleConflictType;
  employeeId: string;
  employeeName: string;
  message: string;
  existingShiftId?: string;
  existingShiftName?: string;
  existingStart?: string;
  existingEnd?: string | null;
}

export interface ScheduleProposal {
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
  /** Fechas inclusive en formato yyyy-mm-dd (sin componente horario). */
  startDate: string;
  endDate: string;
}

export interface GenerateParams {
  companyId: string;
  branchId: string;
  shiftId: string;
  rangeStart: string;
  rangeEnd: string;
  employees: GeneratorEmployee[];
  shift: GeneratorShift;
  existingAssignments: GeneratorAssignment[];
}

export type GenerateResult =
  | { proposals: ScheduleProposal[]; conflicts: ScheduleConflict[] }
  | { error: string };

function parseDayStart(day: string): number {
  return new Date(`${day}T00:00:00.000Z`).getTime();
}

function parseDayEnd(day: string): number {
  return new Date(`${day}T23:59:59.999Z`).getTime();
}

function toTime(value: string | Date | null | undefined, endOfDay: boolean): number {
  if (value === null || value === undefined) return endOfDay ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return endOfDay ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  // Valores fecha-plano ("2026-11-05") significan todo el día.
  if (typeof value === "string" && DATE_RE.test(value)) {
    return endOfDay ? parseDayEnd(value) : parseDayStart(value);
  }
  return time;
}

/** Dos rangos se solapan si comparten al menos un día calendario. */
export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string | Date,
  endB: string | Date | null
): boolean {
  const aStart = parseDayStart(startA);
  const aEnd = parseDayEnd(endA);
  const bStart = toTime(startB, false);
  const bEnd = toTime(endB, true);
  return bEnd >= aStart && bStart <= aEnd;
}

/**
 * Genera propuestas y conflictos. Entrada inválida (fechas, rango, turno)
 * se reporta como error sin propuestas; empleados no elegibles se reportan
 * como conflictos y quedan fuera de las propuestas.
 */
export function generateScheduleDraft(params: GenerateParams): GenerateResult {
  const { rangeStart, rangeEnd, shiftId, employees, shift } = params;

  if (!DATE_RE.test(rangeStart) || !DATE_RE.test(rangeEnd)) {
    return { error: "Las fechas deben tener formato yyyy-mm-dd" };
  }
  const start = parseDayStart(rangeStart);
  const end = parseDayEnd(rangeEnd);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return { error: "El rango de fechas es inválido" };
  }
  if ((end - start) / 86_400_000 > MAX_RANGE_DAYS) {
    return { error: `El rango máximo de generación es de ${MAX_RANGE_DAYS} días` };
  }
  if (!shift.active) {
    return { error: "El turno seleccionado está inactivo" };
  }
  if (shift.companyId !== params.companyId) {
    return { error: "El turno no pertenece a la empresa" };
  }
  if (shift.id !== shiftId) {
    return { error: "El turno no coincide con los parámetros" };
  }

  const eligible = [...employees].sort((a, b) =>
    a.fullName === b.fullName
      ? a.id.localeCompare(b.id)
      : a.fullName.localeCompare(b.fullName)
  );
  if (eligible.length === 0) {
    return { error: "No hay empleados para programar" };
  }
  if (eligible.length > MAX_PROPOSALS) {
    return { error: `Un borrador admite máximo ${MAX_PROPOSALS} propuestas` };
  }

  const proposals: ScheduleProposal[] = [];
  const conflicts: ScheduleConflict[] = [];

  for (const employee of eligible) {
    if (employee.status !== "ACTIVE") {
      conflicts.push({
        type: "employee_inactive",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: `${employee.fullName} está inactivo y no puede recibir horario`,
      });
      continue;
    }
    if (employee.branchId !== params.branchId) {
      conflicts.push({
        type: "employee_other_branch",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: `${employee.fullName} pertenece a otra sucursal`,
      });
      continue;
    }
    const overlap = params.existingAssignments.find((a) =>
      a.employeeId === employee.id &&
      rangesOverlap(rangeStart, rangeEnd, a.startDate, a.endDate)
    );
    if (overlap) {
      conflicts.push({
        type: "overlap",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: `${employee.fullName} ya tiene el turno "${overlap.shiftName}" en ese rango`,
        existingShiftId: overlap.shiftId,
        existingShiftName: overlap.shiftName,
        existingStart:
          overlap.startDate instanceof Date
            ? overlap.startDate.toISOString()
            : String(overlap.startDate),
        existingEnd:
          overlap.endDate instanceof Date
            ? overlap.endDate.toISOString()
            : overlap.endDate === null
              ? null
              : String(overlap.endDate),
      });
      continue;
    }
    proposals.push({
      employeeId: employee.id,
      employeeName: employee.fullName,
      shiftId: shift.id,
      shiftName: shift.name,
      startDate: rangeStart,
      endDate: rangeEnd,
    });
  }

  return { proposals, conflicts };
}
