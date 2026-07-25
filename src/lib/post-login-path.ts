import type { UserRole } from "@/types/user";

/** Ruta de aterrizaje tras login según el rol. */
export function getPostLoginPath(role: UserRole | string): string {
  if (role === "FACE_REGISTRAR") return "/facial-registration";
  return "/dashboard";
}

/** Roles que pueden ver /settings (administración y supervisión). */
const SETTINGS_ROLES = new Set<UserRole>([
  "SAAS_SUPER_ADMIN",
  "COMPANY_ADMIN",
  "BRANCH_SUPERVISOR",
]);

export function canAccessSettings(role: UserRole | string | undefined | null): boolean {
  if (!role) return false;
  return SETTINGS_ROLES.has(role as UserRole);
}
