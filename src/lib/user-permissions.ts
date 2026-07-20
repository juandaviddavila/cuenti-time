import type { UserRole } from "@/types/user";

export interface UserPermissionFields {
  role: UserRole;
  bypassGeofence?: boolean;
  canManageIntegrations?: boolean;
}

const INTEGRATION_ROLES: UserRole[] = [
  "SAAS_SUPER_ADMIN",
  "COMPANY_ADMIN",
  "DEVELOPER",
];

export function canManageIntegrations(user: UserPermissionFields): boolean {
  return (
    INTEGRATION_ROLES.includes(user.role) ||
    user.canManageIntegrations === true
  );
}

export function bypassesGeofence(user: UserPermissionFields): boolean {
  return user.bypassGeofence === true;
}
