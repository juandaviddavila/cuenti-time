/**
 * Orquestación de borradores de horario asistido.
 *
 * Garantías:
 * - Generar/guardar NUNCA crea asignaciones: solo persiste un borrador DRAFT.
 * - Aprobar es atómico y humano: dentro de una transacción ReadCommitted que
 *   primero toma un advisory lock por borrador se re-lee el estado (solo DRAFT
 *   aprueba), se re-valida el payload almacenado (dato no confiable) contra la
 *   sucursal, el turno y los empleados VIGENTES, y se detectan conflictos de
 *   nuevo contra las asignaciones actuales. Si algo falla, no se escribe nada.
 * - La transición DRAFT → APPROVED es condicional (updateMany con status en el
 *   where): dos aprobaciones concurrentes no pueden aplicar dos veces.
 */
import { prisma } from "@/lib/prisma";
import type { ServerSession } from "@/lib/server-auth";
import { bigintToString, stringToBigint } from "@/lib/bigint";
import { createAuditLog } from "@/lib/audit";
import { advisoryLockKey } from "@/lib/hr-summary/service";
import {
  generateScheduleDraft,
  rangesOverlap,
  type GeneratorAssignment,
  type ScheduleConflict,
} from "@/lib/scheduling/generator";
import {
  canApproveScheduleDraft,
  canManageSchedules,
  type SchedulingOperator,
} from "@/lib/scheduling/policy";
import {
  draftPayloadSchema,
  type GenerateDraftInput,
  type ScheduleDraftPayload,
} from "@/lib/scheduling/schemas";
import type { NextRequest } from "next/server";

export class ScheduleError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

const notFound = () => new ScheduleError(404, "Recurso no encontrado");
const forbidden = () =>
  new ScheduleError(403, "Tu rol no puede gestionar borradores de horario");

function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function dayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999Z`);
}

/** Resuelve la sucursal asignada del operador (requisito para supervisores). */
async function loadOperator(session: ServerSession): Promise<SchedulingOperator> {
  const user = await prisma.user.findUnique({
    where: { id: stringToBigint(session.userId) },
    select: { status: true, branchId: true },
  });
  const operator: SchedulingOperator = {
    id: session.userId,
    companyId: session.companyId,
    role: session.role,
    status: user?.status ?? "ACTIVE",
    branchId: user?.branchId ? bigintToString(user.branchId) : null,
  };
  if (!canManageSchedules(operator)) throw forbidden();
  return operator;
}

function assertTenant(operator: SchedulingOperator, companyId: bigint): void {
  if (operator.role === "SAAS_SUPER_ADMIN") return;
  if (!operator.companyId || companyId.toString() !== operator.companyId) {
    throw forbidden();
  }
}

function assertDraftAccess(
  operator: SchedulingOperator,
  draft: { companyId: bigint; branchId: bigint }
): void {
  assertTenant(operator, draft.companyId);
  if (!canApproveScheduleDraft(operator, draft.branchId.toString())) {
    throw forbidden();
  }
}

interface DraftRow {
  id: bigint;
  companyId: bigint;
  branchId: bigint;
  name: string;
  status: string;
  rangeStart: Date;
  rangeEnd: Date;
  payload: unknown;
  createdById: bigint;
  approvedById: bigint | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeScheduleDraft(
  draft: DraftRow,
  extra: { branchName?: string; createdByName?: string } = {}
) {
  return {
    id: bigintToString(draft.id),
    companyId: bigintToString(draft.companyId),
    branchId: bigintToString(draft.branchId),
    name: draft.name,
    status: draft.status,
    rangeStart: draft.rangeStart.toISOString(),
    rangeEnd: draft.rangeEnd.toISOString(),
    payload: draft.payload,
    createdById: bigintToString(draft.createdById),
    approvedById: draft.approvedById ? bigintToString(draft.approvedById) : null,
    approvedAt: draft.approvedAt ? draft.approvedAt.toISOString() : null,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    ...extra,
  };
}

async function loadAssignmentsInRange(
  tx: Pick<typeof prisma, "employeeShift">,
  employeeIds: bigint[],
  rangeStart: string,
  rangeEnd: string
): Promise<GeneratorAssignment[]> {
  const rows = await tx.employeeShift.findMany({
    where: {
      employeeId: { in: employeeIds },
      startDate: { lte: dayEnd(rangeEnd) },
      OR: [{ endDate: null }, { endDate: { gte: dayStart(rangeStart) } }],
    },
    include: { shift: { select: { name: true } } },
  });
  return rows.map((a) => ({
    employeeId: bigintToString(a.employeeId),
    shiftId: bigintToString(a.shiftId),
    shiftName: a.shift.name,
    startDate: a.startDate,
    endDate: a.endDate,
  }));
}

function detectConflicts(
  payload: ScheduleDraftPayload,
  existing: GeneratorAssignment[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  for (const proposal of payload.proposals) {
    const overlap = existing.find(
      (a) =>
        a.employeeId === proposal.employeeId &&
        rangesOverlap(
          proposal.startDate,
          proposal.endDate,
          a.startDate,
          a.endDate
        )
    );
    if (overlap) {
      conflicts.push({
        type: "overlap",
        employeeId: proposal.employeeId,
        employeeName: proposal.employeeName,
        message: `${proposal.employeeName} ya tiene el turno "${overlap.shiftName}" en ese rango`,
        existingShiftId: overlap.shiftId,
        existingShiftName: overlap.shiftName,
        existingStart:
          overlap.startDate instanceof Date
            ? overlap.startDate.toISOString()
            : String(overlap.startDate),
        existingEnd:
          overlap.endDate instanceof Date
            ? overlap.endDate.toISOString()
            : overlap.endDate === null
              ? null
              : String(overlap.endDate),
      });
    }
  }
  return conflicts;
}

/** Genera (sin aplicar) y persiste un borrador de horario. */
export async function createScheduleDraft(
  session: ServerSession,
  input: GenerateDraftInput
): Promise<{ draft: ReturnType<typeof serializeScheduleDraft> }> {
  const operator = await loadOperator(session);
  const companyId = stringToBigint(operator.companyId ?? "");

  const branch = await prisma.branch.findFirst({
    where: { id: stringToBigint(input.branchId), companyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!branch) throw notFound();

  const shift = await prisma.shift.findFirst({
    where: { id: stringToBigint(input.shiftId), companyId },
    select: { id: true, name: true, active: true },
  });
  if (!shift) throw notFound();
  if (!shift.active) {
    throw new ScheduleError(422, "El turno seleccionado está inactivo");
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      branchId: branch.id,
      ...(input.employeeIds
        ? { id: { in: input.employeeIds.map((id) => stringToBigint(id)) } }
        : {}),
    },
    select: { id: true, fullName: true, status: true, branchId: true },
  });
  const existing = await loadAssignmentsInRange(
    prisma,
    employees.map((e) => e.id),
    input.rangeStart,
    input.rangeEnd
  );

  const generated = generateScheduleDraft({
    companyId: operator.companyId as string,
    branchId: input.branchId,
    shiftId: input.shiftId,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    employees: employees.map((e) => ({
      id: bigintToString(e.id),
      fullName: e.fullName,
      status: e.status,
      branchId: bigintToString(e.branchId),
    })),
    shift: {
      id: bigintToString(shift.id),
      name: shift.name,
      companyId: operator.companyId as string,
      active: shift.active,
    },
    existingAssignments: existing,
  });
  if ("error" in generated) {
    throw new ScheduleError(422, generated.error);
  }

  const draft = await prisma.scheduleDraft.create({
    data: {
      companyId,
      branchId: branch.id,
      name:
        input.name?.trim() ||
        `Turno ${shift.name} · ${input.rangeStart} → ${input.rangeEnd}`,
      rangeStart: dayStart(input.rangeStart),
      rangeEnd: dayEnd(input.rangeEnd),
      payload: generated,
      createdById: stringToBigint(session.userId),
    },
  });

  return { draft: serializeScheduleDraft(draft) };
}

/** Lista de borradores del tenant; el supervisor solo ve su sucursal. */
export async function listScheduleDrafts(
  session: ServerSession
): Promise<{ drafts: Array<ReturnType<typeof serializeScheduleDraft>> }> {
  const operator = await loadOperator(session);
  const drafts = await prisma.scheduleDraft.findMany({
    where: {
      ...(operator.role === "SAAS_SUPER_ADMIN"
        ? {}
        : { companyId: stringToBigint(operator.companyId ?? "-1") }),
      ...(operator.role === "BRANCH_SUPERVISOR" && operator.branchId
        ? { branchId: stringToBigint(operator.branchId) }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      branch: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  return {
    drafts: drafts.map((d) =>
      serializeScheduleDraft(d, {
        branchName: d.branch.name,
        createdByName: d.createdBy.name,
      })
    ),
  };
}

async function loadDraft(session: ServerSession, id: string): Promise<DraftRow> {
  const operator = await loadOperator(session);
  const draftId = stringToBigint(id);
  if (draftId === null || draftId === undefined) throw notFound();
  const draft = await prisma.scheduleDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw notFound();
  assertDraftAccess(operator, draft);
  return draft;
}

export async function getScheduleDraft(session: ServerSession, id: string) {
  const draft = await loadDraft(session, id);
  return { draft: serializeScheduleDraft(draft) };
}

/**
 * Aprobación humana y atómica: valida de nuevo todo contra datos vigentes y
 * solo entonces crea las asignaciones. Todo-o-nada: cualquier conflicto o
 * dato inválido rechaza la operación completa sin mutaciones.
 */
export async function approveScheduleDraft(
  session: ServerSession,
  id: string,
  request: NextRequest
): Promise<{ draft: ReturnType<typeof serializeScheduleDraft>; assignmentsCreated: number }> {
  const operator = await loadOperator(session);
  const draftId = stringToBigint(id);
  if (draftId === null || draftId === undefined) throw notFound();
  const draft = await prisma.scheduleDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw notFound();
  assertDraftAccess(operator, draft);

  const lockKey = advisoryLockKey(`schedule-draft:${draft.id.toString()}`);
  const approvedById = stringToBigint(session.userId);
  const assignmentsCreated = await prisma.$transaction(
    async (tx) => {
      // Serializa aprobaciones concurrentes del mismo borrador. ReadCommitted
      // hace que el re-chequeo posterior vea el commit del ganador.
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(${lockKey}::int8)) AS lock_holder`;

      const fresh = await tx.scheduleDraft.findUnique({ where: { id: draftId } });
      if (!fresh || fresh.status !== "DRAFT") {
        throw new ScheduleError(409, "El borrador ya fue procesado");
      }

      // El payload almacenado es dato no confiable: se valida por completo.
      const parsed = draftPayloadSchema.safeParse(fresh.payload);
      if (!parsed.success) {
        throw new ScheduleError(
          422,
          "El borrador almacenado no tiene un formato válido",
          parsed.error.flatten()
        );
      }
      const payload = parsed.data;

      const branch = await tx.branch.findFirst({
        where: { id: fresh.branchId, companyId: fresh.companyId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!branch) {
        throw new ScheduleError(422, "La sucursal del borrador ya no está disponible");
      }
      const shift = await tx.shift.findFirst({
        where: { id: stringToBigint(payload.shiftId), companyId: fresh.companyId },
        select: { id: true, active: true },
      });
      if (!shift || !shift.active) {
        throw new ScheduleError(422, "El turno del borrador ya no está disponible");
      }

      const employeeIds = payload.proposals.map((p) => stringToBigint(p.employeeId));
      const employees = await tx.employee.findMany({
        where: {
          id: { in: employeeIds },
          companyId: fresh.companyId,
          branchId: fresh.branchId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      const rangeMismatch = payload.proposals.some(
        (p) =>
          p.shiftId !== payload.shiftId ||
          p.startDate !== payload.rangeStart ||
          p.endDate !== payload.rangeEnd
      );
      if (employees.length !== payload.proposals.length || rangeMismatch) {
        throw new ScheduleError(
          422,
          "Las propuestas del borrador ya no corresponden a los datos vigentes"
        );
      }

      // Conflicto contra datos ACTUALES, no contra el snapshot de generación.
      const existing = await loadAssignmentsInRange(
        tx,
        employeeIds,
        payload.rangeStart,
        payload.rangeEnd
      );
      const conflicts = detectConflicts(payload, existing);
      if (conflicts.length > 0) {
        throw new ScheduleError(
          409,
          "El borrador tiene conflictos con asignaciones actuales",
          { conflicts }
        );
      }

      for (const proposal of payload.proposals) {
        await tx.employeeShift.create({
          data: {
            employeeId: stringToBigint(proposal.employeeId),
            shiftId: shift.id,
            startDate: dayStart(proposal.startDate),
            endDate: dayEnd(proposal.endDate),
          },
        });
      }

      // Transición condicional: si otra solicitud ganó la carrera, count = 0
      // y el throw revierte las asignaciones creadas arriba.
      const updated = await tx.scheduleDraft.updateMany({
        where: { id: fresh.id, status: "DRAFT" },
        data: { status: "APPROVED", approvedById, approvedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new ScheduleError(409, "El borrador fue procesado por otra solicitud");
      }
      return payload.proposals.length;
    },
    { isolationLevel: "ReadCommitted" }
  );

  const updated = await prisma.scheduleDraft.findUnique({ where: { id: draftId } });
  await createAuditLog({
    request,
    session,
    action: "APPROVE",
    entity: "SCHEDULE_DRAFT",
    entityId: draftId,
    companyId: draft.companyId,
    newValues: { id: draftId.toString(), assignmentsCreated, status: "APPROVED" },
  });
  return {
    draft: serializeScheduleDraft(updated as DraftRow),
    assignmentsCreated,
  };
}

/** Descarta un borrador sin crear ninguna asignación. */
export async function discardScheduleDraft(
  session: ServerSession,
  id: string,
  request: NextRequest
): Promise<{ draft: ReturnType<typeof serializeScheduleDraft> }> {
  const operator = await loadOperator(session);
  const draftId = stringToBigint(id);
  if (draftId === null || draftId === undefined) throw notFound();
  const draft = await prisma.scheduleDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw notFound();
  assertDraftAccess(operator, draft);

  const lockKey = advisoryLockKey(`schedule-draft:${draft.id.toString()}`);
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(${lockKey}::int8)) AS lock_holder`;
      const fresh = await tx.scheduleDraft.findUnique({ where: { id: draftId } });
      if (!fresh || fresh.status !== "DRAFT") {
        throw new ScheduleError(409, "El borrador ya fue procesado");
      }
      const updated = await tx.scheduleDraft.updateMany({
        where: { id: fresh.id, status: "DRAFT" },
        data: { status: "DISCARDED" },
      });
      if (updated.count !== 1) {
        throw new ScheduleError(409, "El borrador fue procesado por otra solicitud");
      }
    },
    { isolationLevel: "ReadCommitted" }
  );

  const updated = await prisma.scheduleDraft.findUnique({ where: { id: draftId } });
  await createAuditLog({
    request,
    session,
    action: "DISCARD",
    entity: "SCHEDULE_DRAFT",
    entityId: draftId,
    companyId: draft.companyId,
    newValues: { id: draftId.toString(), status: "DISCARDED" },
  });
  return { draft: serializeScheduleDraft(updated as DraftRow) };
}
