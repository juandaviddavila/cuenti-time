export type UserRole =
  | "SAAS_SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "BRANCH_SUPERVISOR"
  | "FACE_REGISTRAR"
  | "REPORT_VIEWER"
  | "DEVELOPER";

export type Status = "ACTIVE" | "INACTIVE";

export interface User {
  id: string;
  companyId?: string;
  /** Nombre de la empresa del tenant actual (o impersonada). */
  companyName?: string | null;
  name: string;
  email: string;
  role: UserRole;
  status: Status;
  avatar?: string;
  branchId?: string;
  bypassGeofence?: boolean;
  canManageIntegrations?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuthPayload {
  userId: string;
  companyId?: string;
  role: UserRole;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  companyLegalName: string;
  companyTaxId: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
