import {
  validateApiTokenRaw,
  hasScope,
  type ApiTokenContext,
} from "@/lib/api-token-auth";
import { unauthorized, forbidden } from "./errors.js";

export type { ApiTokenContext };
export { hasScope };

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
