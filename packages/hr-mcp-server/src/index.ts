#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadTokenFromEnv, maskToken } from "./env.js";
import { authenticateMcpToken } from "./auth.js";
import { createMcpServer } from "./server.js";

function log(message: string) {
  // stdio transport requiere stdout limpio; los logs van a stderr.
  console.error(`[hr-mcp-server] ${message}`);
}

async function main() {
  const { rawToken, source } = loadTokenFromEnv();
  log(`Token cargado desde ${source === "file" ? "archivo" : "variable de entorno"}: ${maskToken(rawToken)}`);

  const token = await authenticateMcpToken(rawToken);
  log(`Autenticado como empresa ${token.companyId} (token ${token.tokenId})`);

  const server = createMcpServer(token);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log("Servidor MCP listo (stdio).");
}

main().catch((err) => {
  console.error(`[hr-mcp-server] FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
