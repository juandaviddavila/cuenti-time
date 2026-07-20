import { type AttendanceRecord, type AttendanceType } from "@/types/attendance";

export interface AttendanceWindowDecision {
  type: AttendanceType;
}

export interface AttendanceWindowError {
  error: string;
  minutesRemaining: number;
}

export type AttendanceWindowResult = AttendanceWindowDecision | AttendanceWindowError;

function isToday(recordedAt: string): boolean {
  const date = new Date(recordedAt);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatWaitMessage(kind: "Entrada" | "Salida", remainingMinutes: number): string {
  if (remainingMinutes >= 1) {
    const rounded = Math.ceil(remainingMinutes * 10) / 10;
    return `${kind} reciente, espere ${rounded} minutos`;
  }
  const seconds = Math.max(1, Math.ceil(remainingMinutes * 60));
  return `${kind} reciente, espere ${seconds} segundos`;
}

export function decideAttendanceMarkType(
  lastRecord: Pick<AttendanceRecord, "type" | "recordedAt"> | null,
  windowMinutes: number
): AttendanceWindowResult {
  if (!lastRecord || !isToday(lastRecord.recordedAt)) {
    return { type: "CHECK_IN" };
  }

  const minutesSince =
    (Date.now() - new Date(lastRecord.recordedAt).getTime()) / 60000;

  if (lastRecord.type === "CHECK_IN") {
    if (minutesSince < windowMinutes) {
      const remaining = windowMinutes - minutesSince;
      return {
        error: formatWaitMessage("Entrada", remaining),
        minutesRemaining: remaining,
      };
    }
    return { type: "CHECK_OUT" };
  }

  if (minutesSince < windowMinutes) {
    const remaining = windowMinutes - minutesSince;
    return {
      error: formatWaitMessage("Salida", remaining),
      minutesRemaining: remaining,
    };
  }

  return { type: "CHECK_IN" };
}

export async function fetchLastAttendanceRecord(
  employeeId: string
): Promise<AttendanceRecord | null> {
  const res = await fetch(
    `/api/attendance?employeeId=${encodeURIComponent(employeeId)}&pageSize=1`
  );
  if (!res.ok) return null;
  const data = await res.json() as { data?: AttendanceRecord[] };
  const record = data.data?.[0];
  return record ?? null;
}
