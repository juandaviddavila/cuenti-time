import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession, getUserPermissionFields } from "@/lib/server-auth";
import { canManageIntegrations } from "@/lib/user-permissions";
import { IntegrationsNav } from "../integrations-nav";
import { PageHeader } from "@/components/shared/page-header";
import { WebhooksClient, type WebhookRow, type WebhookEventMeta } from "./webhooks-client";

export default async function IntegrationsWebhooksPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await getUserPermissionFields(session.userId);
  if (!permissions || !canManageIntegrations(permissions)) {
    redirect("/settings");
  }

  const cookieStore = await cookies();
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:7578";
  const protocol =
    headersList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  let webhooks: WebhookRow[] = [];
  let availableEvents: string[] = [];
  let eventCatalog: WebhookEventMeta[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${protocol}://${host}/api/webhooks`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      error = json.error ?? `Error ${res.status}`;
    } else {
      const json = (await res.json()) as {
        data: WebhookRow[];
        availableEvents: string[];
        eventCatalog?: WebhookEventMeta[];
      };
      webhooks = json.data;
      availableEvents = json.availableEvents;
      eventCatalog = json.eventCatalog ?? [];
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Error de red";
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Integraciones"
        description="Configura tokens de API y webhooks para conectar sistemas externos."
      />
      <IntegrationsNav />
      {error ? (
        <div className="p-6 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-center">
          <p className="font-medium">Error cargando webhooks</p>
          <p className="text-sm mt-1 opacity-90">{error}</p>
        </div>
      ) : (
        <WebhooksClient
          initialWebhooks={webhooks}
          availableEvents={availableEvents}
          eventCatalog={eventCatalog}
        />
      )}
    </div>
  );
}
