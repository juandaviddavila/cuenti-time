import assert from "node:assert/strict";
import { test } from "node:test";
import { isKioskDataRoute } from "./routes";
test("device dispatch allows only kiosk data methods, never administration or prefix lookalikes", () => {
  for (const path of ["/api/branches", "/api/attendance", "/api/face/descriptors"]) assert.equal(isKioskDataRoute(path, "GET"), true);
  for (const path of ["/api/attendance", "/api/face/search", "/api/face/embed"]) assert.equal(isKioskDataRoute(path, "POST"), true);
  for (const path of ["/dashboard", "/api/users", "/api/kiosks", "/api/branches/1", "/api/face/descriptors/extra", "/api/attendance.hack"]) for (const method of ["GET", "POST", "DELETE", "PUT"]) assert.equal(isKioskDataRoute(path, method), false);
  assert.equal(isKioskDataRoute("/api/branches", "POST"), false);
  assert.equal(isKioskDataRoute("/api/attendance", "DELETE"), false);
});
