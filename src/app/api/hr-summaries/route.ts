import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/server-auth";
import { canViewHrSummaries } from "@/lib/hr-summary/permissions";
import {
  loadExecutiveSummary,
} from "@/lib/hr-summary/service";
import {
  resolveSummaryPeriod,
  type HrSummaryPeriod,
} from "@/lib/hr-summary/period";
import { parseLocalDateParam } from "@/lib/hr/local-date";
import type { HrSummaryKind } from "@/lib/hr-summary/summary";

const querySchema = z
  .object({
    kind: z.enum(["daily", "weekly"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .refine((q) => !(q.from && !q.to) && !(!q.from && q.to), {
    message: "from y to deben venir juntos",
  });

const MAX_RANGE_DAYS = 92;

/**
 * GET /api/hr-summaries
 * Resumen ejecutivo determinista de RR. HH. (solo lectura).
 * - kind=daily|weekly: período canónico (hoy / semana actual).
 * - from + to (yyyy-MM-dd): rango libre (máx. 92 días).
 * Alcance: tenant de la sesión; BRANCH_SUPERVISOR queda forzado a su sucursal.
 */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canViewHrSummaries(session.role)) {
    return NextResponse.json(
      { error: "Tu rol no tiene acceso a los resúmenes de RR. HH." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    kind: searchParams.get("kind") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos. Use kind=daily|weekly o from+to (yyyy-MM-dd)" },
      { status: 400 }
    );
  }

  let period: HrSummaryPeriod;
  if (parsed.data.from && parsed.data.to) {
    const from = parseLocalDateParam(parsed.data.from);
    const to = parseLocalDateParam(parsed.data.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json(
        { error: "La fecha inicial no puede ser mayor que la final" },
        { status: 400 }
      );
    }
    if (
      (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000) >
      MAX_RANGE_DAYS
    ) {
      return NextResponse.json(
        { error: `El rango máximo es de ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      );
    }
    const kind: HrSummaryKind = parsed.data.kind ?? "daily";
    period = { kind, from, to, anchor: from };
  } else {
    period = resolveSummaryPeriod(parsed.data.kind ?? "daily");
  }

  try {
    const result = await loadExecutiveSummary(session, period);
    return NextResponse.json({
      kind: period.kind,
      range: result.range,
      forcedBranchId: result.forcedBranchId,
      summary: result.summary,
    });
  } catch (err) {
    console.error("GET /api/hr-summaries error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
