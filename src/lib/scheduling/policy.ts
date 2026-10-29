import type { UserRole } from "@/types/user";

export interface SchedulingOperator {
  id: string;
  companyId: string | null;
  role: UserRole;
  status: string;
  branchId: string | null;
}

const ADMIN_ROLES: UserRole[] = ["SAAS_SUPER_ADMIN", "COMPANY_ADMIN"];

/**
 * Quién puede generar/aprobar/descartar borradores de horario:
 * administradores de la empresa (y plataforma) y supervisores, estos últimos
 * limitados siempre a su sucursal asignada. Ningún otro rol participa.
 */
export function canManageSchedules(user: SchedulingOperator): boolean {
  if (user.status !== "ACTIVE" || !user.companyId) return false;
  if (ADMIN_ROLES.includes(user.role)) return true;
  return user.role === "BRANCH_SUPERVISOR" && Boolean(user.branchId);
}

/**
 * Decisión por borrador concreto: el supervisor solo opera borradores de su
 * sucursal; los administradores operan cualquier sucursal de su empresa.
 */
export function canApproveScheduleDraft(
  user: SchedulingOperator,
  draftBranchId: string
): boolean {
  if (!canManageSchedules(user)) return false;
  if (ADMIN_ROLES.includes(user.role)) return true;
  return user.branchId === draftBranchId;
}
