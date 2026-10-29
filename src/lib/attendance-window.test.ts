import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchLastAttendanceRecord, decideAttendanceMarkType } from "./attendance-window";
test("ordinary attendance requests keep account behavior; kiosk opts into branch scope", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => { calls.push({ input: String(input), init }); return new Response(JSON.stringify({ data: [{ id: "9", type: "CHECK_IN", recordedAt: "2026-10-28T12:00:00Z" }] })); };
  try {
    assert.equal((await fetchLastAttendanceRecord("7"))?.id, "9");
    assert.equal(calls[0].input, "/api/attendance?employeeId=7&pageSize=1");
    assert.equal(calls[0].init, undefined);
    await fetchLastAttendanceRecord("7", { "x-kiosk-mode": "1" });
    assert.deepEqual(calls[1].init, { headers: { "x-kiosk-mode": "1" }, cache: "no-store" });
    assert.deepEqual(decideAttendanceMarkType(null, 10), { type: "CHECK_IN" });
  } finally { globalThis.fetch = original; }
});
