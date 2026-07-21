import { startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCompanyFilter, type TenantSession } from "@/lib/tenant";
import { bigintToString, stringToBigint } from "@/lib/bigint";
import {
  evaluatePeriod,
  filterEvaluationsForReport,
  summarizeByBranch,
  summarizeByEmployee,
  type DayEvaluation,
  type HrReportKind,
  type NoveltyInput,
} from "@/lib/hr/day-evaluation";
import type { EmployeeShiftAssignment } from "@/lib/shift-schedule";

export interface HrQueryParams {
  from: Date;
  to: Date;
  branchId?: string;
  /** @deprecated Prefer employeeIds */
  employeeId?: string;
  employeeIds?: string[];
  positionIds?: string[];
  shiftId?: string;
  report: HrReportKind;
  includeJustified?: boolean;
  onlyUnjustified?: boolean;
}

async function resolveSupervisorBranchId(
  session: TenantSession
): Promise<string | null | undefined> {
  if (session.role !== "BRANCH_SUPERVISOR") return undefined;
  const user = await prisma.user.findUnique({
    where: { id: stringToBigint(session.userId) },
    select: { branchId: true },
  });
  return user?.branchId ? bigintToString(user.branchId) : undefined;
}

export async function loadHrEvaluations(
  session: TenantSession,
  params: HrQueryParams
): Promise<{
  evaluations: DayEvaluation[];
  filtered: DayEvaluation[];
  employeeSummary: ReturnType<typeof summarizeByEmployee>;
  branchSummary: ReturnType<typeof summarizeByBranch>;
  range: { from: string; to: string };
  forcedBranchId?: string;
}> {
  const companyFilter = getCompanyFilter(session);
  const supervisorBranchId = await resolveSupervisorBranchId(session);
  const branchId = supervisorBranchId ?? params.branchId;

  const start = startOfDay(params.from);
  const end = endOfDay(params.to);

  const filterEmployeeIds =
    params.employeeIds && params.employeeIds.length > 0
      ? params.employeeIds
      : params.employeeId
        ? [params.employeeId]
        : undefined;

  const employees = await prisma.employee.findMany({
    where: {
      ...companyFilter,
      status: "ACTIVE",
      ...(filterEmployeeIds ? { id: { in: filterEmployeeIds.map(stringToBigint).filter((v): v is bigint => v !== null && v !== undefined) } } : {}),
      ...(params.positionIds && params.positionIds.length > 0
        ? { positionId: { in: params.positionIds.map(stringToBigint).filter((v): v is bigint => v !== null && v !== undefined) } }
        : {}),
      ...(branchId ? { branchId: stringToBigint(branchId) } : {}),
      ...(params.shiftId
        ? {
            shifts: {
              some: {
                shiftId: stringToBigint(params.shiftId),
                startDate: { lte: end },
                OR: [{ endDate: null }, { endDate: { gte: start } }],
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      documentNumber: true,
      companyId: true,
      branchId: true,
      branch: { select: { id: true, name: true } },
      position: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });

  const employeeIds = employees.map((e) => e.id);
  const companyIds = Array.from(new Set(employees.map((e) => e.companyId)));

  const [records, incidents, assignments, companies] = await Promise.all([
    employeeIds.length === 0
      ? Promise.resolve([])
      : prisma.attendanceRecord.findMany({
          where: {
            employeeId: { in: employeeIds },
            recordedAt: { gte: start, lte: end },
          },
          orderBy: { recordedAt: "asc" },
          select: { employeeId: true, type: true, recordedAt: true },
        }),
    employeeIds.length === 0
      ? Promise.resolve([])
      : prisma.incident.findMany({
          // Rango ampliado ±1 día por posibles desfases UTC al guardar la fecha.
          // El motor filtra por día local + alcance (empleado/turno/sucursal).
          where: {
            ...(companyFilter.companyId
              ? { companyId: companyFilter.companyId }
              : { companyId: { in: companyIds.length ? companyIds : [-1n] } }),
            date: {
              gte: new Date(start.getTime() - 24 * 60 * 60 * 1000),
              lte: new Date(end.getTime() + 24 * 60 * 60 * 1000),
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
    employeeIds.length === 0
      ? Promise.resolve([])
      : prisma.employeeShift.findMany({
          where: {
            employeeId: { in: employeeIds },
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
            ...(params.shiftId ? { shiftId: stringToBigint(params.shiftId) } : {}),
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
    prisma.company.findMany({
      where:
        session.role === "SAAS_SUPER_ADMIN"
          ? { id: { in: companyIds.length ? companyIds : [-1n] } }
          : { id: session.companyId ? stringToBigint(session.companyId) : -1n },
      select: { id: true, lateToleranceMinutes: true, earlyLeaveToleranceMinutes: true },
    }),
  ]);

  const shiftAssignments: EmployeeShiftAssignment[] = assignments.map((a) => ({
    employeeId: bigintToString(a.employeeId),
    shiftId: bigintToString(a.shiftId),
    startDate: a.startDate,
    endDate: a.endDate,
    shift: { ...a.shift, id: bigintToString(a.shift.id) },
  }));

  const novelties: NoveltyInput[] = incidents.map((i) => ({
    employeeId: i.employeeId ? bigintToString(i.employeeId) : null,
    branchId: i.branchId ? bigintToString(i.branchId) : null,
    shiftId: i.shiftId ? bigintToString(i.shiftId) : null,
    date: i.date,
    overrideStart: i.overrideStart,
    overrideEnd: i.overrideEnd,
    reason: i.reason,
    incidentType: i.incidentType,
  }));

  const toleranceByCompany = new Map(
    companies.map((c) => [bigintToString(c.id), c.lateToleranceMinutes])
  );
  const earlyLeaveToleranceByCompany = new Map(
    companies.map((c) => [bigintToString(c.id), c.earlyLeaveToleranceMinutes])
  );

  const days = eachDayOfInterval({ start: params.from, end: params.to });

  let evaluations = evaluatePeriod({
    employees: employees.map((e) => ({
      id: bigintToString(e.id),
      fullName: e.fullName,
      documentNumber: e.documentNumber,
      branchId: bigintToString(e.branchId),
      branchName: e.branch.name,
      positionName: e.position?.name ?? null,
      companyId: bigintToString(e.companyId),
    })),
    days,
    assignments: shiftAssignments,
    records: records.map((r) => ({
      employeeId: bigintToString(r.employeeId),
      type: r.type,
      recordedAt: r.recordedAt,
    })),
    novelties,
    toleranceByCompany,
    earlyLeaveToleranceByCompany,
  });

  if (params.shiftId) {
    evaluations = evaluations.filter(
      (r) => !r.isWorkDay || r.shiftId === params.shiftId
    );
  }

  const filtered = filterEvaluationsForReport(evaluations, params.report, {
    includeJustified: params.includeJustified,
    onlyUnjustified: params.onlyUnjustified,
  });

  return {
    evaluations,
    filtered,
    employeeSummary: summarizeByEmployee(evaluations),
    branchSummary: summarizeByBranch(evaluations),
    range: { from: start.toISOString(), to: end.toISOString() },
    forcedBranchId: supervisorBranchId ?? undefined,
  };
}
