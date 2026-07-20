import { redirect } from "next/navigation";
import { getServerSession, getUserPermissionFields } from "@/lib/server-auth";
import { canManageIntegrations } from "@/lib/user-permissions";

export default async function IntegrationsIndexPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await getUserPermissionFields(session.userId);
  if (!permissions || !canManageIntegrations(permissions)) {
    redirect("/settings");
  }

  redirect("/settings/integrations/api-tokens");
}
