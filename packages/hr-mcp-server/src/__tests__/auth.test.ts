import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { authenticateMcpToken } from "../auth.js";
import { prisma } from "@/lib/prisma";
import { createTestToken, cleanupTestToken, type TestToken } from "./helpers.js";
import { stringToBigint } from "@/lib/bigint";

describe("authenticateMcpToken", () => {
  let testToken: TestToken;

  beforeAll(async () => {
    testToken = await createTestToken();
  });

  afterAll(async () => {
    await cleanupTestToken();
  });

  it("authenticates a valid read token", async () => {
    const ctx = await authenticateMcpToken(testToken.rawToken);
    expect(ctx.companyId).toBe(testToken.companyId);
    expect(ctx.scopes).toContain("read");
  });

  it("rejects token with wrong prefix", async () => {
    await expect(authenticateMcpToken("not_cuenti_xxx")).rejects.toThrow(/cuenti_/);
  });

  it("rejects invalid token", async () => {
    await expect(authenticateMcpToken("cuenti_invalidtoken123")).rejects.toThrow(/Invalid/);
  });

  it("rejects inactive token", async () => {
    const rawToken = `cuenti_${Buffer.from(crypto.randomUUID().replace(/-/g, "")).toString("hex").slice(0, 16)}`;
    const hashed = await bcrypt.hash(rawToken, 12);
    const inactive = await prisma.apiToken.create({
      data: {
        companyId: stringToBigint(testToken.companyId),
        name: "Inactive Test Token",
        token: hashed,
        tokenPrefix: rawToken.slice(0, 16),
        scopes: "read",
        active: false,
      },
    });

    await expect(authenticateMcpToken(rawToken)).rejects.toThrow(/Invalid/);

    await prisma.apiToken.delete({ where: { id: inactive.id } });
  });

  it("accepts write token because write implies read per /api/v1 behavior", async () => {
    const rawToken = `cuenti_${Buffer.from(crypto.randomUUID().replace(/-/g, "")).toString("hex").slice(0, 16)}`;
    const hashed = await bcrypt.hash(rawToken, 12);
    const writeOnly = await prisma.apiToken.create({
      data: {
        companyId: stringToBigint(testToken.companyId),
        name: "Write-Only Test Token",
        token: hashed,
        tokenPrefix: rawToken.slice(0, 16),
        scopes: "write",
        active: true,
      },
    });

    const ctx = await authenticateMcpToken(rawToken);
    expect(ctx.companyId).toBe(testToken.companyId);
    expect(ctx.scopes).toContain("write");

    await prisma.apiToken.delete({ where: { id: writeOnly.id } });
  });
});
