import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listToolDefinitions, getTool } from "../tools.js";
import { prisma } from "@/lib/prisma";
import { createTestToken, cleanupTestToken, type TestToken } from "./helpers.js";
import { stringToBigint } from "@/lib/bigint";

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolsFile = readFileSync(join(__dirname, "../tools.ts"), "utf-8");

describe("tool registry", () => {
  it("exposes exactly 14 tools", () => {
    const tools = listToolDefinitions();
    expect(tools).toHaveLength(14);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "find_employee",
      "get_absences",
      "get_attendance_records",
      "get_branch_summary",
      "get_company_info",
      "get_daily_snapshot",
      "get_early_leaves",
      "get_employee_summary",
      "get_incidents",
      "get_late_arrivals",
      "get_open_days",
      "get_present_now",
      "list_branches",
      "list_employees",
    ]);
  });

  it("does not contain Prisma mutation calls in tool handlers", () => {
    const mutationKeywords = [
      "prisma.employee.create",
      "prisma.employee.update",
      "prisma.employee.delete",
      "prisma.branch.create",
      "prisma.branch.update",
      "prisma.branch.delete",
      "prisma.company.create",
      "prisma.company.update",
      "prisma.company.delete",
      "prisma.incident.create",
      "prisma.incident.update",
      "prisma.incident.delete",
    ];
    for (const keyword of mutationKeywords) {
      expect(toolsFile).not.toContain(keyword);
    }
  });

  it("rejects unknown tool names", () => {
    expect(getTool("not_a_tool")).toBeUndefined();
  });
});

describe("entity tools", () => {
  let testToken: TestToken;

  beforeAll(async () => {
    testToken = await createTestToken();
  });

  afterAll(async () => {
    await cleanupTestToken();
  });

  it("get_company_info returns the token company", async () => {
    const tool = getTool("get_company_info");
    expect(tool).toBeDefined();
    const result = await tool!.execute({}, { token: { tokenId: testToken.tokenId, companyId: testToken.companyId, scopes: ["read"] }, companyId: stringToBigint(testToken.companyId) });
    expect(result.content).toHaveLength(1);
    const data = JSON.parse(result.content[0].text);
    expect(data.data.id).toBe(testToken.companyId);
  });

  it("list_employees returns only company employees", async () => {
    const tool = getTool("list_employees");
    const result = await tool!.execute({}, { token: { tokenId: testToken.tokenId, companyId: testToken.companyId, scopes: ["read"] }, companyId: stringToBigint(testToken.companyId) });
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(0);
    expect(data.data).toEqual([]);
  });
});

describe("attendance detail tools", () => {
  let testToken: TestToken;
  let branchId: string;
  let employeeId: string;

  beforeAll(async () => {
    testToken = await createTestToken();
    const branch = await prisma.branch.create({
      data: {
        companyId: stringToBigint(testToken.companyId),
        name: "MCP Main Branch",
        code: "MCP-MAIN",
      },
    });
    branchId = branch.id.toString();
    const employee = await prisma.employee.create({
      data: {
        companyId: stringToBigint(testToken.companyId),
        branchId: stringToBigint(branchId),
        fullName: "Ana Prueba MCP",
        documentNumber: `mcp-employee-${Date.now()}`,
        email: "ana.mcp@example.com",
        internalCode: "EMP-MCP-01",
      },
    });
    employeeId = employee.id.toString();
    await prisma.attendanceRecord.create({
      data: {
        companyId: stringToBigint(testToken.companyId),
        branchId: stringToBigint(branchId),
        employeeId: stringToBigint(employeeId),
        type: "CHECK_IN",
        recordedAt: new Date(2026, 6, 20, 8, 0, 0),
      },
    });
  });

  afterAll(async () => {
    await prisma.attendanceRecord.deleteMany({ where: { employeeId: stringToBigint(employeeId) } });
    await prisma.employee.deleteMany({ where: { id: stringToBigint(employeeId) } });
    await prisma.branch.deleteMany({ where: { id: stringToBigint(branchId) } });
    await cleanupTestToken();
  });

  it("find_employee resolves an employee by partial name", async () => {
    const tool = getTool("find_employee");
    const result = await tool!.execute(
      { query: "Ana Prueba" },
      {
        token: {
          tokenId: testToken.tokenId,
          companyId: testToken.companyId,
          scopes: ["read"],
        },
        companyId: stringToBigint(testToken.companyId),
      }
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.data[0].id).toBe(employeeId);
  });

  it("get_attendance_records returns raw tenant records", async () => {
    const tool = getTool("get_attendance_records");
    const result = await tool!.execute(
      {
        from: "2026-07-20",
        to: "2026-07-20",
        employeeId,
      },
      {
        token: {
          tokenId: testToken.tokenId,
          companyId: testToken.companyId,
          scopes: ["read"],
        },
        companyId: stringToBigint(testToken.companyId),
      }
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(1);
    expect(data.data[0].type).toBe("CHECK_IN");
    expect(data.data[0].employee.id).toBe(employeeId);
  });

  it("get_present_now returns employees whose last mark is CHECK_IN", async () => {
    const tool = getTool("get_present_now");
    const result = await tool!.execute(
      { date: "2026-07-20", branchId },
      {
        token: {
          tokenId: testToken.tokenId,
          companyId: testToken.companyId,
          scopes: ["read"],
        },
        companyId: stringToBigint(testToken.companyId),
      }
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(1);
    expect(data.data[0].employee.id).toBe(employeeId);
  });
});

describe("cross-tenant validation", () => {
  let testToken: TestToken;
  let otherCompanyId: string;
  let otherBranchId: string;

  beforeAll(async () => {
    testToken = await createTestToken();
    const otherCompany = await prisma.company.create({
      data: {
        name: "Other MCP Test Company",
        legalName: "Other MCP Test Company S.A.S.",
        taxId: `mcp-other-${Date.now()}`,
        email: "mcp-other@cuenti.co",
      },
    });
    otherCompanyId = otherCompany.id.toString();

    const otherBranch = await prisma.branch.create({
      data: {
        companyId: stringToBigint(otherCompanyId),
        name: "Other Branch",
        code: "OTH",
      },
    });
    otherBranchId = otherBranch.id.toString();
  });

  afterAll(async () => {
    await prisma.branch.deleteMany({ where: { companyId: stringToBigint(otherCompanyId) } });
    await prisma.company.deleteMany({ where: { id: stringToBigint(otherCompanyId) } });
    await cleanupTestToken();
  });

  it("get_late_arrivals rejects branchId from another company", async () => {
    const tool = getTool("get_late_arrivals");
    await expect(
      tool!.execute(
        { from: "2026-07-01", to: "2026-07-31", branchId: otherBranchId },
        { token: { tokenId: testToken.tokenId, companyId: testToken.companyId, scopes: ["read"] }, companyId: stringToBigint(testToken.companyId) }
      )
    ).rejects.toThrow(/Sucursal no encontrada/);
  });
});
