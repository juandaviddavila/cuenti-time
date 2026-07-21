#!/usr/bin/env node
/**
 * MCP remoto cuenti time (RRHH) — Streamable HTTP + OAuth 2.1 (adicional).
 *
 * Auth por petición (cualquiera de las dos):
 *   Authorization: Bearer cuenti_…          ← API token directo (Claude / Cursor)
 *   Authorization: Bearer mcp_at_…          ← access token OAuth (ChatGPT connectors)
 *
 * OAuth 2.1 (PKCE S256 + DCR):
 *   GET  /.well-known/oauth-authorization-server
 *   GET  /.well-known/oauth-protected-resource
 *   POST /register
 *   GET|POST /authorize   ← consent: pegar token API
 *   POST /token
 *   POST /revoke
 *
 * Env del proceso:
 *   DATABASE_URL=…
 *   MCP_PUBLIC_URL=https://mcp-time.cuenti.co   (issuer; sin /mcp)
 *   MCP_HTTP_PORT=4101
 *   MCP_ALLOWED_HOSTS=…
 *   MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true  (solo http localhost)
 */
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { authenticateMcpBearer } from "./auth.js";
import { createMcpServer } from "./server.js";
import { maskToken } from "./env.js";
import { CuentiOAuthProvider } from "./oauth-provider.js";
import { ensurePublicOAuthClient } from "./oauth-heal.js";

const PORT = Number(process.env.MCP_HTTP_PORT || process.env.PORT || 4101);
const HOST = process.env.MCP_HTTP_HOST?.trim() || "0.0.0.0";
const allowedHosts = (process.env.MCP_ALLOWED_HOSTS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function resolvePublicUrl(): URL {
  const fromEnv =
    process.env.MCP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_MCP_URL?.replace(/\/mcp\/?$/, "").trim();
  if (fromEnv) return new URL(fromEnv.endsWith("/") ? fromEnv.slice(0, -1) : fromEnv);
  return new URL(`http://localhost:${PORT}`);
}

const publicUrl = resolvePublicUrl();
if (publicUrl.protocol === "http:") {
  process.env.MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL ??= "true";
}

const mcpResourceUrl = new URL("/mcp", publicUrl);
const oauthProvider = new CuentiOAuthProvider();
const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(mcpResourceUrl);

interface MiddlewareRequest {
  method: string;
  path: string;
  query: Record<string, unknown>;
  body?: unknown;
}

interface MiddlewareResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { end: () => void };
}

type MiddlewareNext = () => void;

const app = createMcpExpressApp({
  host: HOST,
  ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
});

// Cloudflare / reverse proxies set X-Forwarded-For; required by express-rate-limit in OAuth handlers.
app.set("trust proxy", 1);

app.use((
  _req: MiddlewareRequest,
  res: MiddlewareResponse,
  next: MiddlewareNext
) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, Mcp-Session-Id, Last-Event-ID"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

/**
 * ChatGPT guarda el client_id del DCR y no vuelve a registrar tras reinicios.
 * Si llega /authorize con un client_id desconocido + redirect de ChatGPT,
 * recreamos el cliente público (PKCE) para evitar invalid_client.
 */
app.use((
  req: MiddlewareRequest,
  _res: MiddlewareResponse,
  next: MiddlewareNext
) => {
  void (async () => {
    if (req.path !== "/authorize") {
      next();
      return;
    }
    const q = req.query as Record<string, unknown>;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const clientId = String(q.client_id ?? b.client_id ?? "").trim();
    const redirectUri = String(q.redirect_uri ?? b.redirect_uri ?? "").trim();
    if (!clientId || !redirectUri) {
      next();
      return;
    }
    try {
      const healed = await ensurePublicOAuthClient(
        oauthProvider.clientsStore,
        clientId,
        redirectUri
      );
      if (healed) {
        console.error(
          `[hr-mcp-oauth] healed missing client_id=${clientId} redirect=${redirectUri}`
        );
      }
    } catch (err) {
      console.error("[hr-mcp-oauth] heal failed:", err);
    }
    next();
  })();
});

const docsBase = process.env.NEXT_PUBLIC_APP_URL?.trim();

const rateLimitBehindProxy = {
  validate: { xForwardedForHeader: false },
} as const;

app.use(
  mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: publicUrl,
    baseUrl: publicUrl,
    resourceServerUrl: mcpResourceUrl,
    scopesSupported: ["mcp:tools", "read"],
    resourceName: "cuenti time HR MCP",
    ...(docsBase
      ? { serviceDocumentationUrl: new URL("/settings/integrations/mcp", docsBase) }
      : {}),
    authorizationOptions: { rateLimit: rateLimitBehindProxy },
    tokenOptions: { rateLimit: rateLimitBehindProxy },
    clientRegistrationOptions: { rateLimit: rateLimitBehindProxy },
    revocationOptions: { rateLimit: rateLimitBehindProxy },
  })
);

app.get("/health", (_req: unknown, res: { json: (body: unknown) => void }) => {
  res.json({
    ok: true,
    service: "cuenti-hr-mcp",
    transport: "streamable-http",
    auth: ["bearer-api-token", "oauth2.1"],
  });
});

function sanitizeWwwAuthenticateDetail(message: string): string {
  return message.replace(/[^\x20-\x7E]/g, " ").replace(/"/g, "'").slice(0, 180);
}

function jsonRpcError(
  res: {
    headersSent: boolean;
    setHeader: (k: string, v: string) => void;
    status: (n: number) => { json: (body: unknown) => void };
  },
  status: number,
  message: string,
  id: unknown = null
): void {
  if (res.headersSent) return;
  if (status === 401) {
    res.setHeader(
      "WWW-Authenticate",
      `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${resourceMetadataUrl}", error="invalid_token", error_description="${sanitizeWwwAuthenticateDetail(message)}"`
    );
  }
  res.status(status).json({
    jsonrpc: "2.0",
    error: { code: status === 401 ? -32001 : -32000, message },
    id,
  });
}

function extractBearerToken(headers: Record<string, unknown>): string {
  const raw = headers.authorization ?? headers.Authorization;
  const value = (Array.isArray(raw) ? raw[0] : raw)?.toString() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  if (!match?.[1]) {
    throw new Error("Se requiere Authorization: Bearer cuenti_… o mcp_at_…");
  }
  return match[1].trim();
}

const MCP_ACCEPT = "application/json, text/event-stream";

function ensureMcpAcceptHeader(req: {
  headers: Record<string, unknown>;
  rawHeaders?: string[];
}): void {
  const raw = req.headers.accept;
  const current =
    (Array.isArray(raw) ? raw[0] : raw)?.toString().toLowerCase() ?? "";
  const hasJson = current.includes("application/json") || current.includes("*/*");
  const hasSse = current.includes("text/event-stream");
  if (hasJson && hasSse) return;

  req.headers.accept = MCP_ACCEPT;

  const rh = req.rawHeaders;
  if (!Array.isArray(rh)) return;
  let found = false;
  for (let i = 0; i < rh.length; i += 2) {
    if (rh[i]?.toLowerCase() === "accept") {
      rh[i + 1] = MCP_ACCEPT;
      found = true;
    }
  }
  if (!found) {
    rh.push("Accept", MCP_ACCEPT);
  }
}

app.post("/mcp", (req: any, res: any) => {
  void (async () => {
    ensureMcpAcceptHeader(req);

    let token;
    try {
      const rawToken = extractBearerToken(req.headers);
      token = await authenticateMcpBearer(rawToken, oauthProvider);
      console.error(
        `[hr-mcp-http] auth ok company=${token.companyId} via=${rawToken.startsWith("cuenti_") ? "api-token" : "oauth"} token=${maskToken(rawToken)}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "No autorizado";
      jsonRpcError(
        res,
        401,
        message,
        (req.body as { id?: unknown } | undefined)?.id ?? null
      );
      return;
    }

    const method =
      req.body && typeof req.body === "object" && "method" in req.body
        ? String((req.body as { method?: unknown }).method)
        : "(unknown)";
    console.error(`[hr-mcp-http] POST /mcp method=${method}`);

    const server = createMcpServer(token);
    try {
      const enableJsonResponse =
        (process.env.MCP_JSON_RESPONSE || "true").toLowerCase() !== "false";
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error("[hr-mcp-http] Error handling MCP request:", error);
      jsonRpcError(
        res,
        500,
        "Internal server error",
        (req.body as { id?: unknown } | undefined)?.id ?? null
      );
      void server.close();
    }
  })();
});

app.get("/mcp", (req: any, res: any) => {
  void (async () => {
    try {
      const raw = req.headers.accept?.toString().toLowerCase() ?? "";
      if (!raw.includes("text/event-stream")) {
        ensureMcpAcceptHeader(req);
      }
      const rawToken = extractBearerToken(req.headers);
      const token = await authenticateMcpBearer(rawToken, oauthProvider);
      const server = createMcpServer(token);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: false,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No autorizado";
      const status = /Authorization|Bearer|token|autorizado|OAuth|Invalid/i.test(
        message
      )
        ? 401
        : 500;
      jsonRpcError(res, status, message);
    }
  })();
});

app.delete("/mcp", (_req: any, res: any) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed (stateless MCP)." },
    id: null,
  });
});

app.listen(PORT, HOST, () => {
  console.error(
    `[hr-mcp-http] ${publicUrl.origin} · /mcp + OAuth2.1 (DCR/PKCE) · auth: Bearer cuenti_|mcp_at_`
  );
});
