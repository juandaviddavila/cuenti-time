import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession, getCompanyFilter } from "@/lib/server-auth";
import { AttendanceClient } from "./attendance-client";
import { startOfDay, endOfDay } from "date-fns";
import { serializeRecords } from "@/lib/bigint";

export default async function AttendancePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const companyFilter = getCompanyFilter(session);
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const [records, checkInsToday, checkOutsToday, successToday, facialFails] =
    await Promise.all([
      prisma.attendanceRecord.findMany({
        take: 50,
        where: companyFilter,
        orderBy: { recordedAt: "desc" },
        include: {
          employee: { select: { fullName: true, photo: true, position: { select: { name: true } } } },
          branch: { select: { name: true } },
        },
      }),
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
      prisma.attendanceRecord.count({
        where: {
          ...companyFilter,
          validationStatus: "SUCCESS",
          recordedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.attendanceRecord.count({
        where: {
          ...companyFilter,
          validationStatus: {
            in: [
              "FAILED",
              "LIVENESS_FAILED",
              "SPOOFING_DETECTED",
              "FACE_NOT_FOUND",
            ],
          },
          recordedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

  const totalToday = checkInsToday + checkOutsToday;
  const successRate =
    totalToday > 0 ? Math.round((successToday / totalToday) * 100) : 0;

  return (
    <AttendanceClient
      userRole={session.role}
      records={serializeRecords(records.map((r) => ({
        id: r.id,
        employeeName: r.employee.fullName,
        employeePhoto: r.employee.photo ?? undefined,
        position: r.employee.position?.name ?? undefined,
        branchName: r.branch.name,
        type: r.type,
        recordedAt: r.recordedAt.toISOString(),
        validationStatus: r.validationStatus,
        confidenceScore: r.confidenceScore ?? undefined,
        isManual: r.isManual,
        notes: r.notes ?? undefined,
      })))}
      stats={{
        checkInsToday,
        checkOutsToday,
        successRate,
        facialFails,
      }}
    />
  );
}
