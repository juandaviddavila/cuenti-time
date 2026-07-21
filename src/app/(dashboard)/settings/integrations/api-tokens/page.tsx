import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession, getUserPermissionFields } from "@/lib/server-auth";
import { canManageIntegrations } from "@/lib/user-permissions";
import { getInternalAppOrigin } from "@/lib/internal-origin";
import ApiTokensClient, { type ApiToken } from "../../api-tokens/api-tokens-client";
import { IntegrationsNav } from "../integrations-nav";
import { PageHeader } from "@/components/shared/page-header";

export default async function IntegrationsApiTokensPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await getUserPermissionFields(session.userId);
  if (!permissions || !canManageIntegrations(permissions)) {
    redirect("/settings");
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  let tokens: ApiToken[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${getInternalAppOrigin()}/api/api-tokens`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      error = json.error ?? `Error ${res.status}`;
    } else {
      const json = (await res.json()) as { data: ApiToken[] };
      tokens = json.data;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Error de red";
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Integraciones"
        description="Tokens API, MCP de RRHH y webhooks para conectar sistemas externos."
      />
      <IntegrationsNav />
      {error ? (
        <div className="p-6 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-center">
          <p className="font-medium">Error cargando tokens de API</p>
          <p className="text-sm mt-1 opacity-90">{error}</p>
        </div>
      ) : (
        <ApiTokensClient initialTokens={tokens} embedded />
      )}
    </div>
  );
}
