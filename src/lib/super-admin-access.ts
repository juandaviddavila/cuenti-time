import type { UserRole } from "@/types/user";

const SUPER_ADMIN_ROLE: UserRole = "SAAS_SUPER_ADMIN";
const FALLBACK_ROLE: UserRole = "REPORT_VIEWER";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getConfiguredSuperAdminEmails(): string[] {
  const configured = process.env.SUPER_ADMIN_EMAILS ?? "";

  return configured
    .split(",")
    .map(normalizeEmail)
    .filter((email, index, emails) => email.length > 0 && emails.indexOf(email) === index);
}

export function isConfiguredSuperAdminEmail(email: string): boolean {
  return getConfiguredSuperAdminEmails().includes(normalizeEmail(email));
}

/**
 * SUPER_ADMIN_EMAILS is the sole source of elevated SaaS access.
 * A legacy SAAS_SUPER_ADMIN value in the database is intentionally ignored
 * when the email is not allowlisted.
 */
export function resolveEffectiveRole(
  email: string,
  persistedRole: UserRole,
  isImpersonating = false
): UserRole {
  if (isImpersonating) return persistedRole;
  if (isConfiguredSuperAdminEmail(email)) return SUPER_ADMIN_ROLE;
  return persistedRole === SUPER_ADMIN_ROLE ? FALLBACK_ROLE : persistedRole;
}
