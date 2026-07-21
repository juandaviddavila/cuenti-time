import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession, getCompanyFilter } from "@/lib/server-auth";
import { EmployeesClient } from "./employees-client";
import type { Position } from "@/types/position";
import { serializeRecords, bigintToString } from "@/lib/bigint";

export default async function EmployeesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const companyFilter = getCompanyFilter(session);

  const cookieStore = await cookies();
  const token = cookieStore.get("access-token")?.value;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  async function fetchActivePositions(): Promise<Position[]> {
    try {
      const res = await fetch(`${baseUrl}/api/positions?active=true`, {
        headers: token ? { Cookie: `access-token=${token}` } : undefined,
        cache: "no-store",
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: Position[] };
      return json.data ?? [];
    } catch (err) {
      console.error("Error fetching positions:", err);
      return [];
    }
  }

  const [employees, branches, positions] = await Promise.all([
    prisma.employee.findMany({
      where: companyFilter,
      include: {
        branch: { select: { name: true } },
        position: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({
      where: { ...companyFilter, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    fetchActivePositions(),
  ]);

  return (
    <EmployeesClient
      companyId={bigintToString(session.companyId) ?? ""}
      userRole={session.role}
      employees={serializeRecords(employees.map((e) => ({
        id: e.id,
        companyId: e.companyId,
        branchId: e.branchId,
        branchName: e.branch.name,
        fullName: e.fullName,
        documentType: e.documentType,
        documentNumber: e.documentNumber,
        positionId: e.positionId ?? undefined,
        positionName: e.position?.name ?? undefined,
        email: e.email ?? undefined,
        phone: e.phone ?? undefined,
        photo: e.photo ?? undefined,
        status: e.status,
        faceRegistered: e.faceRegistered,
        faceRegisteredAt: e.faceRegisteredAt?.toISOString() ?? undefined,
        hireDate: e.hireDate?.toISOString() ?? undefined,
        internalCode: e.internalCode ?? undefined,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })))}
      branches={serializeRecords(branches)}
      positions={positions}
    />
  );
}
