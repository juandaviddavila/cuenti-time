/**
 * Smoke test del motor HR (sin HTTP / sin JWT).
 * Ejecutar: pnpm exec tsx scripts/smoke-hr-reports.ts
 */
import { PrismaClient } from "@prisma/client";
import { startOfMonth, endOfMonth } from "date-fns";
import {
  evaluatePeriod,
  filterEvaluationsForReport,
  summarizeByBranch,
  summarizeByEmployee,
  type NoveltyInput,
  type HrReportKind,
} from "../src/lib/hr/day-evaluation";
import type { EmployeeShiftAssignment } from "../src/lib/shift-schedule";
import { eachDayOfInterval } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: { contains: "Distribuidora" } },
    select: { id: true, lateToleranceMinutes: true },
  });
  if (!company) throw new Error("Company Distribuidora not found");

  const from = startOfMonth(new Date(2026, 6, 1));
  const to = endOfMonth(new Date(2026, 6, 1));
  // Clamp to today if needed — use July 1-20 2026
  const rangeEnd = new Date(2026, 6, 20, 23, 59, 59);

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id, status: "ACTIVE" },
    select: {
      id: true,
      fullName: true,
      documentNumber: true,
      companyId: true,
      branchId: true,
      branch: { select: { name: true } },
      position: { select: { name: true } },
    },
  });

  const employeeIds = employees.map((e) => e.id);
  const [records, incidents, assignments] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        recordedAt: { gte: from, lte: rangeEnd },
      },
      select: { employeeId: true, type: true, recordedAt: true },
      orderBy: { recordedAt: "asc" },
    }),
    prisma.incident.findMany({
      where: {
        companyId: company.id,
        date: {
          gte: new Date(from.getTime() - 86400000),
          lte: new Date(rangeEnd.getTime() + 86400000),
        },
      },
      select: {
        employeeId: true,
        branchId: true,
        shiftId: true,
        date: true,
        overrideStart: true,
        overrideEnd: true,
        reason: true,
        incidentType: {
          select: {
            name: true,
            countsAsAbsence: true,
            excusesLate: true,
            excusesEarlyLeave: true,
          },
        },
      },
    }),
    prisma.employeeShift.findMany({
      where: {
        employeeId: { in: employeeIds },
        startDate: { lte: rangeEnd },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
      },
      select: {
        employeeId: true,
        shiftId: true,
        startDate: true,
        endDate: true,
        shift: {
          select: {
            id: true,
            name: true,
            active: true,
            mondayStart: true,
            mondayEnd: true,
            tuesdayStart: true,
            tuesdayEnd: true,
            wednesdayStart: true,
            wednesdayEnd: true,
            thursdayStart: true,
            thursdayEnd: true,
            fridayStart: true,
            fridayEnd: true,
            saturdayStart: true,
            saturdayEnd: true,
            sundayStart: true,
            sundayEnd: true,
          },
        },
      },
    }),
  ]);

  const shiftAssignments: EmployeeShiftAssignment[] = assignments.map((a) => ({
    employeeId: a.employeeId,
    shiftId: a.shiftId,
    startDate: a.startDate,
    endDate: a.endDate,
    shift: a.shift,
  }));

  const novelties: NoveltyInput[] = incidents.map((i) => ({
    employeeId: i.employeeId,
    branchId: i.branchId,
    shiftId: i.shiftId,
    date: i.date,
    overrideStart: i.overrideStart,
    overrideEnd: i.overrideEnd,
    reason: i.reason,
    incidentType: i.incidentType,
  }));

  const days = eachDayOfInterval({ start: from, end: new Date(2026, 6, 20) });
  const evaluations = evaluatePeriod({
    employees: employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      documentNumber: e.documentNumber,
      branchId: e.branchId,
      branchName: e.branch.name,
      positionName: e.position?.name ?? null,
      companyId: e.companyId,
    })),
    days,
    assignments: shiftAssignments,
    records,
    novelties,
    toleranceByCompany: new Map([[company.id, company.lateToleranceMinutes]]),
  });

  const kinds: HrReportKind[] = [
    "absences",
    "lates",
    "early_leaves",
    "open_days",
    "employee_summary",
    "branch_summary",
    "daily",
  ];

  const issues: string[] = [];
  const summary: Record<string, unknown> = {
    employees: employees.length,
    records: records.length,
    incidents: incidents.length,
    assignments: assignments.length,
    evaluations: evaluations.length,
    workDays: evaluations.filter((e) => e.isWorkDay).length,
  };

  for (const kind of kinds) {
    if (kind === "employee_summary") {
      const rows = summarizeByEmployee(evaluations);
      summary[kind] = rows.length;
      if (rows.some((r) => r.workDays < 0 || r.punctualityRate < 0)) {
        issues.push(`${kind}: invalid KPIs`);
      }
      continue;
    }
    if (kind === "branch_summary") {
      const rows = summarizeByBranch(evaluations);
      summary[kind] = rows.length;
      continue;
    }

    const filtered = filterEvaluationsForReport(evaluations, kind, {
      onlyUnjustified: false,
      includeJustified: true,
    });
    summary[kind] = filtered.length;

    if (kind === "lates") {
      for (const r of filtered) {
        if (r.lateMinutes <= 0) issues.push("lates: lateMinutes<=0");
        if (r.novelty?.excusesLate) issues.push("lates: excusesLate still listed");
      }
    }
    if (kind === "early_leaves") {
      for (const r of filtered) {
        if (r.earlyLeaveMinutes <= 0) issues.push("early: minutes<=0");
        if (r.novelty?.excusesEarlyLeave) {
          issues.push("early: excusesEarlyLeave still listed");
        }
      }
    }
    if (kind === "absences") {
      for (const r of filtered) {
        if (r.outcome !== "AUSENTE" && r.outcome !== "AUSENCIA_JUSTIFICADA") {
          issues.push(`absences: bad outcome ${r.outcome}`);
        }
      }
      const unjust = filterEvaluationsForReport(evaluations, "absences", {
        onlyUnjustified: true,
      });
      summary.absences_unjustified = unjust.length;
      if (unjust.some((r) => r.outcome !== "AUSENTE")) {
        issues.push("absences onlyUnjustified leaked justified");
      }
    }
    if (kind === "open_days") {
      for (const r of filtered) {
        if (r.outcome !== "SIN_SALIDA") {
          issues.push(`open_days: ${r.outcome}`);
        }
      }
    }
  }

  // Novelty matching: if any incident excusesLate for an employee-day with check-in after start,
  // lateMinutes must be 0 for that evaluation.
  for (const ev of evaluations) {
    if (!ev.isWorkDay || !ev.checkIn) continue;
    if (ev.novelty?.excusesLate && ev.lateMinutes > 0) {
      issues.push(
        `novelty excusesLate ignored for ${ev.employeeName} ${ev.date}`
      );
    }
    if (ev.novelty?.excusesEarlyLeave && ev.earlyLeaveMinutes > 0) {
      issues.push(
        `novelty excusesEarlyLeave ignored for ${ev.employeeName} ${ev.date}`
      );
    }
  }

  // Seeded attendance often creates late arrivals — expect some lates or absences
  if ((summary.lates as number) === 0 && (summary.absences as number) === 0) {
    issues.push("unexpected: zero lates and zero absences with seeded data");
  }

  console.log(JSON.stringify({ summary, issues }, null, 2));
  if (issues.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
