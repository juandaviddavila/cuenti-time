import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server.js";
import { createTestToken, cleanupTestToken, type TestToken } from "./helpers.js";

describe("MCP server integration", () => {
  let testToken: TestToken;
  let client: Client | null = null;

  beforeAll(async () => {
    testToken = await createTestToken();
    const server = createMcpServer({
      tokenId: testToken.tokenId,
      companyId: testToken.companyId,
      scopes: ["read"],
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await cleanupTestToken();
  });

  it("lists exactly 14 tools", async () => {
    expect(client).not.toBeNull();
    const tools = await client!.listTools();
    expect(tools.tools).toHaveLength(14);
    const names = tools.tools.map((t) => t.name);
    expect(names).toContain("get_late_arrivals");
    expect(names).toContain("get_company_info");
    expect(names).toContain("list_employees");
    expect(names).toContain("get_attendance_records");
    expect(names).toContain("find_employee");
    expect(names).toContain("get_present_now");
  });

  it("calls get_company_info and returns company data", async () => {
    expect(client).not.toBeNull();
    const result = await client!.callTool({
      name: "get_company_info",
      arguments: {},
    });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const item = content[0];
    expect(item.type).toBe("text");
    const data = JSON.parse(item.text);
    expect(data.data.id).toBe(testToken.companyId);
  });

  it("returns error for unknown tool", async () => {
    expect(client).not.toBeNull();
    await expect(
      client!.callTool({
        name: "not_a_real_tool",
        arguments: {},
      })
    ).rejects.toThrow();
  });
});
