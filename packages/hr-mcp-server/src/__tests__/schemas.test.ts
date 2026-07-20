import { describe, it, expect } from "vitest";
import {
  hrReportToolSchema,
  listEmployeesSchema,
  getIncidentsSchema,
  validateDateRange,
} from "../schemas.js";

describe("schemas", () => {
  it("validates HR report input", () => {
    const input = {
      from: "2026-07-01",
      to: "2026-07-31",
      branchId: "cm123",
    };
    const parsed = hrReportToolSchema.parse(input);
    expect(parsed.from).toBe("2026-07-01");
    expect(parsed.to).toBe("2026-07-31");
    expect(parsed.branchId).toBe("cm123");
  });

  it("rejects malformed ISO dates", () => {
    expect(() => hrReportToolSchema.parse({ from: "07-01-2026", to: "2026-07-31" })).toThrow();
  });

  it("validates date range", () => {
    expect(() => validateDateRange("2026-07-10", "2026-07-01")).toThrow(/inválido/);
  });

  it("validates list employees defaults", () => {
    const parsed = listEmployeesSchema.parse({});
    expect(parsed.limit).toBe(100);
    expect(parsed.offset).toBe(0);
  });

  it("validates incidents optional dates", () => {
    const parsed = getIncidentsSchema.parse({ limit: 10 });
    expect(parsed.limit).toBe(10);
    expect(parsed.from).toBeUndefined();
  });
});
