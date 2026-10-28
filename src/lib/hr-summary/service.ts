import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { loadHrEvaluations } from "@/lib/hr/load-hr-evaluations";
import { stringToBigint } from "@/lib/bigint";
import type { TenantSession } from "@/lib/tenant";
import type { PrismaClient } from "@prisma/client";
import {
  buildExecutiveSummary,
  type ExecutiveSummary,
  type HrSummaryKind,
} from "@/lib/hr-summary/summary";
import {
  resolveSummaryPeriod,
  type HrSummaryPeriod,
} from "@/lib/hr-summary/period";
import { buildHrSummaryEmailHtml } from "@/lib/hr-summary/email-html";

export interface LoadedExecutiveSummary {
  summary: ExecutiveSummary;
  range: { from: string; to: string };
  forcedBranchId?: string;
}

/**
 * Fuente única del resumen ejecutivo: reuso del motor RR.HH. tenant-scoped
 * (getCompanyFilter + sucursal forzada del BRANCH_SUPERVISOR).
 * Solo lectura.
 */
export async function loadExecutiveSummary(
  session: TenantSession,
  params: { from: Date; to: Date }
): Promise<LoadedExecutiveSummary> {
  const result = await loadHrEvaluations(session, {
    from: params.from,
    to: params.to,
    report: "daily",
  });
  return {
    summary: buildExecutiveSummary(result.evaluations),
    range: result.range,
    forcedBranchId: result.forcedBranchId,
  };
}

/**
 * Destinatarios por defecto del resumen: administradores de la empresa
 * activos con email verificado. Emails normalizados (minúsculas), deduplicados
 * y ordenados para envíos deterministas.
 */
export async function resolveSummaryRecipients(
  companyId: string,
  db: Pick<PrismaClient, "user"> = prisma
): Promise<string[]> {
  const companyIdBig = stringToBigint(companyId);
  if (companyIdBig === null || companyIdBig === undefined) return [];
  const users = await db.user.findMany({
    where: {
      companyId: companyIdBig,
      role: "COMPANY_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
    },
    select: { email: true },
  });
  return Array.from(
    new Set(
      users
        .map((u) => u.email.trim().toLowerCase())
        .filter((email) => email.length > 0)
    )
  ).sort();
}

export type SummaryDeliverySkipReason =
  | "company_not_found"
  | "no_recipients"
  | "no_data"
  | "already_sent"
  | "send_failed";

export interface SummaryDeliveryResult {
  companyId: string;
  kind: HrSummaryKind;
  skipped: boolean;
  reason?: SummaryDeliverySkipReason;
  recipients?: number;
  /** Filas de LateReportLog creadas (una por sucursal con empleados evaluados). */
  logsCreated?: number;
}

/**
 * Dependencias sobre IO externo, inyectables para tests deterministas.
 * Los valores por defecto son los usados en producción.
 */
export interface SummaryDeliveryDeps {
  db: Pick<PrismaClient, "company" | "user" | "lateReportLog" | "$transaction">;
  sendMail: (options: { to: string; subject: string; html: string }) => Promise<{
    skipped: boolean;
  }>;
  loadSummary: (
    session: TenantSession,
    params: { from: Date; to: Date }
  ) => Promise<LoadedExecutiveSummary>;
}

const defaultDeps: SummaryDeliveryDeps = {
  db: prisma,
  sendMail: sendEmail,
  loadSummary: loadExecutiveSummary,
};

interface CompanyScope {
  id: bigint;
  name: string;
}

/**
 * FNV-1a 64-bit normalizado con signo: clave estable para (empresa, tipo,
 * ancla), siempre dentro del rango int8 de PostgreSQL (−2^63 … 2^63−1) para
 * que pg_advisory_xact_lock($1::int8) la acepte.
 */
export function advisoryLockKey(input: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return BigInt.asIntN(64, hash);
}

type DeliveryOutcome =
  | { status: "sent"; logsCreated: number }
  | { status: "already_sent" }
  | { status: "send_failed" };

/**
 * Entrega idempotente del resumen ejecutivo por email.
 *
 * Garantía de envío único: el re-chequeo de "ya enviado", el envío y la
 * escritura del ledger ocurren DENTRO de una transacción ReadCommitted que
 * primero toma un advisory lock de PostgreSQL (pg_advisory_xact_lock) con
 * clave derivada de (empresa, tipo, ancla). ReadCommitted es decisivo: cada
 * sentencia ve un snapshot fresco, así que tras esperar el lock el re-chequeo
 * SÍ ve el commit del ganador (Serializable tomaría el snapshot antes de la
 * espera y vería datos obsoletos). Dos procesos concurrentes se serializan:
 * el segundo ve el ledger de éxito y omite el envío. El resumen se carga
 * ANTES de tomar el lock para minimizar su duración.
 *
 * Deduplicación: LateReportLog con success=true en la fecha-ancla exacta del
 * período (medianoche para diario, mediodía del lunes para semanal). Un
 * envío omitido por adapter sin SMTP ({ skipped: true }) o que lanza error
 * queda logged con success=false y NO bloquea reintentos; nunca se escribe
 * success=true para ellos.
 */
export async function deliverExecutiveSummary(
  params: {
    companyId: string;
    kind?: HrSummaryKind;
    now?: Date;
  },
  deps: SummaryDeliveryDeps = defaultDeps
): Promise<SummaryDeliveryResult> {
  const kind = params.kind ?? "daily";
  const now = params.now ?? new Date();
  const period = resolveSummaryPeriod(kind, now);

  const companyIdBig = stringToBigint(params.companyId);
  if (companyIdBig === null || companyIdBig === undefined) {
    return { companyId: params.companyId, kind, skipped: true, reason: "company_not_found" };
  }

  const company = await deps.db.company.findUnique({
    where: { id: companyIdBig },
    select: { id: true, name: true },
  });
  if (!company) {
    return { companyId: params.companyId, kind, skipped: true, reason: "company_not_found" };
  }

  const recipients = await resolveSummaryRecipients(params.companyId, deps.db);
  if (recipients.length === 0) {
    return { companyId: params.companyId, kind, skipped: true, reason: "no_recipients" };
  }

  // Atajo fuera de transacción: un período ya entregado no vuelve a intentarse.
  const alreadySent = await deps.db.lateReportLog.findFirst({
    where: { companyId: company.id, date: period.anchor, success: true },
    select: { id: true },
  });
  if (alreadySent) {
    return {
      companyId: params.companyId,
      kind,
      skipped: true,
      reason: "already_sent",
      recipients: recipients.length,
    };
  }

  const session: TenantSession = {
    userId: "cron:hr-summaries",
    companyId: params.companyId,
    role: "COMPANY_ADMIN",
  };
  // Se carga antes del lock para minimizar el tiempo bajo advisory lock.
  const { summary } = await deps.loadSummary(session, period);
  if (summary.byBranch.length === 0) {
    // Sin sucursales evaluadas no hay nada que resumir: no se envía un correo
    // vacío recurrente ni se marca como enviado.
    return { companyId: params.companyId, kind, skipped: true, reason: "no_data" };
  }

  const subject = `cuenti time · Resumen ${kind === "weekly" ? "semanal" : "diario"} de RR. HH. — ${company.name}`;
  const html = buildHrSummaryEmailHtml({
    companyName: company.name,
    kind,
    period,
    summary,
  });
  const lockKey = advisoryLockKey(
    `hr-summary:${company.id.toString()}:${kind}:${period.anchor.getTime()}`
  );

  // ReadCommitted: el re-chequeo tras la espera del lock ve el snapshot fresco
  // del ganador. Un error de la transacción (p.ej. P2034) se propaga: un
  // abort no es prueba de entrega y nunca debe reportarse como already_sent.
  const outcome: DeliveryOutcome = await deps.db.$transaction(
    async (tx) => {
      // Serializa procesos concurrentes sobre el mismo (empresa, tipo, ancla).
      // La función retorna void; la subconsulta devuelve un int normal que
      // Prisma sí puede deserializar, con cast explícito a int8 del bigint.
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(${lockKey}::int8)) AS lock_holder`;

      const existing = await tx.lateReportLog.findFirst({
        where: {
          companyId: company.id,
          date: period.anchor,
          success: true,
        },
        select: { id: true },
      });
      if (existing) return { status: "already_sent" as const };

      try {
        const sent = await deps.sendMail({
          to: recipients.join(", "),
          subject,
          html,
        });
        if (sent.skipped) {
          // Adapter sin SMTP: no es éxito. Ledger de fallo (retryable).
          await writeSummaryLedger(tx, {
            company,
            period,
            summary,
            recipients: recipients.length,
            success: false,
            errorMessage: "Envío omitido: SMTP no configurado",
          });
          return { status: "send_failed" as const };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error de envío";
        await writeSummaryLedger(tx, {
          company,
          period,
          summary,
          recipients: recipients.length,
          success: false,
          errorMessage: message,
        });
        return { status: "send_failed" as const };
      }

      const logsCreated = await writeSummaryLedger(tx, {
        company,
        period,
        summary,
        recipients: recipients.length,
        success: true,
      });
      return { status: "sent" as const, logsCreated };
    },
    { isolationLevel: "ReadCommitted" }
  );

  if (outcome.status === "already_sent") {
    return {
      companyId: params.companyId,
      kind,
      skipped: true,
      reason: "already_sent",
      recipients: recipients.length,
    };
  }
  if (outcome.status === "send_failed") {
    return {
      companyId: params.companyId,
      kind,
      skipped: true,
      reason: "send_failed",
      recipients: recipients.length,
    };
  }
  return {
    companyId: params.companyId,
    kind,
    skipped: false,
    recipients: recipients.length,
    logsCreated: outcome.logsCreated,
  };
}

type LedgerDb = Pick<PrismaClient, "lateReportLog">;

/** Escribe una fila de LateReportLog por sucursal evaluada (ledger + auditoría). */
async function writeSummaryLedger(
  db: LedgerDb,
  params: {
    company: CompanyScope;
    period: HrSummaryPeriod;
    summary: ExecutiveSummary;
    recipients: number;
    success: boolean;
    errorMessage?: string;
  }
): Promise<number> {
  const { company, period, summary, recipients, success, errorMessage } = params;

  if (summary.byBranch.length === 0) {
    // Empresa sin sucursales evaluadas: sin FK de sucursal posible; se omite
    // el ledger. Sin empleados no hay resumen que deduplicar.
    return 0;
  }

  const data = summary.byBranch.map((branch) => ({
    companyId: company.id,
    branchId: stringToBigint(branch.branchId) ?? -1n,
    date: period.anchor,
    recipientCount: recipients,
    lateCount: branch.late,
    absentCount: branch.absent + branch.justifiedAbsent,
    success,
    errorMessage: errorMessage ?? null,
  }));

  const result = await db.lateReportLog.createMany({ data });
  return result.count;
}
