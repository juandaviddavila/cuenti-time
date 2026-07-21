import type { ApiTokenContext } from "@/lib/api-token-core";

export interface ToolContext {
  token: ApiTokenContext;
  companyId: string;
}

export interface ToolHandler {
  name: string;
  description: string;
  inputSchema: object;
  execute: (args: unknown, ctx: ToolContext) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  }>;
}
