import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenPrefix,
  validateApiTokenRaw,
  hasScope,
  belongsToTokenCompany,
  type ApiTokenContext,
} from "@/lib/api-token-core";
import { prisma } from "@/lib/prisma";
import { isSubscriptionExpired } from "@/lib/subscription";
import { stringToBigint } from "@/lib/bigint";

export type { ApiTokenContext };
export { extractTokenPrefix, validateApiTokenRaw, hasScope, belongsToTokenCompany };

export async function validateApiToken(
  request: NextRequest
): Promise<ApiTokenContext | null> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const rawToken = auth.slice(7).trim();
  if (!rawToken.startsWith("cuenti_") || rawToken.length < 16) {
    return null;
  }

  return validateApiTokenRaw(rawToken);
}

async function companyHasPaidActivePlan(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: stringToBigint(companyId) },
    select: {
      plan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  });
  if (!company) return false;
  return (
    company.plan === "paid" &&
    company.subscriptionStatus === "active" &&
    !isSubscriptionExpired(company.subscriptionExpiresAt)
  );
}

/** Autentica Bearer y exige scope. 401/403 como NextResponse si falla. */
export async function requireApiToken(
  request: NextRequest,
  scope: "read" | "write" = "read"
): Promise<ApiTokenContext | NextResponse> {
  const token = await validateApiToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!token.companyId) {
    return NextResponse.json(
      { error: "Token sin empresa asociada" },
      { status: 403 }
    );
  }
  if (!(await companyHasPaidActivePlan(token.companyId))) {
    return NextResponse.json(
      {
        error: "API requiere plan de pago activo",
        code: "PAID_PLAN_REQUIRED",
      },
      { status: 402 }
    );
  }
  if (!hasScope(token, scope)) {
    return NextResponse.json(
      {
        error:
          scope === "write"
            ? "Forbidden: se requiere alcance write"
            : "Forbidden: se requiere alcance read",
      },
      { status: 403 }
    );
  }
  return token;
}

export function isApiTokenContext(
  value: ApiTokenContext | NextResponse
): value is ApiTokenContext {
  return !(value instanceof NextResponse);
}
