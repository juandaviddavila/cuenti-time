import type { UserRole } from "@/types/user";

export interface TenantSession {
  userId: string;
  companyId: string | null;
  role: UserRole;
}

/**
 * Returns the companyId filter for Prisma queries based on role.
 * SAAS_SUPER_ADMIN sees all; everyone else is scoped to their single company.
 *
 * Business rule: one user account belongs to exactly one company.
 */
export function getCompanyFilter(session: TenantSession): { companyId?: bigint } {
  if (session.role === "SAAS_SUPER_ADMIN") return {};
  if (!session.companyId) return { companyId: -1n }; // no data returned
  return { companyId: BigInt(session.companyId) };
}
