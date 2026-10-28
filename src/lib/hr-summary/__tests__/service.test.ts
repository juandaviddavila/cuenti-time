import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePeriod,
  type EmployeeDayContext,
  type DayEvaluation,
} from "../../hr/day-evaluation";
import { buildExecutiveSummary } from "../summary";
import {
  deliverExecutiveSummary,
  resolveSummaryRecipients,
  type SummaryDeliveryDeps,
} from "../service";
import { dailySummaryPeriod, weeklySummaryPeriod } from "../period";

/**
 * Tests de orquestación de deliverExecutiveSummary con dependencias
 * inyectadas (db en memoria + sendMail falso): deterministas y sin depender
 * del estado de la base de datos local.
 * Se ejecutan con: pnpm exec tsx --test src/lib/hr-summary/__tests__/*.test.ts
 */

interface LogRow {
  id: number;
  companyId: bigint;
  branchId: bigint;
  date: Date;
  recipientCount: number;
  lateCount: number;
  absentCount: number;
  success: boolean;
  errorMessage: string | null;
}

interface UserRow {
  id: number;
  companyId: bigint;
  email: string;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
}

/** Martes 2026-09-01 15:00 local: fecha fija para operación determinista. */
const NOW = new Date(2026, 8, 1, 15, 0, 0, 0);

const OFFICE_SHIFT = {
  id: "s1",
  name: "Oficina",
  mondayStart: "08:00",
  mondayEnd: "17:00",
  tuesdayStart: "08:00",
  tuesdayEnd: "17:00",
  wednesdayStart: "08:00",
  wednesdayEnd: "17:00",
  thursdayStart: "08:00",
  thursdayEnd: "17:00",
  fridayStart: "08:00",
  fridayEnd: "17:00",
  saturdayStart: null,
  saturdayEnd: null,
  sundayStart: null,
  sundayEnd: null,
};

function seedEvaluations(): DayEvaluation[] {
  const day = new Date(2026, 8, 1); // martes
  const employee: EmployeeDayContext = {
    id: "9",
    fullName: "Empleado Prueba",
    documentNumber: "DOC-9",
    branchId: "77",
    branchName: "Sede Norte",
    positionName: "General",
    companyId: "5",
  };
  return evaluatePeriod({
    employees: [employee],
    days: [day],
    assignments: [
      {
        employeeId: "9",
        shiftId: "s1",
        startDate: new Date(2026, 0, 1),
        endDate: null,
        shift: OFFICE_SHIFT,
      },
    ],
    records: [
      {
        employeeId: "9",
        type: "CHECK_IN",
        // 20 min tarde (tolerancia default 10)
        recordedAt: new Date(2026, 8, 1, 8, 20, 0),
      },
    ],
    novelties: [],
    toleranceByCompany: new Map([["5", 10]]),
  });
}

function findLog(logs: LogRow[], where: Record<string, unknown>): LogRow | null {
  return (
    logs.find(
      (l) =>
        l.companyId === where.companyId &&
        (where.date as Date).getTime() === l.date.getTime() &&
        (where.success === undefined || l.success === where.success)
    ) ?? null
  );
}

/** Estado mutable del doble de prisma. */
const store = {
  companies: new Map<string, { id: bigint; name: string }>(),
  users: [] as UserRow[],
  logs: [] as LogRow[],
  nextUserId: 1,
  nextLogId: 1,
};

const sentMails: Array<{ to: string; subject: string; html: string }> = [];
let failNextSend: Error | null = null;
let skipNextSend = false;

function makeDb() {
  const makeTx = () => ({
    lateReportLog: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        findLog(store.logs, where),
      createMany: async ({ data }: { data: Omit<LogRow, "id">[] }) => {
        for (const row of data) {
          store.logs.push({ ...row, id: store.nextLogId++ });
        }
        return { count: data.length };
      },
    },
    // El advisory lock real serializa en Postgres; el mutex del stub modela eso.
    $queryRaw: async () => [],
  });

  return {
    company: {
      async findUnique({ where }: { where: { id: bigint } }) {
        return store.companies.get(where.id.toString()) ?? null;
      },
    },
    user: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        const emailVerified = where.emailVerifiedAt as { not: null } | undefined;
        return store.users.filter(
          (u) =>
            u.companyId === where.companyId &&
            u.role === where.role &&
            u.status === where.status &&
            (emailVerified?.not === null ? u.emailVerifiedAt !== null : true)
        );
      },
    },
    lateReportLog: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return findLog(store.logs, where);
      },
      async createMany({ data }: { data: Omit<LogRow, "id">[] }) {
        for (const row of data) {
          store.logs.push({ ...row, id: store.nextLogId++ });
        }
        return { count: data.length };
      },
    },
    // Mutex por instancia: modela la serialización del advisory lock para
    // que los tests de concurrencia sean deterministas.
    _txQueue: Promise.resolve() as Promise<unknown>,
    $transaction(fn: (tx: unknown) => unknown) {
      const run = () => fn(makeTx());
      const result = this._txQueue.then(run, run);
      this._txQueue = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    },
  };
}

function makeDeps(): SummaryDeliveryDeps {
  return {
    db: makeDb() as unknown as SummaryDeliveryDeps["db"],
    sendMail: async (options) => {
      if (failNextSend) {
        const err = failNextSend;
        failNextSend = null;
        throw err;
      }
      if (skipNextSend) {
        skipNextSend = false;
        return { skipped: true };
      }
      sentMails.push(options);
      return { skipped: false };
    },
    loadSummary: async (_session, params) => ({
      summary: buildExecutiveSummary(seedEvaluations()),
      range: { from: params.from.toISOString(), to: params.to.toISOString() },
    }),
  };
}

function addCompany(id: string, name: string): void {
  store.companies.set(id, { id: BigInt(id), name });
}

function addAdmin(
  companyId: string,
  email: string,
  status = "ACTIVE",
  verified = true
): void {
  store.users.push({
    id: store.nextUserId++,
    companyId: BigInt(companyId),
    email,
    role: "COMPANY_ADMIN",
    status,
    emailVerifiedAt: verified ? new Date() : null,
  });
}

beforeEach(() => {
  store.companies.clear();
  store.users.length = 0;
  store.logs.length = 0;
  sentMails.length = 0;
  failNextSend = null;
  skipNextSend = false;
  addCompany("5", "Empresa A");
  addAdmin("5", "Admin.A2@Example.COM");
  addAdmin("5", "admin.a1@example.com");
  addAdmin("5", "inactivo@example.com", "INACTIVE");
});

describe("deliverExecutiveSummary — prevención de envío duplicado", () => {
  it("envía una sola vez por empresa/período; el segundo intento se omite antes de enviar", async () => {
    const deps = makeDeps();
    const first = await deliverExecutiveSummary({ companyId: "5", kind: "daily", now: NOW }, deps);
    assert.deepEqual(
      {
        skipped: first.skipped,
        recipients: first.recipients,
        logsCreated: first.logsCreated,
      },
      { skipped: false, recipients: 2, logsCreated: 1 }
    );
    assert.equal(sentMails.length, 1);

    const mail = sentMails[0];
    // Destinatarios normalizados, deduplicados y ordenados
    assert.equal(mail.to, "admin.a1@example.com, admin.a2@example.com");
    assert.ok(mail.subject.includes("diario"));
    assert.ok(mail.html.includes("Empresa A"));
    assert.ok(mail.html.includes("10 min"));

    const anchor = dailySummaryPeriod(NOW).anchor;
    const logs = store.logs.filter(
      (l) => l.companyId === 5n && l.date.getTime() === anchor.getTime()
    );
    assert.equal(logs.length, 1);
    assert.deepEqual(
      {
        branchId: logs[0].branchId,
        lateCount: logs[0].lateCount,
        absentCount: logs[0].absentCount,
        recipientCount: logs[0].recipientCount,
        success: logs[0].success,
      },
      { branchId: 77n, lateCount: 1, absentCount: 0, recipientCount: 2, success: true }
    );

    const second = await deliverExecutiveSummary({ companyId: "5", kind: "daily", now: NOW }, deps);
    assert.deepEqual(
      { skipped: second.skipped, reason: second.reason },
      { skipped: true, reason: "already_sent" }
    );
    assert.equal(sentMails.length, 1);
    assert.equal(store.logs.length, 1);
  });

  it("el resumen semanal usa ancla distinta y no choca con el diario", async () => {
    const deps = makeDeps();
    const daily = await deliverExecutiveSummary({ companyId: "5", kind: "daily", now: NOW }, deps);
    assert.equal(daily.skipped, false);

    const weekly = await deliverExecutiveSummary({ companyId: "5", kind: "weekly", now: NOW }, deps);
    assert.equal(weekly.skipped, false);
    assert.equal(weekly.recipients, 2);
    assert.equal(sentMails.length, 2);

    const weeklyAnchor = weeklySummaryPeriod(NOW).anchor;
    assert.notEqual(dailySummaryPeriod(NOW).anchor.getTime(), weeklyAnchor.getTime());
    const weeklyLogs = store.logs.filter(
      (l) => l.companyId === 5n && l.date.getTime() === weeklyAnchor.getTime()
    );
    assert.equal(weeklyLogs.length, 1);
    assert.equal(weeklyLogs[0].success, true);
  });

  it("un fallo de envío deja log de auditoría y NO bloquea el reintento", async () => {
    const deps = makeDeps();
    failNextSend = new Error("SMTP caído");

    const failed = await deliverExecutiveSummary({ companyId: "5", kind: "daily", now: NOW }, deps);
    assert.deepEqual(
      { skipped: failed.skipped, reason: failed.reason, recipients: failed.recipients },
      { skipped: true, reason: "send_failed", recipients: 2 }
    );

    const failLogs = store.logs.filter((l) => l.companyId === 5n && !l.success);
    assert.equal(failLogs.length, 1);
    assert.ok(failLogs[0].errorMessage?.includes("SMTP caído"));

    // El reintento sí envía porque la deduplicación solo cuenta success=true
    const retry = await deliverExecutiveSummary({ companyId: "5", kind: "daily", now: NOW }, deps);
    assert.equal(retry.skipped, false);
    assert.equal(retry.logsCreated, 1);
    assert.equal(sentMails.length, 1);
  });
});

describe("deliverExecutiveSummary — alcance multi-tenant y destinatarios", () => {
  it("sin administradores activos omite el envío y no escribe log", async () => {
    addCompany("6", "Empresa B");
    const deps = makeDeps();

    const result = await deliverExecutiveSummary({ companyId: "6", kind: "daily", now: NOW }, deps);
    assert.deepEqual(
      { skipped: result.skipped, reason: result.reason },
      { skipped: true, reason: "no_recipients" }
    );
    assert.equal(sentMails.length, 0);
    assert.equal(store.logs.filter((l) => l.companyId === 6n).length, 0);
  });

  it("empresa desconocida se omite sin tocar nada", async () => {
    const deps = makeDeps();
    const result = await deliverExecutiveSummary({ companyId: "999", kind: "daily", now: NOW }, deps);
    assert.deepEqual(
      { skipped: result.skipped, reason: result.reason },
      { skipped: true, reason: "company_not_found" }
    );
    assert.equal(sentMails.length, 0);
  });

  it("solo administradores ACTIVOS con email verificado reciben, deduplicados y ordenados", async () => {
    addAdmin("5", "SinVerificar@Example.com", "ACTIVE", false);
    addAdmin("5", "admin.a1@example.com"); // duplicado normalizado
    const emails = await resolveSummaryRecipients("5", makeDb() as never);
    assert.deepEqual(emails, ["admin.a1@example.com", "admin.a2@example.com"]);
  });

  it("el ledger de envío está aislado por empresa (misma fecha, otro tenant)", async () => {
    const deps = makeDeps();
    // Empresa A ya tendrá log diario; la empresa C no debe verse bloqueada.
    await deliverExecutiveSummary({ companyId: "5", kind: "daily", now: NOW }, deps);
    assert.equal(sentMails.length, 1);

    addCompany("7", "Empresa C");
    addAdmin("7", "admin.c@example.com");
    const result = await deliverExecutiveSummary({ companyId: "7", kind: "daily", now: NOW }, deps);
    assert.equal(result.skipped, false);
    assert.equal(result.recipients, 1);
    assert.equal(store.logs.filter((l) => l.companyId === 7n).length, 1);
    assert.equal(sentMails.length, 2);
  });
});
