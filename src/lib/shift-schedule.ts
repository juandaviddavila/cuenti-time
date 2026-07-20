const DAY_START_FIELDS = {
  monday: "mondayStart",
  tuesday: "tuesdayStart",
  wednesday: "wednesdayStart",
  thursday: "thursdayStart",
  friday: "fridayStart",
  saturday: "saturdayStart",
  sunday: "sundayStart",
} as const;

const DAY_END_FIELDS = {
  monday: "mondayEnd",
  tuesday: "tuesdayEnd",
  wednesday: "wednesdayEnd",
  thursday: "thursdayEnd",
  friday: "fridayEnd",
  saturday: "saturdayEnd",
  sunday: "sundayEnd",
} as const;

export type ShiftDayKey = keyof typeof DAY_START_FIELDS;

export interface ShiftScheduleLike {
  mondayStart?: string | null;
  mondayEnd?: string | null;
  tuesdayStart?: string | null;
  tuesdayEnd?: string | null;
  wednesdayStart?: string | null;
  wednesdayEnd?: string | null;
  thursdayStart?: string | null;
  thursdayEnd?: string | null;
  fridayStart?: string | null;
  fridayEnd?: string | null;
  saturdayStart?: string | null;
  saturdayEnd?: string | null;
  sundayStart?: string | null;
  sundayEnd?: string | null;
  active?: boolean;
}

const TIME_RE = /^\d{2}:\d{2}$/;

export function getDayKeyFromDate(date: Date): ShiftDayKey {
  return date
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase() as ShiftDayKey;
}

export function getShiftStartTime(
  shift: ShiftScheduleLike,
  date: Date
): string | null {
  if (shift.active === false) return null;
  const dayKey = getDayKeyFromDate(date);
  const field = DAY_START_FIELDS[dayKey];
  const start = shift[field];
  return start && TIME_RE.test(start) ? start : null;
}

export function getShiftEndTime(
  shift: ShiftScheduleLike,
  date: Date
): string | null {
  if (shift.active === false) return null;
  const dayKey = getDayKeyFromDate(date);
  const field = DAY_END_FIELDS[dayKey];
  const end = shift[field];
  return end && TIME_RE.test(end) ? end : null;
}

/** Combina fecha del día + "HH:mm" en un Date local. */
export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function isLateArrival(
  recordedAt: Date,
  scheduledStart: string,
  toleranceMinutes: number
): boolean {
  return minutesLate(recordedAt, scheduledStart, toleranceMinutes) > 0;
}

/** Minutos de atraso después de start + tolerancia. 0 si puntual o temprano. */
export function minutesLate(
  recordedAt: Date,
  scheduledStart: string,
  toleranceMinutes: number
): number {
  const deadline = combineDateAndTime(recordedAt, scheduledStart);
  deadline.setMinutes(deadline.getMinutes() + toleranceMinutes);
  if (recordedAt <= deadline) return 0;
  return Math.round((recordedAt.getTime() - deadline.getTime()) / 60_000);
}

/**
 * Minutos de salida anticipada antes de (fin − tolerancia).
 * 0 si salió dentro de la ventana permitida o después del fin.
 */
export function minutesEarlyLeave(
  recordedAt: Date,
  scheduledEnd: string,
  toleranceMinutes = 0
): number {
  const earliestAllowed = combineDateAndTime(recordedAt, scheduledEnd);
  earliestAllowed.setMinutes(earliestAllowed.getMinutes() - toleranceMinutes);
  if (recordedAt >= earliestAllowed) return 0;
  return Math.round(
    (earliestAllowed.getTime() - recordedAt.getTime()) / 60_000
  );
}

export interface EmployeeShiftAssignment {
  employeeId: string;
  startDate: Date;
  endDate?: Date | null;
  shiftId?: string;
  shift: ShiftScheduleLike & { id?: string; name?: string };
}

/** El turno vigente es el más reciente cuya asignación cubre la fecha. */
export function pickActiveShiftForDate(
  assignments: EmployeeShiftAssignment[],
  employeeId: string,
  date: Date
): EmployeeShiftAssignment | null {
  const day = new Date(date);
  day.setHours(12, 0, 0, 0);

  const active = assignments
    .filter((a) => {
      if (a.employeeId !== employeeId) return false;
      const start = new Date(a.startDate);
      start.setHours(0, 0, 0, 0);
      if (start > day) return false;
      if (a.endDate) {
        const end = new Date(a.endDate);
        end.setHours(23, 59, 59, 999);
        if (end < day) return false;
      }
      return true;
    })
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  return active[0] ?? null;
}

/** Compatibilidad con dashboard: turno más reciente ya empezado (sin filtrar endDate). */
export function pickActiveShift(
  assignments: EmployeeShiftAssignment[],
  employeeId: string
): ShiftScheduleLike | null {
  const active = assignments
    .filter((a) => a.employeeId === employeeId)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return active[0]?.shift ?? null;
}
