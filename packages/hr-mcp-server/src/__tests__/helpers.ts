import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

let testCompanyId: string | null = null;
let testTokenId: string | null = null;

export interface TestToken {
  rawToken: string;
  companyId: string;
  tokenId: string;
}

export async function createTestToken(): Promise<TestToken> {
  const company = await prisma.company.create({
    data: {
      name: "MCP Test Company",
      legalName: "MCP Test Company S.A.S.",
      taxId: `mcp-test-${Date.now()}`,
      email: "mcp-test@cuenti.co",
    },
  });
  testCompanyId = company.id;

  const rawToken = `cuenti_${Buffer.from(crypto.randomUUID().replace(/-/g, "")).toString("hex").slice(0, 16)}`;
  const hashed = await bcrypt.hash(rawToken, 12);

  const token = await prisma.apiToken.create({
    data: {
      companyId: company.id,
      name: "MCP Test Token",
      token: hashed,
      tokenPrefix: rawToken.slice(0, 16),
      scopes: "read",
      active: true,
    },
  });
  testTokenId = token.id;

  return { rawToken, companyId: company.id, tokenId: token.id };
}

export async function cleanupTestToken(): Promise<void> {
  if (testTokenId) {
    await prisma.apiToken.deleteMany({ where: { id: testTokenId } });
    testTokenId = null;
  }
  if (testCompanyId) {
    await prisma.company.deleteMany({ where: { id: testCompanyId } });
    testCompanyId = null;
  }
}
