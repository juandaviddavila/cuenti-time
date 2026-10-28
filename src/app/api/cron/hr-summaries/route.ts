import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deliverExecutiveSummary } from "@/lib/hr-summary/service";
import { parseLocalDateParam } from "@/lib/hr/local-date";
import type { HrSummaryKind } from "@/lib/hr-summary/summary";

const bodySchema = z.object({
  kind: z.enum(["daily", "weekly"]).default("daily"),
  /** Override determinista de "ahora" (yyyy-MM-dd), p.ej. para reprocesar un día. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Limitar la corrida a una empresa (soporte/super-admin). */
  companyId: z.string().optional(),
});

/**
 * Cron: entrega idempotente de resúmenes ejecutivos por email.
 * Authorization: Bearer CRON_SECRET (mismo patrón que /api/webhooks/retry).
 * La deduplicación vive en deliverExecutiveSummary vía LateReportLog
 * (success=true en la fecha-ancla del período), así que re-correr el cron
 * nunca duplica envíos.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const provided = bearer ?? headerSecret;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 503 }
    );
  }
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido. Use { kind?: daily|weekly, date?: yyyy-MM-dd, companyId?: string }" },
      { status: 400 }
    );
  }

  const kind: HrSummaryKind = parsed.data.kind;
  const now = parsed.data.date
    ? parseLocalDateParam(parsed.data.date)
    : new Date();

  const companies = await prisma.company.findMany({
    where: {
      status: "ACTIVE",
      ...(parsed.data.companyId ? { id: stringToBigintSafe(parsed.data.companyId) ?? -1n } : {}),
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const results = {
    ok: true as const,
    kind,
    date: parsed.data.date ?? null,
    processed: companies.length,
    sent: 0,
    alreadySent: 0,
    skippedNoRecipients: 0,
    skippedNoData: 0,
    failed: 0,
  };

  for (const company of companies) {
    try {
      const result = await deliverExecutiveSummary({
        companyId: company.id.toString(),
        kind,
        now,
      });
      if (result.skipped) {
        if (result.reason === "already_sent") results.alreadySent += 1;
        else if (result.reason === "no_recipients") results.skippedNoRecipients += 1;
        else if (result.reason === "no_data") results.skippedNoData += 1;
        else if (result.reason === "send_failed") results.failed += 1;
      } else {
        results.sent += 1;
      }
    } catch (err) {
      results.failed += 1;
      console.error(
        `[hr-summaries] fallo empresa ${company.id.toString()}:`,
        err
      );
    }
  }

  return NextResponse.json(results);
}

function stringToBigintSafe(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
