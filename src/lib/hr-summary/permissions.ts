import type { UserRole } from "@/types/user";

/**
 * Autorización para ver resúmenes ejecutivos de RR. HH.
 * Todos los roles con acceso a reportes pueden verlos (con alcance de tenant
 * y, para BRANCH_SUPERVISOR, sucursal forzada vía loadHrEvaluations).
 * FACE_REGISTRAR queda excluido: su rol es solo registro facial + kiosco.
 */
export function canViewHrSummaries(role: UserRole): boolean {
  return role !== "FACE_REGISTRAR";
}
