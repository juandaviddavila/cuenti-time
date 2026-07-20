import { NextRequest, NextResponse } from "next/server";
import { startOfDay, endOfDay, format } from "date-fns";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { prisma } from "@/lib/prisma";
import { parseLocalDateParam } from "@/lib/hr/local-date";

export async function GET(request: NextRequest) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
  const date = parseLocalDateParam(dateParam);

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: auth.companyId, status: "ACTIVE" },
      select: { id: true, fullName: true, branchId: true },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        companyId: auth.companyId,
        recordedAt: { gte: startOfDay(date), lte: endOfDay(date) },
      },
      orderBy: { recordedAt: "asc" },
      select: {
        employeeId: true,
        branchId: true,
        type: true,
        recordedAt: true,
      },
    }),
  ]);

  const presentIds = new Set(records.map((r) => r.employeeId));
  const absent = employees.filter((e) => !presentIds.has(e.id));

  const entries = records.filter((r) => r.type === "CHECK_IN").length;
  const exits = records.filter((r) => r.type === "CHECK_OUT").length;

  return NextResponse.json({
    date: dateParam,
    companyId: auth.companyId,
    summary: {
      totalEmployees: employees.length,
      entries,
      exits,
      absentCount: absent.length,
    },
    records,
    absent,
  });
}
