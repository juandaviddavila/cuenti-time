import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { stringToBigint } from "@/lib/bigint";

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
  testCompanyId = company.id.toString();

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
  testTokenId = token.id.toString();

  return { rawToken, companyId: company.id.toString(), tokenId: token.id.toString() };
}

export async function cleanupTestToken(): Promise<void> {
  if (testTokenId) {
    await prisma.apiToken.deleteMany({ where: { id: stringToBigint(testTokenId) } });
    testTokenId = null;
  }
  if (testCompanyId) {
    await prisma.company.deleteMany({ where: { id: stringToBigint(testCompanyId) } });
    testCompanyId = null;
  }
}
