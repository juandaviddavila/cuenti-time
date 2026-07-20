import { NextRequest, NextResponse } from "next/server";
import { startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { z } from "zod";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { parseLocalDateParam } from "@/lib/hr/local-date";
import { scheduleWebhookEvent } from "@/lib/webhooks/dispatch";

const attendanceSchema = z.object({
  employeeId: z.string().min(1),
  branchId: z.string().min(1),
  type: z.enum(["CHECK_IN", "CHECK_OUT"]),
  recordedAt: z.string().datetime().optional(),
});

class DuplicateRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateRecordError";
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const branchId = searchParams.get("branchId") ?? undefined;

  if (employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
  }

  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }
  }

  let recordedAt: { gte?: Date; lte?: Date } | undefined;
  if (date) {
    const d = parseLocalDateParam(date);
    recordedAt = { gte: startOfDay(d), lte: endOfDay(d) };
  } else if (from || to) {
    recordedAt = {
      ...(from ? { gte: startOfDay(parseLocalDateParam(from)) } : {}),
      ...(to ? { lte: endOfDay(parseLocalDateParam(to)) } : {}),
    };
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      companyId: auth.companyId,
      ...(employeeId ? { employeeId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(recordedAt ? { recordedAt } : {}),
    },
    orderBy: { recordedAt: "desc" },
    take: 500,
    include: {
      employee: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiToken(request, "write");
  if (!isApiTokenContext(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const parsed = attendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { employeeId, branchId, type, recordedAt } = parsed.data;

  const [employee, branch] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: employeeId, companyId: auth.companyId },
      select: { id: true, companyId: true, fullName: true, status: true },
    }),
    prisma.branch.findFirst({
      where: { id: branchId, companyId: auth.companyId },
      select: {
        id: true,
        companyId: true,
        status: true,
        duplicateWindowMinutes: true,
      },
    }),
  ]);

  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }
  if (employee.status === "INACTIVE") {
    return NextResponse.json({ error: "Empleado inactivo" }, { status: 422 });
  }
  if (!branch) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }
  if (branch.status === "INACTIVE") {
    return NextResponse.json({ error: "Sucursal inactiva" }, { status: 422 });
  }

  const at = recordedAt ? new Date(recordedAt) : new Date();
  const windowMinutes = branch.duplicateWindowMinutes;

  try {
    const record = await prisma.$transaction(async (tx) => {
      const dayStart = startOfDay(at);
      const dayEnd = endOfDay(at);

      const lastRecord = await tx.attendanceRecord.findFirst({
        where: {
          companyId: auth.companyId,
          employeeId,
          recordedAt: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { recordedAt: "desc" },
        select: { id: true, type: true, recordedAt: true },
      });

      const minutesSinceLast = lastRecord
        ? differenceInMinutes(at, lastRecord.recordedAt)
        : Infinity;
      const insideWindow = minutesSinceLast < windowMinutes;

      if (lastRecord?.type === type && insideWindow) {
        throw new DuplicateRecordError(
          type === "CHECK_IN"
            ? `Ya existe una entrada reciente de ${employee.fullName}. Debe esperar ${windowMinutes} minutos.`
            : `Ya existe una salida reciente de ${employee.fullName}. Debe esperar ${windowMinutes} minutos.`
        );
      }

      if (
        type === "CHECK_OUT" &&
        (!lastRecord || (lastRecord.type === "CHECK_OUT" && insideWindow))
      ) {
        throw new DuplicateRecordError(
          `El empleado ${employee.fullName} no tiene una entrada registrada hoy.`
        );
      }

      return tx.attendanceRecord.create({
        data: {
          companyId: auth.companyId,
          employeeId,
          branchId,
          type,
          recordedAt: at,
          isManual: false,
          deviceInfo: "api-v1",
        },
        include: {
          employee: { select: { fullName: true } },
          branch: { select: { name: true } },
        },
      });
    });

    await createAuditLog({
      request,
      session: null,
      action: "CREATE",
      entity: "ATTENDANCE",
      entityId: record.id,
      companyId: auth.companyId,
      newValues: { employeeId, branchId, type, source: "api-v1" },
    });

    scheduleWebhookEvent({
      companyId: auth.companyId,
      event:
        type === "CHECK_IN" ? "attendance.checked_in" : "attendance.checked_out",
      data: {
        id: record.id,
        employeeId: record.employeeId,
        branchId: record.branchId,
        type: record.type,
        recordedAt: record.recordedAt.toISOString(),
        employeeName: record.employee.fullName,
        branchName: record.branch.name,
        source: "api-v1",
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateRecordError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("POST /api/v1/attendance error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
