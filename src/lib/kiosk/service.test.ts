import assert from "node:assert/strict";
import { test } from "node:test";
import { activateKiosk, readKioskDevice } from "./service";
import { hashKioskSecret } from "./policy";

test("activation claim is atomic, replay and expiry do not change state", async () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const code = "a".repeat(43);
  const device = { id: 1n, companyId: 10n, branchId: 20n, name: "Terminal", activationHash: hashKioskSecret(code), activationExpiresAt: new Date(now.getTime() + 1000), activatedAt: null as Date | null, revokedAt: null as Date | null, expiresAt: new Date(now.getTime() + 50000), tokenHash: null as string | null, company: { status: "ACTIVE" }, branch: { id: 20n, companyId: 10n, name: "Branch", status: "ACTIVE", duplicateWindowMinutes: 10 } };
  const db = { kioskDevice: {
    findUnique: async ({ where }: { where: { activationHash?: string; tokenHash?: string } }) => (where.activationHash === device.activationHash || (device.tokenHash && where.tokenHash === device.tokenHash)) ? device : null,
    updateMany: async ({ where, data }: { where: { activatedAt?: null; revokedAt?: null; activationExpiresAt?: { gt: Date } }; data: { activatedAt: Date; tokenHash: string } }) => {
      if (device.activatedAt || device.revokedAt || !where.activationExpiresAt || device.activationExpiresAt <= where.activationExpiresAt.gt) return { count: 0 };
      Object.assign(device, data); return { count: 1 };
    },
  } };
  const [first, second] = await Promise.all([activateKiosk(code, db, now), activateKiosk(code, db, now)]);
  assert.equal([first, second].filter(Boolean).length, 1);
  const accepted = first ?? second;
  assert.ok(accepted);
  assert.notEqual(device.tokenHash, accepted.token);
  assert.ok(await readKioskDevice(accepted.token, db, now));
  const snapshot = JSON.stringify(device, (_key, value) => typeof value === "bigint" ? String(value) : value);
  assert.equal(await activateKiosk(code, db, now), null);
  assert.equal(await activateKiosk("x".repeat(43), db, now), null);
  assert.equal(JSON.stringify(device, (_key, value) => typeof value === "bigint" ? String(value) : value), snapshot);
  device.revokedAt = now;
  assert.equal(await readKioskDevice(accepted.token, db, now), null);
  assert.equal(await readKioskDevice("invalid", db, now), null);
});
