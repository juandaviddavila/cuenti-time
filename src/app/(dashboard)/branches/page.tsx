import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession, getCompanyFilter } from "@/lib/server-auth";
import { BranchesClient } from "./branches-client";
import { serializeRecords, bigintToString } from "@/lib/bigint";

export default async function BranchesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const companyFilter = getCompanyFilter(session);

  const [branches, companies] = await Promise.all([
    prisma.branch.findMany({
      where: companyFilter,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    }),
    session.role === "SAAS_SUPER_ADMIN"
      ? prisma.company.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : session.companyId
         ? prisma.company.findMany({ where: { id: BigInt(session.companyId) }, select: { id: true, name: true } })
        : Promise.resolve<{ id: bigint; name: string }[]>([]),
  ]);

  return (
    <BranchesClient
      userRole={session.role}
      companyId={bigintToString(session.companyId) ?? ""}
      companies={serializeRecords(companies)}
      branches={serializeRecords(branches.map(b => ({
        id: b.id,
        companyId: b.companyId,
        companyName: b.company.name,
        name: b.name,
        code: b.code,
        address: b.address,
        city: b.city,
        phone: b.phone,
        status: b.status,
        employeeCount: b._count.employees,
        duplicateWindowMinutes: b.duplicateWindowMinutes,
        latitude: b.latitude,
        longitude: b.longitude,
        googlePlaceId: b.googlePlaceId,
        radiusMeters: b.radiusMeters,
        createdAt: b.createdAt.toISOString(),
      })))}
    />
  );
}
