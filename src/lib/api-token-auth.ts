import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export interface ApiTokenContext {
  tokenId: string;
  /** Siempre la empresa dueña del token. Todas las queries v1 DEBEN filtrar por este id. */
  companyId: string;
  scopes: string[];
}

const TOKEN_PREFIX_LEN = 16; // "cuenti_" + 8 hex

export function extractTokenPrefix(rawToken: string): string {
  return rawToken.slice(0, TOKEN_PREFIX_LEN);
}

/**
 * Valida un token API sin depender de Next.js.
 * Framework-agnostic: úsese desde MCP, scripts o cualquier runtime Node.js.
 * Preserva el comportamiento de /api/v1 (backfill de prefijo, actualización de lastUsedAt).
 */
export async function validateApiTokenRaw(
  rawToken: string
): Promise<ApiTokenContext | null> {
  const prefix = extractTokenPrefix(rawToken);

  // Lookup por prefijo (tokens nuevos) + legacy sin prefijo (migración gradual).
  const tokens = await prisma.apiToken.findMany({
    where: {
      active: true,
      OR: [{ tokenPrefix: prefix }, { tokenPrefix: null }],
    },
    select: {
      id: true,
      companyId: true,
      scopes: true,
      token: true,
      tokenPrefix: true,
    },
  });

  for (const token of tokens) {
    // Defensa en profundidad: nunca aceptar tokens sin empresa.
    if (!token.companyId) continue;

    const match = await bcrypt.compare(rawToken, token.token);
    if (!match) continue;

    // Backfill de prefijo en tokens legacy.
    await prisma.apiToken.update({
      where: { id: token.id },
      data: {
        lastUsedAt: new Date(),
        ...(token.tokenPrefix ? {} : { tokenPrefix: prefix }),
      },
    });

    return {
      tokenId: token.id,
      companyId: token.companyId,
      scopes: token.scopes.split(",").map((s) => s.trim()).filter(Boolean),
    };
  }

  return null;
}

export async function validateApiToken(
  request: NextRequest
): Promise<ApiTokenContext | null> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const rawToken = auth.slice(7).trim();
  if (!rawToken.startsWith("cuenti_") || rawToken.length < TOKEN_PREFIX_LEN) {
    return null;
  }

  return validateApiTokenRaw(rawToken);
}

export function hasScope(token: ApiTokenContext, scope: "read" | "write"): boolean {
  if (scope === "read") {
    return token.scopes.includes("read") || token.scopes.includes("write");
  }
  return token.scopes.includes("write");
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

/**
 * Verifica que un recurso pertenece a la empresa del token.
 * Usar SIEMPRE antes de devolver datos por id.
 */
export function belongsToTokenCompany(
  resourceCompanyId: string | null | undefined,
  token: ApiTokenContext
): boolean {
  return Boolean(resourceCompanyId) && resourceCompanyId === token.companyId;
}
