import type { Status } from "./user";

export interface Company {
  id: string;
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  logo?: string;
  status: Status;
  subscriptionExpiresAt?: string | null;
  maxEmployees: number;
  /** Distancia euclidiana máxima para match facial (default 0.6). */
  faceMatchThreshold?: number;
  _count?: {
    branches: number;
    employees: number;
    users?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyRequest {
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  logo?: string;
  maxEmployees?: number;
}

export type UpdateCompanyRequest = Partial<CreateCompanyRequest> & {
  status?: Status;
  subscriptionExpiresAt?: string | null;
};
