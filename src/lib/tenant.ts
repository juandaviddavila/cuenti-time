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
export function getCompanyFilter(session: TenantSession): { companyId?: string } {
  if (session.role === "SAAS_SUPER_ADMIN") return {};
  if (!session.companyId) return { companyId: "__none__" }; // no data returned
  return { companyId: session.companyId };
}
