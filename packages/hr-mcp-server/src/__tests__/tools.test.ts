import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listToolDefinitions, getTool } from "../tools.js";
import { prisma } from "@/lib/prisma";
import { createTestToken, cleanupTestToken, type TestToken } from "./helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolsFile = readFileSync(join(__dirname, "../tools.ts"), "utf-8");

describe("tool registry", () => {
  it("exposes exactly 11 tools", () => {
    const tools = listToolDefinitions();
    expect(tools).toHaveLength(11);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "get_absences",
      "get_branch_summary",
      "get_company_info",
      "get_daily_snapshot",
      "get_early_leaves",
      "get_employee_summary",
      "get_incidents",
      "get_late_arrivals",
      "get_open_days",
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
    const result = await tool!.execute({}, { token: { tokenId: testToken.tokenId, companyId: testToken.companyId, scopes: ["read"] }, companyId: testToken.companyId });
    expect(result.content).toHaveLength(1);
    const data = JSON.parse(result.content[0].text);
    expect(data.data.id).toBe(testToken.companyId);
  });

  it("list_employees returns only company employees", async () => {
    const tool = getTool("list_employees");
    const result = await tool!.execute({}, { token: { tokenId: testToken.tokenId, companyId: testToken.companyId, scopes: ["read"] }, companyId: testToken.companyId });
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(0);
    expect(data.data).toEqual([]);
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
    otherCompanyId = otherCompany.id;

    const otherBranch = await prisma.branch.create({
      data: {
        companyId: otherCompanyId,
        name: "Other Branch",
        code: "OTH",
      },
    });
    otherBranchId = otherBranch.id;
  });

  afterAll(async () => {
    await prisma.branch.deleteMany({ where: { companyId: otherCompanyId } });
    await prisma.company.deleteMany({ where: { id: otherCompanyId } });
    await cleanupTestToken();
  });

  it("get_late_arrivals rejects branchId from another company", async () => {
    const tool = getTool("get_late_arrivals");
    await expect(
      tool!.execute(
        { from: "2026-07-01", to: "2026-07-31", branchId: otherBranchId },
        { token: { tokenId: testToken.tokenId, companyId: testToken.companyId, scopes: ["read"] }, companyId: testToken.companyId }
      )
    ).rejects.toThrow(/Sucursal no encontrada/);
  });
});
