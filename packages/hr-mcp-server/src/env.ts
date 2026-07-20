import { readFileSync } from "node:fs";

export interface LoadedToken {
  rawToken: string;
  source: "env" | "file";
}

export function loadTokenFromEnv(): LoadedToken {
  const filePath = process.env.CUENTI_MCP_TOKEN_FILE;
  if (filePath) {
    try {
      const rawToken = readFileSync(filePath, "utf-8").trim();
      return { rawToken, source: "file" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`No se pudo leer CUENTI_MCP_TOKEN_FILE (${filePath}): ${message}`);
    }
  }

  const rawToken = process.env.CUENTI_MCP_TOKEN;
  if (!rawToken) {
    throw new Error(
      "Debe configurar CUENTI_MCP_TOKEN o CUENTI_MCP_TOKEN_FILE antes de iniciar el servidor MCP."
    );
  }

  return { rawToken, source: "env" };
}

export function maskToken(rawToken: string): string {
  if (rawToken.length <= 12) return "***";
  return `${rawToken.slice(0, 8)}...${rawToken.slice(-4)}`;
}
