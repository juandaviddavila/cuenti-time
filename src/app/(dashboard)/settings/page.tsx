import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession, getUserPermissionFields } from "@/lib/server-auth";
import { canManageIntegrations } from "@/lib/user-permissions";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await getUserPermissionFields(session.userId);
  const showIntegrations = permissions ? canManageIntegrations(permissions) : false;
  const canManageCompany =
    session.role === "SAAS_SUPER_ADMIN" || session.role === "COMPANY_ADMIN";

  const company = session.companyId
    ? await prisma.company.findUnique({
        where: { id: session.companyId },
        select: {
          id: true,
          name: true,
          legalName: true,
          taxId: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          subscriptionExpiresAt: true,
          maxEmployees: true,
          lateToleranceMinutes: true,
          earlyLeaveToleranceMinutes: true,
          lateReportTime: true,
          lateReportRecipients: true,
          faceMatchThreshold: true,
        },
      })
    : null;

  return (
    <SettingsClient
      showIntegrations={showIntegrations}
      canManageCompany={canManageCompany}
      userRole={session.role}
      company={
        company
          ? {
              ...company,
              subscriptionExpiresAt: company.subscriptionExpiresAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
