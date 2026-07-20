import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, differenceInMinutes } from "date-fns";
import { requireSession } from "@/lib/server-auth";
import { loadHrEvaluations } from "@/lib/hr/load-hr-evaluations";
import { parseLocalDateParam } from "@/lib/hr/local-date";

function minutesToDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

/** @deprecated Prefer GET /api/reports/hr — mantiene compatibilidad con el visor anterior. */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
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
  const branchId = searchParams.get("branchId") ?? undefined;
  const showAbsences = searchParams.get("showAbsences") === "true";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const now = new Date();
  const start = from ? parseLocalDateParam(from) : startOfMonth(now);
  const end = to ? parseLocalDateParam(to) : endOfMonth(now);

  try {
    const result = await loadHrEvaluations(session, {
      from: start,
      to: end,
      branchId,
      employeeIds: employeeIds.length > 0 ? employeeIds : undefined,
      positionIds: positionIds.length > 0 ? positionIds : undefined,
      report: showAbsences ? "absences" : "daily",
      onlyUnjustified: showAbsences,
      includeJustified: !showAbsences,
    });

    const source = showAbsences ? result.filtered : result.evaluations.filter((r) => r.isWorkDay);

    const rows = source.map((r) => {
      const minutes =
        r.checkInAt && r.checkOutAt
          ? differenceInMinutes(new Date(r.checkOutAt), new Date(r.checkInAt))
          : 0;

      let status = r.outcome;
      if (status === "PRESENTE" || status === "TARDE" || status === "SALIDA_ANTICIPADA" || status === "TARDE_Y_SALIDA_ANTICIPADA") {
        status = "COMPLETO" as typeof r.outcome;
      }
      if (status === "AUSENCIA_JUSTIFICADA") status = "AUSENTE" as typeof r.outcome;

      return {
        date: r.date,
        dayName: r.dayName,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        documentNumber: r.documentNumber,
        branchName: r.branchName,
        positionName: r.positionName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        differenceMinutes: minutes,
        difference: minutes > 0 ? minutesToDuration(minutes) : "—",
        status:
          r.outcome === "AUSENTE" || r.outcome === "AUSENCIA_JUSTIFICADA"
            ? "AUSENTE"
            : r.outcome === "SIN_SALIDA"
              ? "SIN_SALIDA"
              : r.checkIn
                ? r.checkOut
                  ? "COMPLETO"
                  : "SIN_SALIDA"
                : "SIN_ENTRADA",
        outcome: r.outcome,
        outcomeLabel: r.outcomeLabel,
        lateMinutes: r.lateMinutes,
        earlyLeaveMinutes: r.earlyLeaveMinutes,
        scheduledStart: r.scheduledStart,
        scheduledEnd: r.scheduledEnd,
        novelty: r.novelty,
      };
    });

    return NextResponse.json({
      data: rows,
      range: result.range,
    });
  } catch (err) {
    console.error("GET /api/reports/detailed error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
