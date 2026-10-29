import { z } from "zod";

const decimalId = z.string().regex(/^\d+$/, "Identificador numérico inválido");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (yyyy-mm-dd)");

/** Parámetros de generación que envía el operador. */
export const generateDraftSchema = z.object({
  branchId: decimalId,
  shiftId: decimalId,
  rangeStart: day,
  rangeEnd: day,
  employeeIds: z.array(decimalId).max(200).optional(),
  name: z.string().min(1).max(120).optional(),
});

/** Payload persistido: se trata como no confiable al aprobar. */
export const draftPayloadSchema = z.object({
  rangeStart: day,
  rangeEnd: day,
  shiftId: decimalId,
  proposals: z.array(
    z.object({
      employeeId: decimalId,
      employeeName: z.string(),
      shiftId: decimalId,
      shiftName: z.string(),
      startDate: day,
      endDate: day,
    })
  ).max(500),
  conflicts: z.array(
    z.object({
      type: z.enum(["overlap", "employee_inactive", "employee_other_branch"]),
      employeeId: decimalId,
      employeeName: z.string(),
      message: z.string(),
      existingShiftId: decimalId.optional(),
      existingShiftName: z.string().optional(),
      existingStart: z.string().optional(),
      existingEnd: z.string().nullable().optional(),
    })
  ),
});

export const draftActionSchema = z.object({
  action: z.enum(["approve", "discard"]),
});

export type GenerateDraftInput = z.infer<typeof generateDraftSchema>;
export type ScheduleDraftPayload = z.infer<typeof draftPayloadSchema>;
