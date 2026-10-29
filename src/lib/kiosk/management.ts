import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { canManageKioskBranch, isKioskAdministrator, type KioskOperator } from "./policy";

export class KioskAccessError extends Error { constructor(public status: number) { super(status === 401 ? "Unauthorized" : "Forbidden"); } }
export async function kioskOperator() {
  let session;
  try { session = await requireSession(); } catch { throw new KioskAccessError(401); }
  if (!session.companyId) throw new KioskAccessError(403);
  const user = await prisma.user.findFirst({ where: { id: BigInt(session.userId), companyId: BigInt(session.companyId), status: "ACTIVE", company: { status: "ACTIVE" } }, include: { kioskGrants: true } });
  if (!user) throw new KioskAccessError(403);
  const operator: KioskOperator = { id: user.id.toString(), companyId: session.companyId, role: session.role === "SAAS_SUPER_ADMIN" ? session.role : user.role, status: user.status, branchId: user.branchId?.toString() ?? null };
  return { session, operator, admin: isKioskAdministrator(operator), grants: user.kioskGrants.filter(g => g.companyId.toString() === session.companyId).map(g => g.branchId.toString()) };
}
export async function manageableBranch(context: Awaited<ReturnType<typeof kioskOperator>>, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: BigInt(branchId), companyId: BigInt(context.operator.companyId!), status: "ACTIVE" } });
  if (!branch || !canManageKioskBranch(context.operator, { id: branch.id.toString(), companyId: branch.companyId.toString(), status: branch.status }, context.grants)) throw new KioskAccessError(403);
  return branch;
}
