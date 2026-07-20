import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadTokenFromEnv, maskToken } from "../env.js";

describe("env token loader", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CUENTI_MCP_TOKEN;
    delete process.env.CUENTI_MCP_TOKEN_FILE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads token from CUENTI_MCP_TOKEN", () => {
    process.env.CUENTI_MCP_TOKEN = "cuenti_abc123def456";
    const result = loadTokenFromEnv();
    expect(result.rawToken).toBe("cuenti_abc123def456");
    expect(result.source).toBe("env");
  });

  it("throws when neither env var nor file is configured", () => {
    expect(() => loadTokenFromEnv()).toThrow(/CUENTI_MCP_TOKEN/);
  });

  it("masks tokens in logs", () => {
    expect(maskToken("cuenti_abc123def456")).toContain("...");
    expect(maskToken("short")).toBe("***");
  });
});
