import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { ApiTokenContext } from "./auth.js";

export interface StoredAccessToken {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
  resource?: string;
  apiContext: ApiTokenContext;
  refreshToken?: string;
}

export interface StoredRefreshToken {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
  resource?: string;
  apiContext: ApiTokenContext;
}

interface PersistFile {
  version: 1;
  clients: Record<string, OAuthClientInformationFull>;
  accessTokens: Record<string, StoredAccessToken>;
  refreshTokens: Record<string, StoredRefreshToken>;
}

function defaultStorePath(): string {
  const fromEnv = process.env.MCP_OAUTH_STORE?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(process.cwd(), ".data", "mcp-oauth-store.json");
}

/**
 * Store OAuth (DCR clients + tokens) en disco.
 * Sin esto, cada reinicio del MCP invalida el client_id de ChatGPT → invalid_client.
 */
export class PersistentOAuthStore implements OAuthRegisteredClientsStore {
  readonly path: string;
  private clients = new Map<string, OAuthClientInformationFull>();
  private accessTokens = new Map<string, StoredAccessToken>();
  private refreshTokens = new Map<string, StoredRefreshToken>();

  constructor(path = defaultStorePath()) {
    this.path = path;
    this.load();
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at"> &
      Partial<Pick<OAuthClientInformationFull, "client_id" | "client_id_issued_at">>
  ): Promise<OAuthClientInformationFull> {
    const full = client as OAuthClientInformationFull;
    this.clients.set(full.client_id, full);
    this.save();
    return full;
  }

  async upsertClient(client: OAuthClientInformationFull): Promise<void> {
    this.clients.set(client.client_id, client);
    this.save();
  }

  getAccess(token: string): StoredAccessToken | undefined {
    return this.accessTokens.get(token);
  }

  setAccess(token: string, value: StoredAccessToken): void {
    this.accessTokens.set(token, value);
    this.save();
  }

  deleteAccess(token: string): void {
    if (this.accessTokens.delete(token)) this.save();
  }

  getRefresh(token: string): StoredRefreshToken | undefined {
    return this.refreshTokens.get(token);
  }

  setRefresh(token: string, value: StoredRefreshToken): void {
    this.refreshTokens.set(token, value);
    this.save();
  }

  deleteRefresh(token: string): void {
    if (this.refreshTokens.delete(token)) this.save();
  }

  deleteAccessByRefresh(refreshToken: string): void {
    let changed = false;
    for (const [key, value] of Array.from(this.accessTokens.entries())) {
      if (value.refreshToken === refreshToken) {
        this.accessTokens.delete(key);
        changed = true;
      }
    }
    if (changed) this.save();
  }

  private load(): void {
    try {
      if (!existsSync(this.path)) return;
      const raw = readFileSync(this.path, "utf8");
      const data = JSON.parse(raw) as PersistFile;
      if (data.version !== 1) return;
      this.clients = new Map(Object.entries(data.clients ?? {}));
      this.accessTokens = new Map(Object.entries(data.accessTokens ?? {}));
      this.refreshTokens = new Map(Object.entries(data.refreshTokens ?? {}));
      // Drop expired tokens on boot
      const now = Date.now();
      for (const [k, v] of Array.from(this.accessTokens.entries())) {
        if (v.expiresAt < now) this.accessTokens.delete(k);
      }
      for (const [k, v] of Array.from(this.refreshTokens.entries())) {
        if (v.expiresAt < now) this.refreshTokens.delete(k);
      }
    } catch (err) {
      console.error("[hr-mcp-oauth] failed to load store:", err);
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const data: PersistFile = {
        version: 1,
        clients: Object.fromEntries(this.clients),
        accessTokens: Object.fromEntries(this.accessTokens),
        refreshTokens: Object.fromEntries(this.refreshTokens),
      };
      writeFileSync(this.path, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("[hr-mcp-oauth] failed to save store:", err);
    }
  }
}
