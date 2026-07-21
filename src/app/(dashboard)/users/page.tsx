import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession, getCompanyFilter } from "@/lib/server-auth";
import { resolveEffectiveRole } from "@/lib/super-admin-access";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const companyFilter = getCompanyFilter(session);

  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      where: companyFilter,
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        branchId: true,
        bypassGeofence: true,
        canManageIntegrations: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({
      where: { ...companyFilter, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <UsersClient
      users={users.map((u) => ({
        id: u.id,
        companyId: u.companyId ?? undefined,
        name: u.name,
        email: u.email,
        role: resolveEffectiveRole(u.email, u.role),
        status: u.status,
        avatar: u.avatar ?? undefined,
        branchId: u.branchId ?? undefined,
        bypassGeofence: u.bypassGeofence,
        canManageIntegrations: u.canManageIntegrations,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? undefined,
        createdAt: u.createdAt.toISOString(),
      }))}
      branches={branches}
      currentUserRole={session.role}
      currentCompanyId={session.companyId ?? ""}
    />
  );
}
