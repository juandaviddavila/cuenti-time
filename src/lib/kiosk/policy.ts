import { createHash } from "node:crypto";

export const KIOSK_COOKIE = "kiosk-device";
export const ACTIVATION_TTL_MS = 15 * 60 * 1000;
export const DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface KioskOperator {
  id: string;
  companyId: string | null;
  role: string;
  status: string;
  branchId: string | null;
}
export interface KioskBranch { id: string; companyId: string; status: string }
export function isKioskAdministrator(user: KioskOperator): boolean {
  return user.status === "ACTIVE" && Boolean(user.companyId) &&
    (user.role === "COMPANY_ADMIN" || user.role === "SAAS_SUPER_ADMIN");
}
export function canManageKioskBranch(user: KioskOperator, branch: KioskBranch, grantedBranches: string[]): boolean {
  if (user.status !== "ACTIVE" || branch.status !== "ACTIVE" || user.companyId !== branch.companyId) return false;
  if (isKioskAdministrator(user)) return true;
  if (user.role === "BRANCH_SUPERVISOR" && user.branchId !== branch.id) return false;
  return grantedBranches.includes(branch.id);
}
export function hashKioskSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
export function validActivation(device: { activatedAt: Date | null; revokedAt: Date | null; activationExpiresAt: Date }, now = new Date()): boolean {
  return !device.activatedAt && !device.revokedAt && device.activationExpiresAt > now;
}
export function validKioskDevice(device: { activatedAt: Date | null; revokedAt: Date | null; expiresAt: Date; companyStatus: string; branchStatus: string }, now = new Date()): boolean {
  return Boolean(device.activatedAt) && !device.revokedAt && device.expiresAt > now && device.companyStatus === "ACTIVE" && device.branchStatus === "ACTIVE";
}
