// Native Node module mocks exercise the real Next handlers without external IO.
// Scheduling drafts: generation, conflict detection and human approval boundaries.
import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { createHmac } from "node:crypto";
import { register } from "node:module";

register("./schedule-draft-test-loader.mjs", import.meta.url);

process.env.JWT_SECRET = "synthetic-test-only".repeat(3);
process.env.JWT_REFRESH_SECRET = "synthetic-refresh-only".repeat(3);
process.env.SUPER_ADMIN_EMAILS = "";

const branches = [
  { id: 20n, companyId: 10n, status: "ACTIVE", name: "Sede A" },
  { id: 21n, companyId: 10n, status: "ACTIVE", name: "Sede B" },
  { id: 30n, companyId: 99n, status: "ACTIVE", name: "Otra empresa" },
];
const users = [
  { id: 1n, companyId: 10n, role: "COMPANY_ADMIN", status: "ACTIVE", branchId: null },
  { id: 7n, companyId: 10n, role: "BRANCH_SUPERVISOR", status: "ACTIVE", branchId: 20n },
  { id: 8n, companyId: 10n, role: "BRANCH_SUPERVISOR", status: "ACTIVE", branchId: 21n },
  { id: 9n, companyId: 10n, role: "REPORT_VIEWER", status: "ACTIVE", branchId: null },
  { id: 11n, companyId: 99n, role: "COMPANY_ADMIN", status: "ACTIVE", branchId: null },
];
const shifts = [
  { id: 5n, companyId: 10n, name: "Turno mañana", active: true },
  { id: 6n, companyId: 10n, name: "Turno noche", active: true },
  { id: 15n, companyId: 99n, name: "Turno externo", active: true },
];
const employees = [
  { id: 50n, companyId: 10n, branchId: 20n, status: "ACTIVE", fullName: "Ana" },
  { id: 51n, companyId: 10n, branchId: 20n, status: "ACTIVE", fullName: "Bruno" },
  { id: 52n, companyId: 10n, branchId: 21n, status: "ACTIVE", fullName: "Carmen" },
  { id: 59n, companyId: 99n, branchId: 30n, status: "ACTIVE", fullName: "Externo" },
];
const state = { drafts: [], assignments: [], audits: [], writes: 0, queries: [] };
const snapshot = () => JSON.stringify({ drafts: state.drafts, assignments: state.assignments, writes: state.writes, audits: state.audits }, (_k, v) => typeof v === "bigint" ? String(v) : v);

function matches(row, where) {
  for (const [key, cond] of Object.entries(where ?? {})) {
    if (key === "OR") continue;
    const value = row[key];
    if (cond === null || cond === undefined) { if (value !== cond) return false; continue; }
    if (typeof cond === "object" && !(cond instanceof Date) && !(cond instanceof Array) && !(typeof cond === "bigint")) {
      if ("in" in cond) { if (!cond.in.includes(value)) return false; continue; }
      if ("lte" in cond || "gte" in cond || "gt" in cond) {
        if ("lte" in cond && !(value <= cond.lte)) return false;
        if ("gte" in cond && !(value >= cond.gte)) return false;
        if ("gt" in cond && !(value > cond.gt)) return false;
        continue;
      }
    }
    if (value !== cond) return false;
  }
  return true;
}
const passesOr = (row, conds) => (conds ?? []).some((c) => Object.entries(c).every(([k, v]) => {
  if (v === null) return row[k] === null;
  if (v && typeof v === "object" && "gte" in v) return row[k] >= v.gte;
  return row[k] === v;
}));

const db = {
  user: { findUnique: async ({ where }) => users.find((u) => u.id === where.id) ?? null },
  branch: {
    findFirst: async ({ where }) => branches.find((b) => matches(b, where)) ?? null,
    findMany: async ({ where }) => branches.filter((b) => matches(b, where)),
  },
  shift: {
    findFirst: async ({ where }) => shifts.find((s) => matches(s, where)) ?? null,
    findUnique: async ({ where }) => shifts.find((s) => s.id === where.id) ?? null,
  },
  employee: {
    findMany: async ({ where }) => employees.filter((e) => matches(e, where)),
  },
  employeeShift: {
    findMany: async ({ where }) => state.assignments.filter((a) => matches(a, where) && (where.OR === undefined || passesOr(a, where.OR))),
    create: async ({ data }) => { state.writes++; const row = { id: BigInt(1000 + state.assignments.length), ...data }; state.assignments.push(row); return row; },
  },
  scheduleDraft: {
    create: async ({ data }) => { state.writes++; const row = { id: BigInt(state.drafts.length + 1), status: "DRAFT", approvedById: null, approvedAt: null, ...data }; state.drafts.push(row); return row; },
    findUnique: async ({ where }) => state.drafts.find((d) => d.id === where.id) ?? null,
    findMany: async ({ where }) => state.drafts.filter((d) => matches(d, where)),
    updateMany: async ({ where, data }) => {
      const hits = state.drafts.filter((d) => matches(d, where));
      hits.forEach((d) => Object.assign(d, data));
      state.writes += hits.length;
      return { count: hits.length };
    },
  },
  $transaction: async (task) => (Array.isArray(task) ? Promise.all(task) : task(db)),
  $queryRaw: async (...args) => { state.queries.push(args); return []; },
};

mock.module("next/headers", { namedExports: { cookies: () => ({ get: (name) => (jar[name] ? { value: jar[name] } : undefined) }) } });
mock.module("@/lib/prisma", { namedExports: { prisma: db } });
mock.module("@/lib/audit", { namedExports: { createAuditLog: async (value) => { state.audits.push(value); } } });

const jar = {};
function account(id, role, companyId = "10") {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ userId: String(id), companyId, role, email: "fixture@example.com", name: "Fixture", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 });
  jar["access-token"] = `${head}.${body}.${createHmac("sha256", process.env.JWT_SECRET).update(`${head}.${body}`).digest("base64url")}`;
}
function request(body, url = "http://localhost/api/schedule-drafts") {
  return { url, headers: { get: (name) => (name === "host" ? "localhost" : null) }, json: async () => body };
}
const GENERATE = { branchId: "20", shiftId: "5", rangeStart: "2026-11-02", rangeEnd: "2026-11-15" };

test("generation saves a draft only; forbidden roles and cross-tenant inputs mutate nothing", async () => {
  const route = await import("@/app/api/schedule-drafts/route");
  account(1, "COMPANY_ADMIN");
  const created = await route.POST(request({ ...GENERATE, name: "Horario noviembre" }));
  assert.equal(created.status, 201);
  const { draft } = await created.json();
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.id, "1");
  assert.equal(draft.branchId, "20");
  assert.deepEqual(draft.payload.proposals.map((p) => p.employeeId), ["50", "51"]);
  assert.equal(draft.payload.proposals[0].startDate, "2026-11-02");
  assert.ok(draft.payload.conflicts.some((c) => c.type === "employee_other_branch" && c.employeeId === "52"));
  assert.equal(state.drafts.length, 1);
  assert.equal(state.assignments.length, 0);
  assert.equal(state.audits.at(-1).action, "CREATE");
  assert.equal(state.audits.at(-1).entity, "SCHEDULE_DRAFT");

  const before = snapshot();
  account(9, "REPORT_VIEWER");
  assert.equal((await route.POST(request(GENERATE))).status, 403);
  account(7, "BRANCH_SUPERVISOR");
  assert.equal((await route.POST(request({ ...GENERATE, branchId: "21" }))).status, 403);
  account(1, "COMPANY_ADMIN");
  assert.equal((await route.POST(request({ ...GENERATE, branchId: "30" }))).status, 404);
  assert.equal((await route.POST(request({ ...GENERATE, shiftId: "15" }))).status, 422);
  assert.equal((await route.POST(request({ ...GENERATE, rangeStart: "ayer" }))).status, 400);
  assert.equal(snapshot(), before);
});

test("listing is tenant-scoped and a supervisor only sees drafts of their branch", async () => {
  const route = await import("@/app/api/schedule-drafts/route");
  account(1, "COMPANY_ADMIN");
  assert.equal((await route.POST(request({ ...GENERATE, branchId: "21", shiftId: "6", employeeIds: ["52"] }))).status, 201);
  account(7, "BRANCH_SUPERVISOR");
  const own = await (await route.GET(request(null, "http://localhost/api/schedule-drafts"))).json();
  assert.deepEqual(own.drafts.map((d) => d.branchId), ["20"]);
  account(11, "COMPANY_ADMIN", "99");
  const other = await (await route.GET(request(null, "http://localhost/api/schedule-drafts"))).json();
  assert.deepEqual(other.drafts, []);
  account(9, "REPORT_VIEWER");
  assert.equal((await route.GET(request(null, "http://localhost/api/schedule-drafts"))).status, 403);
});

test("approval re-checks conflicts against current data and applies atomically", async () => {
  const route = await import("@/app/api/schedule-drafts/route");
  const detail = await import("@/app/api/schedule-drafts/[id]/route");
  account(1, "COMPANY_ADMIN");
  assert.equal((await route.POST(request({ ...GENERATE, name: "Con conflicto" }))).status, 201);

  // A manual assignment appears after generation: approval must detect it again.
  state.assignments.push({ id: 999n, employeeId: 50n, shiftId: 6n, startDate: new Date("2026-11-01T00:00:00.000Z"), endDate: null });
  const blocked = await detail.POST(request({ action: "approve" }), { params: { id: "1" } });
  assert.equal(blocked.status, 409);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.conflicts[0].type, "overlap");
  assert.equal(blockedBody.conflicts[0].employeeId, "50");
  assert.equal(state.drafts[0].status, "DRAFT");
  assert.equal(state.assignments.length, 1);
  assert.ok(!state.audits.some((a) => a.action === "APPROVE"));
  state.assignments.pop();

  assert.equal((await route.POST(request({ ...GENERATE, employeeIds: ["51"], name: "Limpio" }))).status, 201);
  const approved = await detail.POST(request({ action: "approve" }), { params: { id: "2" } });
  assert.equal(approved.status, 200);
  const body = await approved.json();
  assert.equal(body.assignmentsCreated, 1);
  assert.equal(state.drafts[1].status, "APPROVED");
  assert.equal(state.drafts[1].approvedById, 1n);
  assert.equal(state.assignments.length, 2);
  const createdRow = state.assignments.at(-1);
  assert.equal(createdRow.employeeId, 51n);
  assert.equal(createdRow.shiftId, 5n);
  assert.equal(createdRow.startDate.toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(createdRow.endDate.toISOString(), "2026-11-15T23:59:59.999Z");
  const approveAudit = state.audits.find((a) => a.action === "APPROVE");
  assert.equal(approveAudit.entity, "SCHEDULE_DRAFT");
  assert.equal(approveAudit.companyId, 10n);

  // Double approval: the second request is rejected and nothing is written twice.
  const auditsBefore = state.audits.length;
  const again = await detail.POST(request({ action: "approve" }), { params: { id: "2" } });
  assert.equal(again.status, 409);
  assert.equal(state.assignments.length, 2);
  assert.equal(state.audits.length, auditsBefore);
});

test("discard closes a draft without creating assignments; discarded drafts cannot be approved", async () => {
  const route = await import("@/app/api/schedule-drafts/route");
  const detail = await import("@/app/api/schedule-drafts/[id]/route");
  account(1, "COMPANY_ADMIN");
  assert.equal((await route.POST(request({ ...GENERATE, name: "A descartar" }))).status, 201);
  const id = String(state.drafts.length);
  const discarded = await detail.POST(request({ action: "discard" }), { params: { id } });
  assert.equal(discarded.status, 200);
  assert.equal(state.drafts.at(-1).status, "DISCARDED");
  assert.equal(state.assignments.length, 2);
  assert.equal(state.audits.at(-1).action, "DISCARD");
  const before = snapshot();
  assert.equal((await detail.POST(request({ action: "approve" }), { params: { id } })).status, 409);
  assert.equal(snapshot(), before);
  assert.equal((await detail.GET(request(null, `http://localhost/api/schedule-drafts/${id}`), { params: { id } })).status, 200);
  assert.equal((await detail.GET(request(null, "http://localhost/api/schedule-drafts/77"), { params: { id: "77" } })).status, 404);
});

test("approval re-validates stored draft data against current records before writing", async () => {
  const route = await import("@/app/api/schedule-drafts/route");
  const detail = await import("@/app/api/schedule-drafts/[id]/route");
  account(1, "COMPANY_ADMIN");

  assert.equal((await route.POST(request({ ...GENERATE, name: "Corrupto" }))).status, 201);
  const corruptId = String(state.drafts.length);
  state.drafts.at(-1).payload = { rangeStart: "2026-11-02", proposals: "no-es-un-array", conflicts: [] };
  const before = snapshot();
  assert.equal((await detail.POST(request({ action: "approve" }), { params: { id: corruptId } })).status, 422);
  assert.equal(snapshot(), before);

  assert.equal((await route.POST(request({ ...GENERATE, employeeIds: ["50"], name: "Empleado inactivo" }))).status, 201);
  const staleId = String(state.drafts.length);
  employees.find((e) => e.id === 50n).status = "INACTIVE";
  assert.equal((await detail.POST(request({ action: "approve" }), { params: { id: staleId } })).status, 422);
  assert.equal(state.assignments.length, 2);
  assert.equal(state.drafts.at(-1).status, "DRAFT");
  employees.find((e) => e.id === 50n).status = "ACTIVE";

  assert.equal((await route.POST(request({ ...GENERATE, name: "Sede cerrada" }))).status, 201);
  const closedId = String(state.drafts.length);
  branches.find((b) => b.id === 20n).status = "INACTIVE";
  assert.equal((await detail.POST(request({ action: "approve" }), { params: { id: closedId } })).status, 422);
  branches.find((b) => b.id === 20n).status = "ACTIVE";
  assert.equal(state.assignments.length, 2);
});

test("cross-tenant or wrong-branch approval rejects without mutations, counters or audit success", async () => {
  const route = await import("@/app/api/schedule-drafts/route");
  const detail = await import("@/app/api/schedule-drafts/[id]/route");
  account(1, "COMPANY_ADMIN");
  assert.equal((await route.POST(request({ ...GENERATE, name: "Privado" }))).status, 201);
  const id = String(state.drafts.length);
  const before = snapshot();
  account(11, "COMPANY_ADMIN", "99");
  assert.equal((await detail.POST(request({ action: "approve" }), { params: { id } })).status, 403);
  account(8, "BRANCH_SUPERVISOR");
  assert.equal((await detail.POST(request({ action: "approve" }), { params: { id } })).status, 403);
  account(9, "REPORT_VIEWER");
  assert.equal((await detail.POST(request({ action: "approve" }), { params: { id } })).status, 403);
  assert.equal((await detail.POST(request({ action: "discard" }), { params: { id } })).status, 403);
  assert.equal(snapshot(), before);
  // The draft owner's supervisor branch can approve their own branch draft.
  account(7, "BRANCH_SUPERVISOR");
  const approved = await detail.POST(request({ action: "approve" }), { params: { id } });
  assert.equal(approved.status, 200);
  assert.equal(state.assignments.length, 3);
});

test("regression: existing employee-shift assignment endpoint keeps its behavior", async () => {
  const route = await import("@/app/api/employee-shifts/route");
  jar["access-token"] = "expired";
  assert.equal((await route.POST(request({ employeeId: "50", shiftId: "5", startDate: "2026-12-01T00:00:00.000Z" }))).status, 401);
  account(9, "REPORT_VIEWER");
  assert.equal((await route.POST(request({ employeeId: "50", shiftId: "5", startDate: "2026-12-01T00:00:00.000Z" }))).status, 403);
  account(1, "COMPANY_ADMIN");
  const ok = await route.POST(request({ employeeId: "50", shiftId: "5", startDate: "2026-12-01T00:00:00.000Z", endDate: "2026-12-31T00:00:00.000Z" }));
  assert.equal(ok.status, 201);
  const payload = await ok.json();
  assert.equal(payload.employee.fullName, "Ana");
  assert.equal(state.assignments.at(-1).employeeId, 50n);
  assert.equal((await route.GET(request(null, "http://localhost/api/employee-shifts"))).status, 200);
});
