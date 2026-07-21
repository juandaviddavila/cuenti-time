import { z } from "zod";
import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { loadHrEvaluations } from "@/lib/hr/load-hr-evaluations";
import { parseLocalDateParam } from "@/lib/hr/local-date";
import type { UserRole } from "@/types/user";
import type { TenantSession } from "@/lib/tenant";
import type { ApiTokenContext } from "@/lib/api-token-auth";
import { stringToBigint, bigintReplacer } from "@/lib/bigint";
import type { ToolHandler } from "./types.js";
import {
  hrReportToolSchema,
  listEmployeesSchema,
  listBranchesSchema,
  getCompanyInfoSchema,
  getIncidentsSchema,
  getAttendanceRecordsSchema,
  findEmployeeSchema,
  getPresentNowSchema,
  validateDateRange,
  type HrReportToolInput,
  type ListEmployeesInput,
  type ListBranchesInput,
  type GetCompanyInfoInput,
  type GetIncidentsInput,
  type GetAttendanceRecordsInput,
  type FindEmployeeInput,
  type GetPresentNowInput,
} from "./schemas.js";
import { invalidParams, notFound } from "./errors.js";

const MCP_ROLE: UserRole = "DEVELOPER";

function tokenContextToSession(token: ApiTokenContext): TenantSession {
  return {
    userId: token.tokenId,
    companyId: token.companyId,
    role: MCP_ROLE,
  };
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, bigintReplacer, 2);
}

/** JSON Schema compatible with ChatGPT/OpenAI MCP (sin $schema 2020-12; defaults no van en required). */
function toolJsonSchema(schema: z.ZodType): object {
  const json = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

function parseArgs<T>(schema: z.ZodType<T>, args: unknown): T {
  const result = schema.safeParse(args);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw invalidParams(`Parámetros inválidos: ${issues}`);
  }
  return result.data;
}

async function validateBranchId(branchId: string, companyId: bigint): Promise<void> {
  const id = stringToBigint(branchId);
  const branch = await prisma.branch.findUnique({
    where: { id },
    select: { companyId: true },
  });
  if (!branch || branch.companyId !== companyId) {
    throw notFound("Sucursal", branchId);
  }
}

async function validateEmployeeId(employeeId: string, companyId: bigint): Promise<void> {
  const id = stringToBigint(employeeId);
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { companyId: true },
  });
  if (!employee || employee.companyId !== companyId) {
    throw notFound("Empleado", employeeId);
  }
}

async function validateShiftId(shiftId: string, companyId: bigint): Promise<void> {
  const id = stringToBigint(shiftId);
  const shift = await prisma.shift.findUnique({
    where: { id },
    select: { companyId: true },
  });
  if (!shift || shift.companyId !== companyId) {
    throw notFound("Turno", shiftId);
  }
}

async function runHrReport(
  token: ApiTokenContext,
  input: HrReportToolInput,
  report: Parameters<typeof loadHrEvaluations>[1]["report"]
) {
  validateDateRange(input.from, input.to);

  const companyId = stringToBigint(token.companyId);
  if (input.branchId) await validateBranchId(input.branchId, companyId);
  if (input.employeeId) await validateEmployeeId(input.employeeId, companyId);
  if (input.shiftId) await validateShiftId(input.shiftId, companyId);

  const result = await loadHrEvaluations(tokenContextToSession(token), {
    from: parseLocalDateParam(input.from),
    to: parseLocalDateParam(input.to),
    report,
    branchId: input.branchId,
    employeeId: input.employeeId,
    shiftId: input.shiftId,
  });

  return result;
}

const getLateArrivals: ToolHandler = {
  name: "get_late_arrivals",
  description: "Tardanzas del período con minutos de atraso por empleado y día.",
  inputSchema: toolJsonSchema(hrReportToolSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(hrReportToolSchema, args);
    const result = await runHrReport(ctx.token, input, "lates");
    return {
      content: [
        {
          type: "text",
          text: safeJson({
            range: result.range,
            count: result.filtered.length,
            data: result.filtered,
          }),
        },
      ],
    };
  },
};

const getAbsences: ToolHandler = {
  name: "get_absences",
  description: "Días laborales sin entrada (ausencias), con opción de ver justificadas.",
  inputSchema: toolJsonSchema(hrReportToolSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(hrReportToolSchema, args);
    const result = await runHrReport(ctx.token, input, "absences");
    return {
      content: [
        {
          type: "text",
          text: safeJson({
            range: result.range,
            count: result.filtered.length,
            data: result.filtered,
          }),
        },
      ],
    };
  },
};

const getEarlyLeaves: ToolHandler = {
  name: "get_early_leaves",
  description: "Salidas anticipadas antes del fin de turno con minutos.",
  inputSchema: toolJsonSchema(hrReportToolSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(hrReportToolSchema, args);
    const result = await runHrReport(ctx.token, input, "early_leaves");
    return {
      content: [
        {
          type: "text",
          text: safeJson({
            range: result.range,
            count: result.filtered.length,
            data: result.filtered,
          }),
        },
      ],
    };
  },
};

const getOpenDays: ToolHandler = {
  name: "get_open_days",
  description: "Días laborales con CHECK_IN pero sin CHECK_OUT.",
  inputSchema: toolJsonSchema(hrReportToolSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(hrReportToolSchema, args);
    const result = await runHrReport(ctx.token, input, "open_days");
    return {
      content: [
        {
          type: "text",
          text: safeJson({
            range: result.range,
            count: result.filtered.length,
            data: result.filtered,
          }),
        },
      ],
    };
  },
};

const getEmployeeSummary: ToolHandler = {
  name: "get_employee_summary",
  description: "KPIs agregados por empleado: puntualidad, ausencias, tardanzas, minutos.",
  inputSchema: toolJsonSchema(hrReportToolSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(hrReportToolSchema, args);
    const result = await runHrReport(ctx.token, input, "employee_summary");
    return {
      content: [
        {
          type: "text",
          text: safeJson({
            range: result.range,
            count: result.employeeSummary.length,
            data: result.employeeSummary,
          }),
        },
      ],
    };
  },
};

const getBranchSummary: ToolHandler = {
  name: "get_branch_summary",
  description: "KPIs agregados por sucursal.",
  inputSchema: toolJsonSchema(hrReportToolSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(hrReportToolSchema, args);
    const result = await runHrReport(ctx.token, input, "branch_summary");
    return {
      content: [
        {
          type: "text",
          text: safeJson({
            range: result.range,
            count: result.branchSummary.length,
            data: result.branchSummary,
          }),
        },
      ],
    };
  },
};

const getDailySnapshot: ToolHandler = {
  name: "get_daily_snapshot",
  description: "Snapshot diario operativo: presentes, tardanzas, ausencias y sin salida.",
  inputSchema: toolJsonSchema(hrReportToolSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(hrReportToolSchema, args);
    const result = await runHrReport(ctx.token, input, "daily");
    const days = new Map<string, {
      date: string;
      present: number;
      late: number;
      absent: number;
      open: number;
      earlyLeave: number;
      total: number;
    }>();

    for (const row of result.evaluations) {
      const day = days.get(row.date) ?? {
        date: row.date,
        present: 0,
        late: 0,
        absent: 0,
        open: 0,
        earlyLeave: 0,
        total: 0,
      };
      day.total += 1;
      if (row.lateMinutes > 0 && !row.novelty?.excusesLate) day.late += 1;
      if (row.earlyLeaveMinutes > 0 && !row.novelty?.excusesEarlyLeave) day.earlyLeave += 1;
      if (row.outcome === "AUSENTE") day.absent += 1;
      else if (row.outcome === "PRESENTE" || row.outcome === "TARDE" || row.outcome === "SALIDA_ANTICIPADA" || row.outcome === "TARDE_Y_SALIDA_ANTICIPADA") {
        day.present += 1;
      } else if (row.outcome === "SIN_SALIDA") {
        day.open += 1;
      }
      days.set(row.date, day);
    }

    return {
      content: [
        {
          type: "text",
          text: safeJson({
            range: result.range,
            count: days.size,
            data: Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date)),
          }),
        },
      ],
    };
  },
};

const getAttendanceRecords: ToolHandler = {
  name: "get_attendance_records",
  description:
    "Detalle de marcaciones CHECK_IN/CHECK_OUT del período. Úsala para consultar horas exactas de entrada/salida, sucursal, validación y geolocalización.",
  inputSchema: toolJsonSchema(getAttendanceRecordsSchema),
  execute: async (args, ctx) => {
    const input = parseArgs<GetAttendanceRecordsInput>(
      getAttendanceRecordsSchema,
      args
    );
    validateDateRange(input.from, input.to);
    if (input.branchId) await validateBranchId(input.branchId, ctx.companyId);
    if (input.employeeId) await validateEmployeeId(input.employeeId, ctx.companyId);

    const employeeId = input.employeeId ? stringToBigint(input.employeeId) : undefined;
    const branchId = input.branchId ? stringToBigint(input.branchId) : undefined;
    const where = {
      companyId: ctx.companyId,
      recordedAt: {
        gte: startOfDay(parseLocalDateParam(input.from)),
        lte: endOfDay(parseLocalDateParam(input.to)),
      },
      ...(employeeId ? { employeeId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(input.type ? { type: input.type } : {}),
    };

    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        select: {
          id: true,
          type: true,
          recordedAt: true,
          validationStatus: true,
          confidenceScore: true,
          livenessScore: true,
          deviceInfo: true,
          ipAddress: true,
          latitude: true,
          longitude: true,
          distanceFromBranch: true,
          isManual: true,
          notes: true,
          employee: {
            select: {
              id: true,
              fullName: true,
              documentNumber: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { recordedAt: "desc" },
        take: input.limit,
        skip: input.offset,
      }),
      prisma.attendanceRecord.count({ where }),
    ]);

    return {
      content: [
        {
          type: "text",
          text: safeJson({
            range: { from: input.from, to: input.to },
            total,
            count: records.length,
            data: records,
          }),
        },
      ],
    };
  },
};

const findEmployee: ToolHandler = {
  name: "find_employee",
  description:
    "Busca empleados por nombre, documento, código interno o email. Úsala para resolver el employeeId antes de consultar reportes o marcaciones.",
  inputSchema: toolJsonSchema(findEmployeeSchema),
  execute: async (args, ctx) => {
    const input = parseArgs<FindEmployeeInput>(findEmployeeSchema, args);
    const employees = await prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        ...(input.status ? { status: input.status } : {}),
        OR: [
          { fullName: { contains: input.query, mode: "insensitive" } },
          { documentNumber: { contains: input.query, mode: "insensitive" } },
          { internalCode: { contains: input.query, mode: "insensitive" } },
          { email: { contains: input.query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        documentType: true,
        documentNumber: true,
        internalCode: true,
        email: true,
        phone: true,
        status: true,
        faceRegistered: true,
        branch: { select: { id: true, name: true, code: true } },
        position: { select: { id: true, name: true } },
      },
      orderBy: { fullName: "asc" },
      take: input.limit,
    });

    return {
      content: [
        {
          type: "text",
          text: safeJson({
            query: input.query,
            count: employees.length,
            data: employees,
          }),
        },
      ],
    };
  },
};

const getPresentNow: ToolHandler = {
  name: "get_present_now",
  description:
    "Lista quiénes están presentes: empleados cuya última marcación del día es CHECK_IN. Permite filtrar por fecha y sucursal.",
  inputSchema: toolJsonSchema(getPresentNowSchema),
  execute: async (args, ctx) => {
    const input = parseArgs<GetPresentNowInput>(getPresentNowSchema, args);
    if (input.branchId) await validateBranchId(input.branchId, ctx.companyId);

    const selectedDate = input.date
      ? parseLocalDateParam(input.date)
      : new Date();
    const branchId = input.branchId ? stringToBigint(input.branchId) : undefined;
    const records = await prisma.attendanceRecord.findMany({
      where: {
        companyId: ctx.companyId,
        recordedAt: {
          gte: startOfDay(selectedDate),
          lte: endOfDay(selectedDate),
        },
        ...(branchId ? { branchId } : {}),
      },
      select: {
        employeeId: true,
        type: true,
        recordedAt: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            documentNumber: true,
            status: true,
            position: { select: { id: true, name: true } },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { recordedAt: "asc" },
    });

    const lastRecordByEmployee = new Map<bigint, (typeof records)[number]>();
    for (const record of records) {
      lastRecordByEmployee.set(record.employeeId, record);
    }
    const present = Array.from(lastRecordByEmployee.values())
      .filter((record) => record.type === "CHECK_IN")
      .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName));

    return {
      content: [
        {
          type: "text",
          text: safeJson({
            date:
              input.date ??
              `${selectedDate.getFullYear()}-${String(
                selectedDate.getMonth() + 1
              ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(
                2,
                "0"
              )}`,
            count: present.length,
            data: present.map((record) => ({
              employee: record.employee,
              branch: record.branch,
              checkedInAt: record.recordedAt,
            })),
          }),
        },
      ],
    };
  },
};

const listEmployees: ToolHandler = {
  name: "list_employees",
  description: "Lista empleados del tenant. Filtra por estado y sucursal.",
  inputSchema: toolJsonSchema(listEmployeesSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(listEmployeesSchema, args);
    if (input.branchId) await validateBranchId(input.branchId, ctx.companyId);

    const branchId = input.branchId ? stringToBigint(input.branchId) : undefined;
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where: {
          companyId: ctx.companyId,
          ...(input.status ? { status: input.status } : {}),
          ...(branchId ? { branchId } : {}),
        },
        select: {
          id: true,
          fullName: true,
          documentNumber: true,
          email: true,
          phone: true,
          status: true,
          branchId: true,
          positionId: true,
          hireDate: true,
          faceRegistered: true,
        },
        orderBy: { fullName: "asc" },
        take: input.limit,
        skip: input.offset,
      }),
      prisma.employee.count({
        where: {
          companyId: ctx.companyId,
          ...(input.status ? { status: input.status } : {}),
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    return {
      content: [
        {
          type: "text",
          text: safeJson({ total, count: employees.length, data: employees }),
        },
      ],
    };
  },
};

const listBranches: ToolHandler = {
  name: "list_branches",
  description: "Lista sucursales del tenant.",
  inputSchema: toolJsonSchema(listBranchesSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(listBranchesSchema, args);
    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where: {
          companyId: ctx.companyId,
          ...(input.status ? { status: input.status } : {}),
        },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          status: true,
          latitude: true,
          longitude: true,
          radiusMeters: true,
        },
        orderBy: { name: "asc" },
        take: input.limit,
        skip: input.offset,
      }),
      prisma.branch.count({
        where: {
          companyId: ctx.companyId,
          ...(input.status ? { status: input.status } : {}),
        },
      }),
    ]);

    return {
      content: [
        {
          type: "text",
          text: safeJson({ total, count: branches.length, data: branches }),
        },
      ],
    };
  },
};

const getCompanyInfo: ToolHandler = {
  name: "get_company_info",
  description: "Información de la empresa del token: tolerancias, suscripción, límites.",
  inputSchema: toolJsonSchema(getCompanyInfoSchema),
  execute: async (_args, ctx) => {
    const company = await prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: {
        id: true,
        name: true,
        legalName: true,
        taxId: true,
        lateToleranceMinutes: true,
        earlyLeaveToleranceMinutes: true,
        subscriptionExpiresAt: true,
        maxEmployees: true,
        status: true,
      },
    });

    if (!company) {
      throw notFound("Empresa", ctx.companyId.toString());
    }

    return {
      content: [
        {
          type: "text",
          text: safeJson({ data: company }),
        },
      ],
    };
  },
};

const getIncidents: ToolHandler = {
  name: "get_incidents",
  description: "Lista novedades/incidentes del tenant con filtros opcionales.",
  inputSchema: toolJsonSchema(getIncidentsSchema),
  execute: async (args, ctx) => {
    const input = parseArgs(getIncidentsSchema, args);
    if (input.from && input.to) validateDateRange(input.from, input.to);
    if (input.branchId) await validateBranchId(input.branchId, ctx.companyId);
    if (input.employeeId) await validateEmployeeId(input.employeeId, ctx.companyId);
    if (input.shiftId) await validateShiftId(input.shiftId, ctx.companyId);

    const start = input.from ? parseLocalDateParam(input.from) : undefined;
    const end = input.to ? parseLocalDateParam(input.to) : undefined;
    const employeeId = input.employeeId ? stringToBigint(input.employeeId) : undefined;
    const branchId = input.branchId ? stringToBigint(input.branchId) : undefined;
    const shiftId = input.shiftId ? stringToBigint(input.shiftId) : undefined;

    const where = {
      companyId: ctx.companyId,
      ...(employeeId ? { employeeId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(shiftId ? { shiftId } : {}),
      ...(start && end
        ? {
            date: {
              gte: start,
              lte: end,
            },
          }
        : {}),
    };

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          branchId: true,
          shiftId: true,
          date: true,
          overrideStart: true,
          overrideEnd: true,
          reason: true,
          incidentType: {
            select: {
              name: true,
              countsAsAbsence: true,
              excusesLate: true,
              excusesEarlyLeave: true,
            },
          },
        },
        orderBy: { date: "desc" },
        take: input.limit,
        skip: input.offset,
      }),
      prisma.incident.count({ where }),
    ]);

    return {
      content: [
        {
          type: "text",
          text: safeJson({ total, count: incidents.length, data: incidents }),
        },
      ],
    };
  },
};

export const TOOL_REGISTRY: Map<string, ToolHandler> = new Map(
  [
    getLateArrivals,
    getAbsences,
    getEarlyLeaves,
    getOpenDays,
    getEmployeeSummary,
    getBranchSummary,
    getDailySnapshot,
    getAttendanceRecords,
    findEmployee,
    getPresentNow,
    getIncidents,
    listEmployees,
    listBranches,
    getCompanyInfo,
  ].map((tool) => [tool.name, tool])
);

export function listToolDefinitions(): Array<{ name: string; description: string; inputSchema: object }> {
  return Array.from(TOOL_REGISTRY.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export function getTool(name: string): ToolHandler | undefined {
  return TOOL_REGISTRY.get(name);
}

export { invalidParams };
export { notFound };
