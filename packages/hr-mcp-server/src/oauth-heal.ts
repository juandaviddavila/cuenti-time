import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";

const CHATGPT_REDIRECT =
  /^https:\/\/chatgpt\.com\/connector\/oauth\/[A-Za-z0-9_-]+\/?$/;
const CLAUDE_REDIRECT =
  /^https:\/\/claude\.ai\/(api\/)?mcp\/auth_callback\/?$/i;

function isTrustedConnectorRedirect(redirectUri: string): boolean {
  try {
    const u = new URL(redirectUri);
    if (u.protocol !== "https:") return false;
    if (CHATGPT_REDIRECT.test(redirectUri)) return true;
    if (CLAUDE_REDIRECT.test(redirectUri)) return true;
    return false;
  } catch {
    return false;
  }
}

type MutableStore = OAuthRegisteredClientsStore & {
  registerClient: NonNullable<OAuthRegisteredClientsStore["registerClient"]>;
  /** Optional: replace client entry (PersistentOAuthStore / InMemory) */
  upsertClient?: (client: OAuthClientInformationFull) => Promise<void> | void;
};

/**
 * Recrea un cliente OAuth público (PKCE) si ChatGPT/Claude reutiliza un client_id
 * tras un reinicio del servidor (DCR en memoria/perdido).
 * @returns true si se creó o actualizó
 */
export async function ensurePublicOAuthClient(
  store: MutableStore,
  clientId: string,
  redirectUri: string
): Promise<boolean> {
  if (!clientId || !isTrustedConnectorRedirect(redirectUri)) return false;
  if (!store.registerClient) return false;

  const existing = await store.getClient(clientId);
  if (existing) {
    if (existing.redirect_uris.includes(redirectUri)) return false;
    const updated: OAuthClientInformationFull = {
      ...existing,
      redirect_uris: Array.from(new Set([...existing.redirect_uris, redirectUri])),
    };
    if (store.upsertClient) {
      await store.upsertClient(updated);
    } else {
      await store.registerClient(updated);
    }
    return true;
  }

  const client: OAuthClientInformationFull = {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_name: "ChatGPT",
  };
  await store.registerClient(client);
  return true;
}
