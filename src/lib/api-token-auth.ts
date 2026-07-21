import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenPrefix,
  validateApiTokenRaw,
  hasScope,
  belongsToTokenCompany,
  type ApiTokenContext,
} from "@/lib/api-token-core";

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
