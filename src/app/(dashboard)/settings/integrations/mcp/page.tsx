import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession, getUserPermissionFields } from "@/lib/server-auth";
import { canManageIntegrations } from "@/lib/user-permissions";
import { IntegrationsNav } from "../integrations-nav";
import { PageHeader } from "@/components/shared/page-header";
import { McpSetupClient } from "./mcp-setup-client";

function resolveMcpUrl(appUrl: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_MCP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Mismo origen que la app (proxy Next → hr-mcp-server). Ideal con túneles/Cloudflare.
  return `${appUrl.replace(/\/$/, "")}/mcp`;
}

export default async function IntegrationsMcpPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await getUserPermissionFields(session.userId);
  if (!permissions || !canManageIntegrations(permissions)) {
    redirect("/settings");
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:7578";
  const protocol =
    headersList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `${protocol}://${host}`;

  return (
    <div className="space-y-2">
      <PageHeader
        title="Integraciones"
        description="Tokens API, MCP de RRHH y webhooks para conectar sistemas externos."
      />
      <IntegrationsNav />
      <McpSetupClient mcpUrl={resolveMcpUrl(appUrl)} />
    </div>
  );
}
