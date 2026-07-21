import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { listToolDefinitions, getTool } from "./tools.js";
import { McpError as CuentiMcpError } from "./errors.js";
import type { ToolContext } from "./types.js";
import type { ApiTokenContext } from "@/lib/api-token-core";

export function createMcpServer(token: ApiTokenContext): Server {
  const context: ToolContext = {
    token,
    companyId: token.companyId,
  };

  const server = new Server(
    {
      name: "cuenti-hr-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: listToolDefinitions() };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = getTool(request.params.name);
    if (!tool) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Herramienta no encontrada: ${request.params.name}`
      );
    }

    try {
      const result = await tool.execute(request.params.arguments ?? {}, context);
      return result;
    } catch (err) {
      if (err instanceof CuentiMcpError) {
        throw new McpError(err.code as ErrorCode, err.message, err.data);
      }
      if (err instanceof McpError) {
        throw err;
      }
      throw new McpError(
        ErrorCode.InternalError,
        err instanceof Error ? err.message : "Error interno del servidor"
      );
    }
  });

  return server;
}
