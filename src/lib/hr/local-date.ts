/** Parsea "yyyy-MM-dd" como medianoche local (evita el bug de Date("yyyy-MM-dd") = UTC). */
export function parseLocalDateParam(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const fallback = new Date(value);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

/** Clave de calendario local yyyy-MM-dd. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
