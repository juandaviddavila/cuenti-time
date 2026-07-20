import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Fecha debe tener formato YYYY-MM-DD",
});

const cuidSchema = z.string().min(1, { message: "ID requerido" });

export const hrReportToolSchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  branchId: cuidSchema.optional(),
  employeeId: cuidSchema.optional(),
  shiftId: cuidSchema.optional(),
});

export const listEmployeesSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  branchId: cuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listBranchesSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getCompanyInfoSchema = z.object({});

export const getIncidentsSchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  employeeId: cuidSchema.optional(),
  branchId: cuidSchema.optional(),
  shiftId: cuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type HrReportToolInput = z.infer<typeof hrReportToolSchema>;
export type ListEmployeesInput = z.infer<typeof listEmployeesSchema>;
export type ListBranchesInput = z.infer<typeof listBranchesSchema>;
export type GetCompanyInfoInput = z.infer<typeof getCompanyInfoSchema>;
export type GetIncidentsInput = z.infer<typeof getIncidentsSchema>;

export function validateDateRange(from: string, to: string): void {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new Error("Rango de fechas inválido");
  }
  if (fromDate > toDate) {
    throw new Error("Rango de fechas inválido");
  }
}
