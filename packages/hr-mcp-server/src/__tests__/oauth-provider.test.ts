import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { CuentiOAuthProvider } from "../oauth-provider.js";

vi.mock("../auth.js", async () => {
  const actual = await vi.importActual<typeof import("../auth.js")>("../auth.js");
  return {
    ...actual,
    authenticateMcpToken: vi.fn(async (raw: string) => {
      if (raw === "cuenti_validtoken12") {
        return {
          tokenId: "tok_1",
          companyId: "co_1",
          scopes: ["read"],
        };
      }
      throw Object.assign(new Error("Invalid or expired token"), { code: -32001 });
    }),
  };
});

function mockRes(body: Record<string, unknown> = {}) {
  const redirects: string[] = [];
  const html: string[] = [];
  const res = {
    req: { method: "POST", body },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    type() {
      return this;
    },
    send(payload: string) {
      html.push(payload);
      return this;
    },
    redirect(code: number, url: string) {
      redirects.push(url);
      this.statusCode = code;
      return this;
    },
    statusCode: 200,
  };
  return { res, redirects, html };
}

describe("CuentiOAuthProvider", () => {
  let provider: CuentiOAuthProvider;
  const client: OAuthClientInformationFull = {
    client_id: "client-1",
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: ["https://chatgpt.com/connector/oauth/callback"],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_name: "ChatGPT",
  };

  beforeEach(async () => {
    provider = new CuentiOAuthProvider({ persist: false });
    await provider.clientsStore.registerClient(client);
  });

  it("shows consent HTML when api_token is missing", async () => {
    const { res, html, redirects } = mockRes({});
    await provider.authorize(
      client,
      {
        redirectUri: client.redirect_uris[0],
        codeChallenge: "challenge",
        scopes: ["mcp:tools"],
        state: "xyz",
      },
      res
    );
    expect(redirects).toHaveLength(0);
    expect(html[0]).toContain("Token API");
    expect(html[0]).toContain("client-1");
  });

  it("issues code and exchanges for mcp_at_ access token", async () => {
    const { res, redirects } = mockRes({ api_token: "cuenti_validtoken12" });
    await provider.authorize(
      client,
      {
        redirectUri: client.redirect_uris[0],
        codeChallenge: "challenge",
        scopes: ["mcp:tools"],
        state: "xyz",
      },
      res
    );
    expect(redirects[0]).toContain("code=");
    const code = new URL(redirects[0]).searchParams.get("code");
    expect(code).toBeTruthy();

    const tokens = await provider.exchangeAuthorizationCode(client, code!);
    expect(tokens.access_token.startsWith("mcp_at_")).toBe(true);
    expect(tokens.refresh_token?.startsWith("mcp_rt_")).toBe(true);

    const ctx = await provider.resolveApiContext(tokens.access_token);
    expect(ctx.companyId).toBe("co_1");
    expect(ctx.tokenId).toBe("tok_1");
  });
});
