import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-auth";
import { isSubscriptionExpired } from "@/lib/subscription";
import { isSuperAdmin } from "@/lib/super-admin";
import { SuperAdminClient } from "./super-admin-client";

export default async function SuperAdminPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  if (!isSuperAdmin(session)) {
    redirect("/dashboard");
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { branches: true, employees: true } },
    },
  });

  const faceCounts = await prisma.employee.groupBy({
    by: ["companyId"],
    where: { status: "ACTIVE", faceRegistered: true },
    _count: { _all: true },
  });

  const facesByCompany = new Map(
    faceCounts.map((row) => [row.companyId, row._count._all])
  );

  return (
    <SuperAdminClient
      companies={companies.map((c) => ({
        id: c.id,
        name: c.name,
        legalName: c.legalName,
        taxId: c.taxId,
        email: c.email,
        status: c.status,
        subscriptionExpiresAt: c.subscriptionExpiresAt?.toISOString() ?? null,
        maxEmployees: c.maxEmployees,
        branchCount: c._count.branches,
        employeeCount: c._count.employees,
        registeredFaces: facesByCompany.get(c.id) ?? 0,
        subscriptionExpired: isSubscriptionExpired(c.subscriptionExpiresAt),
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
