import assert from "node:assert/strict";
import { test } from "node:test";
import { filterNavEntries, NAV_ITEMS } from "./nav-items";
test("kiosk link does not expand users or integrations navigation permissions", () => {
  const viewer = filterNavEntries("REPORT_VIEWER", false);
  assert.ok(viewer.some(item => item.kind === "link" && item.href === "/kiosks"));
  assert.ok(!viewer.some(item => item.kind === "link" && item.href === "/users"));
  assert.ok(!viewer.some(item => item.kind === "link" && item.href === "/settings/integrations"));
  assert.deepEqual(NAV_ITEMS.find(item => item.href === "/users")?.roles, ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"]);
  assert.ok(filterNavEntries("COMPANY_ADMIN", true).some(item => item.kind === "link" && item.href === "/users"));
});
