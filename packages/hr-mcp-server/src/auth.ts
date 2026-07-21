import {
  validateApiTokenRaw,
  hasScope,
  type ApiTokenContext,
} from "@/lib/api-token-core";
import { unauthorized, forbidden } from "./errors.js";
import type { CuentiOAuthProvider } from "./oauth-provider.js";

export type { ApiTokenContext };
export { hasScope };

/** Auth clásica: Bearer cuenti_… (Claude Desktop / mcp-remote). */
export async function authenticateMcpToken(rawToken: string): Promise<ApiTokenContext> {
  if (!rawToken.startsWith("cuenti_")) {
    throw unauthorized("Token debe comenzar con cuenti_");
  }

  const context = await validateApiTokenRaw(rawToken);
  if (!context) {
    throw unauthorized("Invalid or expired token");
  }

  if (!hasScope(context, "read")) {
    throw forbidden("Forbidden: se requiere alcance read");
  }

  return context;
}

/**
 * Auth dual para /mcp:
 * 1) Bearer cuenti_… (API token directo)
 * 2) Bearer mcp_at_… (access token OAuth 2.1)
 */
export async function authenticateMcpBearer(
  rawToken: string,
  oauth?: CuentiOAuthProvider
): Promise<ApiTokenContext> {
  if (rawToken.startsWith("cuenti_")) {
    return authenticateMcpToken(rawToken);
  }

  if (oauth && (rawToken.startsWith("mcp_at_") || rawToken.length > 20)) {
    try {
      const ctx = await oauth.resolveApiContext(rawToken);
      if (!hasScope(ctx, "read")) {
        throw forbidden("Forbidden: se requiere alcance read");
      }
      return ctx;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) throw err;
      throw unauthorized(
        err instanceof Error ? err.message : "Invalid or expired OAuth token"
      );
    }
  }

  throw unauthorized(
    "Se requiere Authorization: Bearer cuenti_… o access token OAuth (mcp_at_…)"
  );
}
