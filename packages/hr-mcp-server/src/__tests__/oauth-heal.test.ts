import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryClientsStore } from "../oauth-provider.js";
import { ensurePublicOAuthClient } from "../oauth-heal.js";

describe("ensurePublicOAuthClient", () => {
  let store: InMemoryClientsStore;

  beforeEach(() => {
    store = new InMemoryClientsStore();
  });

  it("recreates missing ChatGPT client", async () => {
    const id = "c1f50fb8-fd49-4608-a2ae-c935cd85f137";
    const redirect = "https://chatgpt.com/connector/oauth/4ISY7xlGbHI5";
    const healed = await ensurePublicOAuthClient(store, id, redirect);
    expect(healed).toBe(true);
    const client = await store.getClient(id);
    expect(client?.redirect_uris).toContain(redirect);
    expect(client?.token_endpoint_auth_method).toBe("none");
  });

  it("rejects untrusted redirect", async () => {
    const healed = await ensurePublicOAuthClient(
      store,
      "evil",
      "https://evil.example/callback"
    );
    expect(healed).toBe(false);
    expect(await store.getClient("evil")).toBeUndefined();
  });
});
