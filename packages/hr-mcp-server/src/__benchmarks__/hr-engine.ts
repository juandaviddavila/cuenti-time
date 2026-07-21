import { evaluatePeriod, type EmployeeDayContext } from "@/lib/hr/day-evaluation";
import { localDateKey } from "@/lib/hr/local-date";

const EMPLOYEES = 500;
const DAYS = 90;

function buildEmployees(count: number): EmployeeDayContext[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `emp-${i}`,
    fullName: `Empleado ${i}`,
    documentNumber: String(1000000 + i),
    branchId: "branch-1",
    branchName: "Sede Principal",
    positionName: "General",
    companyId: "company-1",
  }));
}

function buildDays(count: number): Date[] {
  const days: Date[] = [];
  const start = new Date(2026, 0, 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function buildRecords(employees: EmployeeDayContext[], days: Date[]) {
  const records: { employeeId: string; type: "CHECK_IN" | "CHECK_OUT"; recordedAt: Date }[] = [];
  for (const emp of employees) {
    for (const day of days) {
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      if (isWeekend) continue;

      const late = Math.random() < 0.1 ? 15 : 0;
      const checkIn = new Date(day);
      checkIn.setHours(8, late, 0, 0);
      const checkOut = new Date(day);
      checkOut.setHours(17, 0, 0, 0);

      records.push({ employeeId: emp.id, type: "CHECK_IN", recordedAt: checkIn });
      records.push({ employeeId: emp.id, type: "CHECK_OUT", recordedAt: checkOut });
    }
  }
  return records;
}

function buildAssignments() {
  return [];
}

async function main() {
  const employees = buildEmployees(EMPLOYEES);
  const days = buildDays(DAYS);
  const records = buildRecords(employees, days);
  const assignments = buildAssignments();

  const toleranceByCompany = new Map([["company-1", 10]]);
  const earlyLeaveToleranceByCompany = new Map([["company-1", 10]]);

  const start = performance.now();
  const evaluations = evaluatePeriod({
    employees,
    days,
    assignments,
    records,
    novelties: [],
    toleranceByCompany,
    earlyLeaveToleranceByCompany,
  });
  const elapsed = performance.now() - start;

  console.error(`[benchmark] employees=${EMPLOYEES}, days=${DAYS}, evaluations=${evaluations.length}, records=${records.length}`);
  console.error(`[benchmark] elapsed=${elapsed.toFixed(2)}ms`);

  if (elapsed > 2000) {
    console.error(`[benchmark] WARNING: exceeded 2000ms budget; engine needs optimization for this synthetic full-load scenario`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
