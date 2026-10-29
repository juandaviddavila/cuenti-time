import assert from "node:assert/strict";
import { test } from "node:test";
import { canApproveScheduleDraft, canManageSchedules } from "./policy";

const admin = { id: "1", companyId: "10", role: "COMPANY_ADMIN", status: "ACTIVE", branchId: null };

test("company admins and super admins manage schedules; other roles never do", () => {
  assert.equal(canManageSchedules(admin), true);
  assert.equal(canManageSchedules({ ...admin, role: "SAAS_SUPER_ADMIN" }), true);
  assert.equal(canManageSchedules({ ...admin, role: "BRANCH_SUPERVISOR", branchId: "20" }), true);
  for (const role of ["REPORT_VIEWER", "FACE_REGISTRAR", "DEVELOPER"] as const) {
    assert.equal(canManageSchedules({ ...admin, role }), false);
  }
  assert.equal(canManageSchedules({ ...admin, status: "INACTIVE" }), false);
  assert.equal(canManageSchedules({ ...admin, companyId: null }), false);
});

test("supervisors are restricted to their assigned branch for every draft operation", () => {
  const supervisor = { ...admin, role: "BRANCH_SUPERVISOR", branchId: "20" };
  assert.equal(canApproveScheduleDraft(supervisor, "20"), true);
  assert.equal(canApproveScheduleDraft(supervisor, "21"), false);
  assert.equal(canApproveScheduleDraft({ ...supervisor, branchId: null }, "20"), false);
  assert.equal(canApproveScheduleDraft(admin, "99"), true);
  assert.equal(canApproveScheduleDraft({ ...admin, role: "REPORT_VIEWER" }, "20"), false);
});
