import { prisma } from "@/lib/prisma";
import { getCompanyFilter, type ServerSession } from "@/lib/server-auth";
import { stringToBigint, bigintToString } from "@/lib/bigint";

export interface ReportFilterOption {
  id: string;
  name?: string;
  fullName?: string;
  branchId?: string;
  positionId?: string;
}

export async function loadReportPageFilters(session: ServerSession): Promise<{
  forcedBranchId: string | null;
  branches: ReportFilterOption[];
  employees: ReportFilterOption[];
  shifts: ReportFilterOption[];
  positions: ReportFilterOption[];
}> {
  const companyFilter = getCompanyFilter(session);

  let forcedBranchId: string | null = null;
  if (session.role === "BRANCH_SUPERVISOR") {
    const user = await prisma.user.findUnique({
      where: { id: stringToBigint(session.userId) },
      select: { branchId: true },
    });
    forcedBranchId = user?.branchId ? bigintToString(user.branchId) : null;
  }

  const [branches, employees, shifts, positions] = await Promise.all([
    prisma.branch.findMany({
      where: {
        ...companyFilter,
        status: "ACTIVE",
        ...(forcedBranchId ? { id: stringToBigint(forcedBranchId) } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: {
        ...companyFilter,
        status: "ACTIVE",
        ...(forcedBranchId ? { branchId: stringToBigint(forcedBranchId) } : {}),
      },
      select: { id: true, fullName: true, branchId: true, positionId: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.shift.findMany({
      where: { ...companyFilter, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { ...companyFilter, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    forcedBranchId,
    branches: branches.map((b) => ({ id: bigintToString(b.id), name: b.name })),
    employees: employees.map((e) => ({
      id: bigintToString(e.id),
      fullName: e.fullName,
      branchId: bigintToString(e.branchId),
      positionId: e.positionId ? bigintToString(e.positionId) : undefined,
    })),
    shifts: shifts.map((s) => ({ id: bigintToString(s.id), name: s.name })),
    positions: positions.map((p) => ({ id: bigintToString(p.id), name: p.name })),
  };
}
