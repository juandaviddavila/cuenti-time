import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";
import { z } from "zod";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { loadHrEvaluations } from "@/lib/hr/load-hr-evaluations";
import type { HrReportKind } from "@/lib/hr/day-evaluation";
import { parseLocalDateParam } from "@/lib/hr/local-date";
import type { ServerSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { stringToBigint } from "@/lib/bigint";

const reportSchema = z.enum([
  "absences",
  "lates",
  "early_leaves",
  "open_days",
  "employee_summary",
  "branch_summary",
  "daily",
]);

/**
 * Informe RR.HH. scoped al companyId del token.
 * Nunca acepta companyId por query: la empresa sale solo del Bearer.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const reportParsed = reportSchema.safeParse(
    searchParams.get("report") ?? "daily"
  );
  if (!reportParsed.success) {
    return NextResponse.json(
      {
        error:
          "Parámetro report inválido. Use: absences|lates|early_leaves|open_days|employee_summary|branch_summary|daily",
      },
      { status: 400 }
    );
  }
  const report = reportParsed.data as HrReportKind;

  const now = new Date();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam ? parseLocalDateParam(fromParam) : startOfMonth(now);
  const to = toParam ? parseLocalDateParam(toParam) : endOfMonth(now);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const branchId = searchParams.get("branchId") ?? undefined;
  const branchIdBigInt = branchId ? stringToBigint(branchId) : undefined;
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const employeeIdBigInt = employeeId ? stringToBigint(employeeId) : undefined;
  const shiftId = searchParams.get("shiftId") ?? undefined;
  const shiftIdBigInt = shiftId ? stringToBigint(shiftId) : undefined;

  if (branchId) {
    const ok = await prisma.branch.findFirst({
      where: { id: branchIdBigInt, companyId: stringToBigint(auth.companyId) },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }
  }
  if (employeeId) {
    const ok = await prisma.employee.findFirst({
      where: { id: employeeIdBigInt, companyId: stringToBigint(auth.companyId) },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
  }
  if (shiftId) {
    const ok = await prisma.shift.findFirst({
      where: { id: shiftIdBigInt, companyId: stringToBigint(auth.companyId) },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
  }

  const apiSession: ServerSession = {
    userId: auth.tokenId,
    companyId: auth.companyId,
    role: "COMPANY_ADMIN",
    email: "api@token.local",
    name: "API Token",
    impersonatorUserId: null,
    isImpersonating: false,
  };

  try {
    const result = await loadHrEvaluations(apiSession, {
      from,
      to,
      branchId,
      employeeId,
      shiftId,
      report,
      includeJustified: searchParams.get("includeJustified") !== "false",
      onlyUnjustified: searchParams.get("onlyUnjustified") === "true",
    });

    if (report === "employee_summary") {
      return NextResponse.json({
        report,
        companyId: auth.companyId,
        data: result.employeeSummary,
        range: result.range,
      });
    }
    if (report === "branch_summary") {
      return NextResponse.json({
        report,
        companyId: auth.companyId,
        data: result.branchSummary,
        range: result.range,
      });
    }

    const rows =
      report === "daily"
        ? result.evaluations.filter((r) => r.isWorkDay)
        : result.filtered;

    return NextResponse.json({
      report,
      companyId: auth.companyId,
      data: rows,
      range: result.range,
      totals: {
        workDays: result.evaluations.filter((r) => r.isWorkDay).length,
        rows: rows.length,
      },
    });
  } catch (err) {
    console.error("GET /api/v1/reports/hr error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
