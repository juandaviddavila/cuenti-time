import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_PROPOSALS,
  MAX_RANGE_DAYS,
  generateScheduleDraft,
} from "./generator";

const shift = { id: "5", name: "Turno mañana", companyId: "10", active: true };
const employees = [
  { id: "7", fullName: "Ana", status: "ACTIVE", branchId: "20" },
  { id: "8", fullName: "Bruno", status: "ACTIVE", branchId: "20" },
  { id: "9", fullName: "Carmen", status: "INACTIVE", branchId: "20" },
  { id: "10", fullName: "Dario", status: "ACTIVE", branchId: "21" },
];

function params(overrides: Record<string, unknown> = {}) {
  return {
    companyId: "10",
    branchId: "20",
    shiftId: "5",
    rangeStart: "2026-11-02",
    rangeEnd: "2026-11-15",
    employees,
    shift,
    existingAssignments: [] as Array<Record<string, unknown>>,
    ...overrides,
  };
}

test("generates one proposal per eligible employee, deterministically ordered", () => {
  const result = generateScheduleDraft(params());
  assert.ok(!("error" in result));
  assert.deepEqual(
    result.proposals.map((p) => p.employeeId),
    ["7", "8"]
  );
  const again = generateScheduleDraft(
    params({ employees: [...employees].reverse() })
  );
  assert.deepEqual(again.proposals, result.proposals);
  assert.equal(result.proposals[0].shiftId, "5");
  assert.equal(result.proposals[0].startDate, "2026-11-02");
  assert.equal(result.proposals[0].endDate, "2026-11-15");
  assert.equal(result.conflicts.length, 2);
  assert.deepEqual(
    result.conflicts.map((c) => [c.type, c.employeeId]).sort(),
    [
      ["employee_inactive", "9"],
      ["employee_other_branch", "10"],
    ].sort()
  );
});

test("flags overlaps against current assignments and accepts touching boundaries", () => {
  const overlapping = generateScheduleDraft(
    params({
      existingAssignments: [
        { employeeId: "7", shiftId: "3", shiftName: "Turno noche", startDate: "2026-10-20T00:00:00.000Z", endDate: "2026-11-05T00:00:00.000Z" },
        { employeeId: "8", shiftId: "4", shiftName: "Turno tarde", startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-11-01T23:59:59.999Z" },
      ],
    })
  );
  assert.ok(!("error" in overlapping));
  assert.deepEqual(overlapping.proposals.map((p) => p.employeeId), ["8"]);
  const conflict = overlapping.conflicts.find((c) => c.type === "overlap");
  assert.equal(conflict?.employeeId, "7");
  assert.equal(conflict?.existingShiftId, "3");

  const openEnded = generateScheduleDraft(
    params({
      existingAssignments: [
        { employeeId: "7", shiftId: "3", shiftName: "Permanente", startDate: "2026-01-01T00:00:00.000Z", endDate: null },
      ],
    })
  );
  assert.ok(!("error" in openEnded));
  assert.deepEqual(openEnded.proposals.map((p) => p.employeeId), ["8"]);
});

test("rejects invalid inputs without proposals: bad dates, long range, inactive shift, foreign shift", () => {
  assert.ok("error" in generateScheduleDraft(params({ rangeStart: "15/11/2026" })));
  assert.ok("error" in generateScheduleDraft(params({ rangeStart: "2026-11-10", rangeEnd: "2026-11-02" })));
  const tooLong = generateScheduleDraft(
    params({ rangeStart: "2026-11-01", rangeEnd: "2027-03-01" })
  );
  assert.ok("error" in tooLong);
  if ("error" in tooLong) assert.match(tooLong.error, new RegExp(String(MAX_RANGE_DAYS)));
  assert.ok("error" in generateScheduleDraft(params({ shift: { ...shift, active: false } })));
  assert.ok("error" in generateScheduleDraft(params({ shift: { ...shift, companyId: "99" } })));
  assert.ok("error" in generateScheduleDraft(params({ employees: [] })));
  const overflow = generateScheduleDraft(
    params({
      employees: Array.from({ length: MAX_PROPOSALS + 1 }, (_, i) => ({
        id: String(100 + i),
        fullName: `Empleado ${i}`,
        status: "ACTIVE",
        branchId: "20",
      })),
    })
  );
  assert.ok("error" in overflow);
  if ("error" in overflow) assert.match(overflow.error, /500/);
});
