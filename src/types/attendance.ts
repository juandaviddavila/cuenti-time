export type AttendanceType = "CHECK_IN" | "CHECK_OUT";
export type ValidationResult =
  | "SUCCESS"
  | "FAILED"
  | "LOW_CONFIDENCE"
  | "LIVENESS_FAILED"
  | "SPOOFING_DETECTED"
  | "FACE_NOT_FOUND"
  | "MULTIPLE_FACES";

export interface AttendanceRecord {
  id: string;
  companyId: string;
  branchId: string;
  branchName?: string;
  employeeId: string;
  employeeName?: string;
  employeePhoto?: string;
  type: AttendanceType;
  recordedAt: string;
  validationStatus: ValidationResult;
  confidenceScore?: number;
  livenessScore?: number;
  deviceInfo?: string;
  ipAddress?: string;
  latitude?: number;
  longitude?: number;
  isManual: boolean;
  createdAt: string;
}

export interface FaceValidationLog {
  id: string;
  companyId: string;
  branchId?: string;
  employeeId?: string;
  employeeName?: string;
  result: ValidationResult;
  reason?: string;
  confidenceScore?: number;
  livenessScore?: number;
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalCompanies: number;
  totalBranches: number;
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  checkInsToday: number;
  checkOutsToday: number;
  lateArrivals: number;
  facialAlerts: number;
  attendanceRate: number;
}
