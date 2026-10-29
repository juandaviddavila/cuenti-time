// Native Node module mocks exercise the real Next handlers without external IO.
import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { createHmac } from "node:crypto";

process.env.JWT_SECRET = "synthetic-test-only".repeat(3);
process.env.JWT_REFRESH_SECRET = "synthetic-refresh-only".repeat(3);
process.env.SUPER_ADMIN_EMAILS = "";
const branches = [
  { id: 20n, companyId: 10n, status: "ACTIVE", name: "Branch A", duplicateWindowMinutes: 10, latitude: 4, longitude: -74, radiusMeters: 100 },
  { id: 21n, companyId: 10n, status: "ACTIVE", name: "Branch B", duplicateWindowMinutes: 10, latitude: null, longitude: null, radiusMeters: 100 },
  { id: 30n, companyId: 99n, status: "ACTIVE", name: "Other tenant", duplicateWindowMinutes: 10 },
];
const users = [
  { id: 1n, companyId: 10n, role: "COMPANY_ADMIN", status: "ACTIVE", branchId: null, bypassGeofence: true, kioskGrants: [] },
  { id: 7n, companyId: 10n, role: "REPORT_VIEWER", status: "ACTIVE", branchId: null, kioskGrants: [{ companyId: 10n, branchId: 20n, userId: 7n }] },
  { id: 8n, companyId: 10n, role: "BRANCH_SUPERVISOR", status: "ACTIVE", branchId: 21n, kioskGrants: [] },
];
const employees = [
  { id: 5n, companyId: 10n, branchId: 20n, status: "ACTIVE", fullName: "Employee A" },
  { id: 6n, companyId: 10n, branchId: 21n, status: "ACTIVE", fullName: "Employee B" },
  { id: 9n, companyId: 99n, branchId: 30n, status: "ACTIVE", fullName: "Other employee" },
];
const state = { devices: [], grants: [], records: [], audits: [], queries: [], writes: 0 };
const jar = {};
const headers = {};
const snapshot = () => JSON.stringify(state, (_key, value) => typeof value === "bigint" ? String(value) : value);
const related = device => device ? { ...device, company: { status: "ACTIVE" }, branch: branches.find(b => b.id === device.branchId) } : null;
const projected = (row, select) => Object.fromEntries(Object.entries(row).filter(([key]) => key in select));
const db = {
  user: {
    findFirst: async ({ where }) => users.find(u => u.id === where.id && u.companyId === where.companyId && u.status === where.status) ?? null,
    findUnique: async ({ where }) => users.find(u => u.id === where.id) ?? null,
    findMany: async ({ where }) => users.filter(u => u.companyId === where.companyId),
  },
  branch: {
    findFirst: async ({ where }) => branches.find(b => b.id === where.id && b.companyId === where.companyId && (!where.status || b.status === where.status)) ?? null,
    findUnique: async ({ where }) => branches.find(b => b.id === where.id) ?? null,
    findMany: async ({ where }) => branches.filter(b => b.companyId === where.companyId && (!where.id?.in || where.id.in.includes(b.id))),
  },
  employee: { findUnique: async ({ where }) => employees.find(e => e.id === where.id) ?? null },
  company: { findUnique: async () => ({ faceMatchThreshold: 0.5 }) },
  kioskDevice: {
    findUnique: async ({ where }) => related(state.devices.find(d => (where.activationHash && d.activationHash === where.activationHash) || (where.tokenHash && d.tokenHash === where.tokenHash))),
    findFirst: async ({ where }) => state.devices.find(d => d.id === where.id && d.companyId === where.companyId) ?? null,
    findMany: async ({ where, select }) => state.devices.filter(d => d.companyId === where.companyId && where.branchId.in.includes(d.branchId)).map(d => projected(d, select)),
    create: async ({ data, select }) => { state.writes++; const device = { id: BigInt(state.devices.length + 1), activatedAt: null, revokedAt: null, tokenHash: null, ...data }; state.devices.push(device); return projected(device, select); },
    updateMany: async ({ where, data }) => {
      const matches = state.devices.filter(d => d.id === where.id && (!where.companyId || d.companyId === where.companyId) && (where.activatedAt === undefined || d.activatedAt === where.activatedAt) && (where.revokedAt === undefined || d.revokedAt === where.revokedAt) && (!where.activationExpiresAt || d.activationExpiresAt > where.activationExpiresAt.gt) && (!where.expiresAt || d.expiresAt > where.expiresAt.gt));
      matches.forEach(d => Object.assign(d, data)); state.writes += matches.length; return { count: matches.length };
    },
  },
  kioskGrant: {
    findMany: async () => state.grants,
    upsert: async ({ create }) => { state.writes++; state.grants.push(create); return create; },
    deleteMany: async ({ where }) => { const before = state.grants.length; state.grants = state.grants.filter(g => !(g.companyId === where.companyId && g.userId === where.userId && g.branchId === where.branchId)); const count = before - state.grants.length; state.writes += count; return { count }; },
  },
  attendanceRecord: {
    findFirst: async () => null,
    findMany: async () => [],
    count: async () => 0,
    create: async ({ data }) => { state.writes++; const record = { id: 1n, ...data, recordedAt: new Date(), employee: { fullName: "Employee A", photo: null, documentNumber: null, position: null }, branch: { name: "Branch A" } }; state.records.push(record); return record; },
  },
  $transaction: async task => Array.isArray(task) ? Promise.all(task) : task(db),
  $queryRaw: async (...args) => { state.queries.push(args); return []; },
};
mock.module("next/headers", { namedExports: {
  cookies: () => ({ get: name => jar[name] ? { value: jar[name] } : undefined }),
  headers: () => ({ get: name => headers[name] ?? null }),
} });
mock.module("@/lib/prisma", { namedExports: { prisma: db } });
mock.module("@/lib/audit", { namedExports: { createAuditLog: async value => { state.audits.push(value); } } });
mock.module("@/lib/webhooks/dispatch", { namedExports: { scheduleWebhookEvent: () => {} } });
function account(id, role) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ userId: String(id), companyId: "10", role, email: "fixture@example.com", name: "Fixture", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 });
  jar["access-token"] = `${head}.${body}.${createHmac("sha256", process.env.JWT_SECRET).update(`${head}.${body}`).digest("base64url")}`;
  delete headers["x-kiosk-mode"];
}
function request(body, url = "http://localhost/api/test") {
  return { url, headers: { get: name => name === "host" ? "localhost" : null }, json: async () => body };
}
function queryValues(value) {
  if (typeof value === "bigint") return [value];
  if (Array.isArray(value)) return value.flatMap(queryValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(queryValues);
  return [];
}

test("management delegates no role expansion; rejected grants/create leave data and counters unchanged", async () => {
  const route = await import("@/app/api/kiosks/route");
  account(1, "COMPANY_ADMIN");
  const created = await route.POST(request({ action: "create", branchId: "20", name: "Fixture" }));
  assert.equal(created.status, 201);
  const payload = await created.json();
  assert.equal(payload.activationCode.length, 43);
  assert.notEqual(payload.activationCode, state.devices[0].activationHash);
  assert.ok(!("activationHash" in payload.device));
  const before = snapshot();
  account(7, "REPORT_VIEWER");
  assert.equal((await route.POST(request({ action: "create", branchId: "21", name: "Denied" }))).status, 403);
  assert.equal((await route.POST(request({ action: "grant", branchId: "20", userId: "8" }))).status, 403);
  assert.equal(snapshot(), before);
  account(1, "COMPANY_ADMIN");
  assert.equal((await route.POST(request({ action: "grant", branchId: "30", userId: "7" }))).status, 403);
  assert.equal((await route.POST(request({ action: "grant", branchId: "20", userId: "8" }))).status, 400);
  assert.equal(snapshot(), before);
  assert.equal((await route.POST(request({ action: "grant", branchId: "21", userId: "8" }))).status, 200);
  assert.equal((await route.POST(request({ action: "revoke-grant", branchId: "21", userId: "8" }))).status, 200);
  assert.equal(state.grants.length, 0);
});
test("delegate listing is branch-limited and device tokens never authenticate account management", async () => {
  const route = await import("@/app/api/kiosks/route"); account(7, "REPORT_VIEWER");
  const payload = await (await route.GET()).json();
  assert.deepEqual(payload.branches.map(b => b.id), ["20"]);
  assert.deepEqual(payload.users, []); assert.deepEqual(payload.grants, []);
  jar["access-token"] = "not-an-account-token";
  assert.equal((await route.GET()).status, 401);
});
let activeToken;
test("activation cookies are httpOnly, replay/revocation reject without writes", async () => {
  const management = await import("@/app/api/kiosks/route");
  const activation = await import("@/app/api/kiosk/activate/route");
  account(1, "COMPANY_ADMIN");
  const payload = await (await management.POST(request({ action: "create", branchId: "20", name: "Active fixture" }))).json();
  const response = await activation.POST(request({ code: payload.activationCode })); assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Strict/i);
  activeToken = cookie.match(/kiosk-device=([^;]+)/)[1];
  const before = snapshot();
  assert.equal((await activation.POST(request({ code: payload.activationCode }))).status, 401);
  assert.equal(snapshot(), before);
  const device = state.devices.at(-1);
  state.savedDeviceId = device.id;
});
test("kiosk attendance rejects cross-scope/manual writes and never inherits administrator geofence exemption", async () => {
  const route = await import("@/app/api/attendance/route");
  account(1, "COMPANY_ADMIN"); jar["kiosk-device"] = activeToken; headers["x-kiosk-mode"] = "1";
  const base = { employeeId: "5", branchId: "20", type: "CHECK_IN" };
  const before = snapshot();
  for (const [body, status] of [[{ ...base, branchId: "21" }, 403], [{ ...base, isManual: true }, 403], [{ ...base, employeeId: "9" }, 404], [{ ...base, employeeId: "6" }, 404], [{ ...base, deviceClass: "mobile" }, 422]]) {
    assert.equal((await route.POST(request(body))).status, status); assert.equal(snapshot(), before);
  }
  assert.equal((await route.POST(request({ ...base, deviceClass: "desktop" }))).status, 201);
  assert.equal(state.records.at(-1).branchId, 20n);
});
test("account attendance remains compatible and kiosk history rejects arbitrary branches", async () => {
  const route = await import("@/app/api/attendance/route"); account(1, "COMPANY_ADMIN");
  assert.equal((await route.GET(request(null, "http://localhost/api/attendance"))).status, 200);
  assert.equal((await route.POST(request({ employeeId: "5", branchId: "20", type: "CHECK_OUT", deviceClass: "mobile" }))).status, 422);
  headers["x-kiosk-mode"] = "1";
  assert.equal((await route.GET(request(null, "http://localhost/api/attendance"))).status, 400);
  assert.equal((await route.GET(request(null, "http://localhost/api/attendance?employeeId=5&branchId=21"))).status, 403);
});
test("facial search and descriptor handlers bind company and device branch", async () => {
  const search = await import("@/app/api/face/search/route");
  const descriptors = await import("@/app/api/face/descriptors/route");
  const vector = Array(512).fill(0.01);
  assert.equal((await search.POST(request({ descriptor: vector, branchId: "21" }))).status, 403);
  assert.equal((await search.POST(request({ descriptor: vector }))).status, 200);
  assert.ok(queryValues(state.queries.at(-1)).includes(10n)); assert.ok(queryValues(state.queries.at(-1)).includes(20n));
  assert.equal((await descriptors.GET()).status, 200);
  assert.ok(queryValues(state.queries.at(-1)).includes(10n)); assert.ok(queryValues(state.queries.at(-1)).includes(20n));
});
test("revocation immediately removes device API authorization", async () => {
  const management = await import("@/app/api/kiosks/route"); account(1, "COMPANY_ADMIN");
  assert.equal((await management.POST(request({ action: "revoke", deviceId: state.savedDeviceId.toString() }))).status, 200);
  headers["x-kiosk-mode"] = "1";
  const attendance = await import("@/app/api/attendance/route"); const before = snapshot();
  assert.equal((await attendance.GET(request(null, "http://localhost/api/attendance?employeeId=5"))).status, 401);
  assert.equal(snapshot(), before);
});
