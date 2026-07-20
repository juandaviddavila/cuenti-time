import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession, getCompanyFilter } from "@/lib/server-auth";
import { AuditClient } from "./audit-client";

interface FilterOption {
  id: string;
  name: string;
}

export default async function AuditPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const companyFilter = getCompanyFilter(session);
  const isSuperAdmin = session.role === "SAAS_SUPER_ADMIN";

  const [branches, employees, companies] = await Promise.all([
    prisma.branch.findMany({
      where: { ...companyFilter, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { ...companyFilter, status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    isSuperAdmin
      ? prisma.company.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve<FilterOption[]>([]),
  ]);

  return (
    <AuditClient
      userRole={session.role}
      branches={branches}
      employees={employees.map((e) => ({ id: e.id, name: e.fullName }))}
      companies={companies}
    />
  );
}
