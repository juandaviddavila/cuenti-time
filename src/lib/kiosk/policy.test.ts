import assert from "node:assert/strict";
import { test } from "node:test";
import { canManageKioskBranch, isKioskAdministrator, validKioskDevice, validActivation, hashKioskSecret } from "./policy";

const admin = { id: "1", companyId: "10", role: "COMPANY_ADMIN", status: "ACTIVE", branchId: null };
test("administrators manage their company branches; no tenant bypass", () => {
  assert.equal(isKioskAdministrator(admin), true);
  assert.equal(canManageKioskBranch(admin, { id: "20", companyId: "10", status: "ACTIVE" }, []), true);
  assert.equal(canManageKioskBranch(admin, { id: "20", companyId: "11", status: "ACTIVE" }, []), false);
  assert.equal(canManageKioskBranch({ ...admin, status: "INACTIVE" }, { id: "20", companyId: "10", status: "ACTIVE" }, []), false);
});
test("delegates require an explicit grant, supervisors stay at their branch", () => {
  const branch = { id: "20", companyId: "10", status: "ACTIVE" };
  const delegate = { ...admin, role: "REPORT_VIEWER" };
  assert.equal(isKioskAdministrator(delegate), false);
  assert.equal(canManageKioskBranch(delegate, branch, []), false);
  assert.equal(canManageKioskBranch(delegate, branch, ["20"]), true);
  assert.equal(canManageKioskBranch({ ...delegate, role: "BRANCH_SUPERVISOR", branchId: "21" }, branch, ["20"]), false);
  assert.equal(canManageKioskBranch({ ...delegate, role: "BRANCH_SUPERVISOR", branchId: "20" }, branch, ["20"]), true);
});
test("revoked, expired, unactivated or inactive devices fail closed", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const device = { activatedAt: new Date("2026-10-28T10:00:00Z"), revokedAt: null, expiresAt: new Date("2026-11-28T00:00:00Z"), companyStatus: "ACTIVE", branchStatus: "ACTIVE" };
  assert.equal(validKioskDevice(device, now), true);
  assert.equal(validKioskDevice({ ...device, revokedAt: now }, now), false);
  assert.equal(validKioskDevice({ ...device, expiresAt: now }, now), false);
  assert.equal(validKioskDevice({ ...device, activatedAt: null }, now), false);
  assert.equal(validKioskDevice({ ...device, companyStatus: "INACTIVE" }, now), false);
  assert.equal(validKioskDevice({ ...device, branchStatus: "INACTIVE" }, now), false);
});
test("activation is single-use and time-limited; only hashes are stored", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const invitation = { activatedAt: null, revokedAt: null, activationExpiresAt: new Date("2026-10-28T12:15:00Z") };
  assert.equal(validActivation(invitation, now), true);
  assert.equal(validActivation({ ...invitation, activatedAt: now }, now), false);
  assert.equal(validActivation({ ...invitation, revokedAt: now }, now), false);
  assert.equal(validActivation({ ...invitation, activationExpiresAt: now }, now), false);
  assert.equal(hashKioskSecret("fixture-a"), hashKioskSecret("fixture-a"));
  assert.notEqual(hashKioskSecret("fixture-a"), hashKioskSecret("fixture-b"));
  assert.notEqual(hashKioskSecret("fixture-a"), "fixture-a");
});
