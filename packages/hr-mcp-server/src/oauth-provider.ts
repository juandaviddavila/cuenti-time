import { randomBytes, randomUUID } from "node:crypto";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidRequestError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { authenticateMcpToken, type ApiTokenContext } from "./auth.js";
import { PersistentOAuthStore } from "./oauth-store.js";

/** Subconjunto de Express Response usado por OAuthServerProvider.authorize */
interface AuthorizeResponse {
  req?: { method?: string; body?: unknown };
  status: (code: number) => AuthorizeResponse;
  type: (t: string) => AuthorizeResponse;
  send: (body: string) => AuthorizeResponse;
  redirect: (code: number, url: string) => void;
}

interface PendingCode {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  apiContext: ApiTokenContext;
}

const ACCESS_TTL_MS = 60 * 60 * 1000; // 1h
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

/** Store en memoria — usado en tests con persist: false */
export class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private readonly clients = new Map<string, OAuthClientInformationFull>();
  private accessTokens = new Map<
    string,
    {
      token: string;
      clientId: string;
      scopes: string[];
      expiresAt: number;
      resource?: string;
      apiContext: ApiTokenContext;
      refreshToken?: string;
    }
  >();
  private refreshTokens = new Map<
    string,
    {
      token: string;
      clientId: string;
      scopes: string[];
      expiresAt: number;
      resource?: string;
      apiContext: ApiTokenContext;
    }
  >();

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at"> &
      Partial<Pick<OAuthClientInformationFull, "client_id" | "client_id_issued_at">>
  ): Promise<OAuthClientInformationFull> {
    const full = client as OAuthClientInformationFull;
    this.clients.set(full.client_id, full);
    return full;
  }

  getAccess(token: string) {
    return this.accessTokens.get(token);
  }
  setAccess(token: string, value: NonNullable<ReturnType<InMemoryClientsStore["getAccess"]>>) {
    this.accessTokens.set(token, value);
  }
  deleteAccess(token: string) {
    this.accessTokens.delete(token);
  }
  getRefresh(token: string) {
    return this.refreshTokens.get(token);
  }
  setRefresh(token: string, value: NonNullable<ReturnType<InMemoryClientsStore["getRefresh"]>>) {
    this.refreshTokens.set(token, value);
  }
  deleteRefresh(token: string) {
    this.refreshTokens.delete(token);
  }
  deleteAccessByRefresh(refreshToken: string) {
    for (const [key, value] of Array.from(this.accessTokens.entries())) {
      if (value.refreshToken === refreshToken) this.accessTokens.delete(key);
    }
  }
}

type TokenStore = PersistentOAuthStore | InMemoryClientsStore;

/**
 * Authorization Server OAuth 2.1 para MCP (ChatGPT/Claude connectors).
 * Consent: el usuario pega su token API `cuenti_…` (no sustituye Bearer directo).
 * Clientes DCR + tokens persisten en disco (MCP_OAUTH_STORE) para sobrevivir reinicios.
 */
export class CuentiOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: TokenStore;
  private readonly codes = new Map<string, PendingCode>();

  constructor(options?: { persist?: boolean; storePath?: string }) {
    const persist = options?.persist !== false;
    if (persist) {
      const store = new PersistentOAuthStore(options?.storePath);
      this.clientsStore = store;
      console.error(`[hr-mcp-oauth] persistent store: ${store.path}`);
    } else {
      this.clientsStore = new InMemoryClientsStore();
    }
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: AuthorizeResponse
  ): Promise<void> {
    if (!client.redirect_uris.some((uri) => uri === params.redirectUri)) {
      const ok = client.redirect_uris.some((registered) => {
        try {
          const a = new URL(params.redirectUri);
          const b = new URL(registered);
          const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
          if (loopback.has(a.hostname) && loopback.has(b.hostname)) {
            return (
              a.protocol === b.protocol &&
              a.hostname === b.hostname &&
              a.pathname === b.pathname &&
              a.search === b.search
            );
          }
          return params.redirectUri === registered;
        } catch {
          return false;
        }
      });
      if (!ok) throw new InvalidRequestError("Unregistered redirect_uri");
    }

    // ChatGPT a veces manda resource …/mc (typo); normalizar a …/mcp
    if (params.resource) {
      const href = params.resource.toString();
      if (href.endsWith("/mc") && !href.endsWith("/mcp")) {
        params.resource = new URL(`${href}p`);
      }
    }

    const req = res.req;
    const body = (req?.body ?? {}) as Record<string, unknown>;
    const apiToken =
      typeof body.api_token === "string" ? body.api_token.trim() : "";

    if (!apiToken) {
      res
        .status(200)
        .type("html")
        .send(renderConsentPage(client, params, req?.method === "POST" ? body : undefined));
      return;
    }

    let apiContext: ApiTokenContext;
    try {
      apiContext = await authenticateMcpToken(apiToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token inválido";
      res
        .status(200)
        .type("html")
        .send(renderConsentPage(client, params, { ...body, api_token: apiToken }, message));
      return;
    }

    const code = randomUUID();
    this.codes.set(code, { client, params, apiContext });

    const target = new URL(params.redirectUri);
    target.searchParams.set("code", code);
    if (params.state) target.searchParams.set("state", params.state);
    res.redirect(302, target.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const data = this.codes.get(authorizationCode);
    if (!data) throw new Error("Invalid authorization code");
    return data.params.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    const data = this.codes.get(authorizationCode);
    if (!data) throw new Error("Invalid authorization code");
    if (data.client.client_id !== client.client_id) {
      throw new Error("Authorization code was not issued to this client");
    }
    this.codes.delete(authorizationCode);
    return this.issueTokens(
      client.client_id,
      data.params.scopes ?? ["mcp:tools"],
      data.apiContext,
      data.params.resource
    );
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    const stored = this.clientsStore.getRefresh(refreshToken);
    if (!stored || stored.expiresAt < Date.now()) {
      this.clientsStore.deleteRefresh(refreshToken);
      throw new Error("Invalid or expired refresh token");
    }
    if (stored.clientId !== client.client_id) {
      throw new Error("Refresh token was not issued to this client");
    }
    this.clientsStore.deleteRefresh(refreshToken);
    this.clientsStore.deleteAccessByRefresh(refreshToken);
    const nextScopes = scopes && scopes.length > 0 ? scopes : stored.scopes;
    return this.issueTokens(
      client.client_id,
      nextScopes,
      stored.apiContext,
      stored.resource ? new URL(stored.resource) : undefined
    );
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const stored = this.clientsStore.getAccess(token);
    if (!stored || stored.expiresAt < Date.now()) {
      this.clientsStore.deleteAccess(token);
      throw new Error("Invalid or expired token");
    }
    return {
      token,
      clientId: stored.clientId,
      scopes: stored.scopes,
      expiresAt: Math.floor(stored.expiresAt / 1000),
      resource: stored.resource ? new URL(stored.resource) : undefined,
      extra: {
        companyId: stored.apiContext.companyId,
        apiTokenId: stored.apiContext.tokenId,
        apiScopes: stored.apiContext.scopes,
      },
    };
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    const token = request.token;
    this.clientsStore.deleteAccess(token);
    this.clientsStore.deleteRefresh(token);
  }

  async resolveApiContext(token: string): Promise<ApiTokenContext> {
    const info = await this.verifyAccessToken(token);
    const companyId = info.extra?.companyId;
    const apiTokenId = info.extra?.apiTokenId;
    const apiScopes = info.extra?.apiScopes;
    if (
      typeof companyId !== "string" ||
      typeof apiTokenId !== "string" ||
      !Array.isArray(apiScopes)
    ) {
      throw new Error("OAuth token sin contexto de empresa");
    }
    return {
      companyId,
      tokenId: apiTokenId,
      scopes: apiScopes.filter((s): s is string => typeof s === "string"),
    };
  }

  private issueTokens(
    clientId: string,
    scopes: string[],
    apiContext: ApiTokenContext,
    resource?: URL
  ): OAuthTokens {
    const accessToken = `mcp_at_${randomBytes(24).toString("hex")}`;
    const refreshToken = `mcp_rt_${randomBytes(24).toString("hex")}`;
    const accessExpires = Date.now() + ACCESS_TTL_MS;
    const refreshExpires = Date.now() + REFRESH_TTL_MS;
    const resourceHref = resource?.toString();

    this.clientsStore.setAccess(accessToken, {
      token: accessToken,
      clientId,
      scopes,
      expiresAt: accessExpires,
      resource: resourceHref,
      apiContext,
      refreshToken,
    });
    this.clientsStore.setRefresh(refreshToken, {
      token: refreshToken,
      clientId,
      scopes,
      expiresAt: refreshExpires,
      resource: resourceHref,
      apiContext,
    });

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: Math.floor(ACCESS_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }
}

function renderConsentPage(
  client: OAuthClientInformationFull,
  params: AuthorizationParams,
  prior?: Record<string, unknown>,
  error?: string
): string {
  const clientName = client.client_name || client.client_id;
  const scopes = (params.scopes ?? ["mcp:tools"]).join(" ");
  const hidden = [
    ["client_id", client.client_id],
    ["redirect_uri", params.redirectUri],
    ["response_type", "code"],
    ["code_challenge", params.codeChallenge],
    ["code_challenge_method", "S256"],
    ["scope", scopes],
  ] as const;

  const extras: string[] = [];
  if (params.state) extras.push(hiddenInput("state", params.state));
  if (params.resource) extras.push(hiddenInput("resource", params.resource.toString()));

  const errBlock = error
    ? `<p style="color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;font-size:14px;">${escapeHtml(error)}</p>`
    : "";

  const priorToken =
    typeof prior?.api_token === "string" ? String(prior.api_token) : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autorizar cuenti time MCP</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background:#0b0f14; color:#e8eef5; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { width:100%; max-width:420px; background:#121821; border:1px solid #243041; border-radius:16px; padding:28px; box-shadow:0 20px 50px rgba(0,0,0,.35); }
    h1 { font-size:1.25rem; margin:0 0 8px; }
    p { color:#9fb0c3; font-size:14px; line-height:1.5; }
    label { display:block; font-size:12px; font-weight:600; margin:16px 0 6px; color:#c9d5e3; }
    input[type=password], input[type=text] { width:100%; box-sizing:border-box; border-radius:10px; border:1px solid #334155; background:#0b0f14; color:#e8eef5; padding:12px 14px; font-size:14px; }
    button { margin-top:18px; width:100%; border:0; border-radius:10px; background:#e8eef5; color:#0b0f14; font-weight:700; padding:12px 14px; cursor:pointer; }
    .meta { font-size:12px; color:#7f91a5; margin-top:14px; }
    code { font-size:12px; background:#0b0f14; padding:2px 6px; border-radius:6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Conectar MCP de RRHH</h1>
    <p><strong>${escapeHtml(clientName)}</strong> pide acceso de solo lectura a los datos de tu empresa en <strong>cuenti time</strong>.</p>
    ${errBlock}
    <form method="POST" action="/authorize">
      ${hidden.map(([k, v]) => hiddenInput(k, v)).join("\n")}
      ${extras.join("\n")}
      <label for="api_token">Token API (cuenti_…)</label>
      <input id="api_token" name="api_token" type="password" autocomplete="off" required placeholder="cuenti_xxxxxxxx" value="${escapeHtml(priorToken)}" />
      <button type="submit">Autorizar</button>
    </form>
    <p class="meta">Crea el token en Integraciones → Tokens API (alcance <code>read</code>). OAuth es adicional al Bearer directo.</p>
  </div>
</body>
</html>`;
}

function hiddenInput(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
