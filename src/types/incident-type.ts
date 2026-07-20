export interface IncidentType {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
  countsAsAbsence: boolean;
  excusesLate: boolean;
  excusesEarlyLeave: boolean;
  createdAt: string;
  updatedAt: string;
}
