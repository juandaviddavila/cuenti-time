import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession, getCompanyFilter } from "@/lib/server-auth";
import { DashboardClient } from "./dashboard-client";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { es } from "date-fns/locale";
import { loadHrEvaluations } from "@/lib/hr/load-hr-evaluations";

export default async function DashboardPage() {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const session = await getServerSession();
  if (!session) redirect("/login");

  const companyFilter = getCompanyFilter(session);
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // ── Core counts (scoped to company) ───────────────────────────────────────
  const [
    totalCompanies,
    totalBranches,
    totalEmployees,
    checkInsToday,
    checkOutsToday,
    facialAlerts,
    recentAttendance,
  ] = await Promise.all([
    session.role === "SAAS_SUPER_ADMIN"
      ? prisma.company.count({ where: { status: "ACTIVE" } })
      : prisma.company.count({
          where: { id: session.companyId ?? "__none__", status: "ACTIVE" },
        }),

    prisma.branch.count({ where: { ...companyFilter, status: "ACTIVE" } }),
    prisma.employee.count({ where: { ...companyFilter, status: "ACTIVE" } }),

    prisma.attendanceRecord.count({
      where: {
        ...companyFilter,
        type: "CHECK_IN",
        recordedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        ...companyFilter,
        type: "CHECK_OUT",
        recordedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.faceValidationLog.count({
      where: {
        ...companyFilter,
        result: { in: ["FAILED", "LIVENESS_FAILED", "SPOOFING_DETECTED"] },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.attendanceRecord.findMany({
      take: 8,
      where: companyFilter,
      orderBy: { recordedAt: "desc" },
      include: {
        employee: { select: { fullName: true, photo: true, position: { select: { name: true } } } },
      },
    }),
  ]);

  // ── Weekly data — one query with N parallel count calls (still parallel) ──
  const weeklyData = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const d = subDays(today, 6 - i);
      return prisma.attendanceRecord
        .count({
          where: {
            ...companyFilter,
            type: "CHECK_IN",
            recordedAt: { gte: startOfDay(d), lte: endOfDay(d) },
          },
        })
        .then((count) => ({
          day: format(d, "EEE", { locale: es }),
          entradas: count,
        }));
    })
  );

  // ── Present today — correct: last record per employee today must be CHECK_IN ─
  const todayCheckIns = await prisma.attendanceRecord.findMany({
    where: {
      ...companyFilter,
      recordedAt: { gte: todayStart, lte: todayEnd },
    },
    select: { employeeId: true, type: true, recordedAt: true },
    orderBy: { recordedAt: "asc" },
  });

  // Build a map of employeeId → last record type
  const lastTypeByEmployee = new Map<string, string>();
  for (const record of todayCheckIns) {
    lastTypeByEmployee.set(record.employeeId, record.type);
  }
  const presentToday = Array.from(lastTypeByEmployee.values()).filter(
    (t) => t === "CHECK_IN"
  ).length;

  // ── Tardanzas / ausencias reales (mismo motor RR.HH. que /reports) ─────────
  const hrToday = await loadHrEvaluations(session, {
    from: todayStart,
    to: todayStart,
    report: "daily",
  });
  const workDayEvals = hrToday.evaluations.filter((r) => r.isWorkDay);
  const lateArrivals = workDayEvals.filter((r) => r.lateMinutes > 0).length;
  const absentToday = workDayEvals.filter((r) => r.outcome === "AUSENTE").length;

  const dailyQuickReport = {
    present: workDayEvals.filter(
      (r) =>
        r.outcome === "PRESENTE" ||
        r.outcome === "TARDE" ||
        r.outcome === "SALIDA_ANTICIPADA" ||
        r.outcome === "TARDE_Y_SALIDA_ANTICIPADA" ||
        r.outcome === "SIN_SALIDA"
    ).length,
    late: workDayEvals.filter(
      (r) => r.lateMinutes > 0 && !r.novelty?.excusesLate
    ).length,
    absent: workDayEvals.filter((r) => r.outcome === "AUSENTE").length,
    justifiedAbsent: workDayEvals.filter(
      (r) => r.outcome === "AUSENCIA_JUSTIFICADA"
    ).length,
    openDays: workDayEvals.filter((r) => r.outcome === "SIN_SALIDA").length,
    earlyLeave: workDayEvals.filter(
      (r) => r.earlyLeaveMinutes > 0 && !r.novelty?.excusesEarlyLeave
    ).length,
    rows: workDayEvals.slice(0, 12).map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      branchName: r.branchName,
      positionName: r.positionName,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      lateMinutes: r.lateMinutes,
      earlyLeaveMinutes: r.earlyLeaveMinutes,
      outcome: r.outcome,
      outcomeLabel: r.outcomeLabel,
      noveltyName: r.novelty?.typeName ?? null,
    })),
    totalRows: workDayEvals.length,
  };

  const stats = {
    totalCompanies,
    totalBranches,
    totalEmployees,
    presentToday,
    absentToday,
    checkInsToday,
    checkOutsToday,
    lateArrivals,
    facialAlerts,
    attendanceRate:
      totalEmployees > 0
        ? Math.round((presentToday / totalEmployees) * 100)
        : 0,
  };

  return (
    <DashboardClient
      stats={stats}
      weeklyData={weeklyData}
      recentAttendance={recentAttendance.map((r) => ({
        id: r.id,
        employeeName: r.employee.fullName,
        employeePhoto: r.employee.photo,
        position: r.employee.position?.name ?? null,
        type: r.type,
        recordedAt: r.recordedAt.toISOString(),
        validationStatus: r.validationStatus,
        confidenceScore: r.confidenceScore,
      }))}
      dailyQuickReport={dailyQuickReport}
      userRole={session.role}
    />
  );
}
