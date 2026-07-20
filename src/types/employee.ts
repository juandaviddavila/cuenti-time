import type { Status } from "./user";

export type DocumentType = "CC" | "CE" | "PASSPORT" | "NIT" | "OTHER";

export interface Position {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  positionId?: string;
  position?: Position;
  email?: string;
  phone?: string;
  photo?: string;
  status: Status;
  faceRegistered: boolean;
  faceRegisteredAt?: string;
  biometricConsentAt?: string;
  hireDate?: string;
  internalCode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeRequest {
  companyId: string;
  branchId: string;
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  positionId?: string;
  email?: string;
  phone?: string;
  photo?: string;
  hireDate?: string;
  internalCode?: string;
}

export type UpdateEmployeeRequest = Partial<CreateEmployeeRequest> & {
  status?: Status;
};
