import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";
import { z } from "zod";
import { requireSession } from "@/lib/server-auth";
import { loadHrEvaluations } from "@/lib/hr/load-hr-evaluations";
import type { HrReportKind } from "@/lib/hr/day-evaluation";
import { parseLocalDateParam } from "@/lib/hr/local-date";

const reportSchema = z.enum([
  "absences",
  "lates",
  "early_leaves",
  "open_days",
  "employee_summary",
  "branch_summary",
  "daily",
]);

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json(
      { error: "La fecha inicial no puede ser mayor que la final" },
      { status: 400 }
    );
  }

  const employeeIds = Array.from(
    new Set(
      searchParams
        .getAll("employeeId")
        .flatMap((v) => v.split(","))
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  const positionIds = Array.from(
    new Set(
      searchParams
        .getAll("positionId")
        .flatMap((v) => v.split(","))
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );

  try {
    const result = await loadHrEvaluations(session, {
      from,
      to,
      branchId: searchParams.get("branchId") ?? undefined,
      employeeIds: employeeIds.length > 0 ? employeeIds : undefined,
      positionIds: positionIds.length > 0 ? positionIds : undefined,
      shiftId: searchParams.get("shiftId") ?? undefined,
      report,
      includeJustified: searchParams.get("includeJustified") !== "false",
      onlyUnjustified: searchParams.get("onlyUnjustified") === "true",
    });

    if (report === "employee_summary") {
      return NextResponse.json({
        report,
        data: result.employeeSummary,
        range: result.range,
        forcedBranchId: result.forcedBranchId,
      });
    }

    if (report === "branch_summary") {
      return NextResponse.json({
        report,
        data: result.branchSummary,
        range: result.range,
        forcedBranchId: result.forcedBranchId,
      });
    }

    return NextResponse.json({
      report,
      data: result.filtered,
      range: result.range,
      forcedBranchId: result.forcedBranchId,
      totals: {
        workDays: result.evaluations.filter((r) => r.isWorkDay).length,
        rows: result.filtered.length,
      },
    });
  } catch (err) {
    console.error("GET /api/reports/hr error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
