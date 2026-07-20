import type { Status } from "./user";

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  status: Status;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  radiusMeters?: number;
  _count?: {
    employees: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchRequest {
  companyId: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  radiusMeters?: number;
}

export type UpdateBranchRequest = Partial<CreateBranchRequest> & {
  status?: Status;
};
