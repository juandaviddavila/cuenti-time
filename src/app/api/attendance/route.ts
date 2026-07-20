import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireSession, userBypassesGeofence } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { distanceInMeters } from "@/lib/geo";
import { isMobileUserAgent } from "@/lib/device";
import { scheduleWebhookEvent } from "@/lib/webhooks/dispatch";

const createAttendanceSchema = z.object({
  employeeId: z.string().cuid(),
  branchId: z.string().cuid(),
  type: z.enum(["CHECK_IN", "CHECK_OUT"]),
  confidenceScore: z.number().min(0).max(1).optional(),
  livenessScore: z.number().min(0).max(1).optional(),
  validationStatus: z
    .enum([
      "SUCCESS",
      "FAILED",
      "LOW_CONFIDENCE",
      "LIVENESS_FAILED",
      "SPOOFING_DETECTED",
      "FACE_NOT_FOUND",
      "MULTIPLE_FACES",
    ])
    .default("SUCCESS"),
  deviceInfo: z.string().max(200).optional(),
  /** Si es desktop, no se exige GPS (poco fiable fuera de móvil). */
  deviceClass: z.enum(["mobile", "desktop"]).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isManual: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = createAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { employeeId, branchId, type, deviceClass: bodyDeviceClass, ...rest } = parsed.data;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, companyId: true, branchId: true, status: true, fullName: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    employee.companyId !== session.companyId
  ) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  if (employee.status === "INACTIVE") {
    return NextResponse.json(
      { error: "El empleado está inactivo y no puede marcar asistencia" },
      { status: 422 }
    );
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      companyId: true,
      duplicateWindowMinutes: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
    },
  });

  if (!branch || branch.companyId !== employee.companyId) {
    return NextResponse.json({ error: "Sucursal no válida" }, { status: 422 });
  }

  const windowMinutes = branch.duplicateWindowMinutes;
  const branchHasGeofence = branch.latitude !== null && branch.longitude !== null;
  const skipGeofence = await userBypassesGeofence(session.userId);
  const deviceClass =
    bodyDeviceClass ??
    (isMobileUserAgent(request.headers.get("user-agent")) ? "mobile" : "desktop");
  const enforceGeofence = branchHasGeofence && !skipGeofence && deviceClass === "mobile";
  let distanceFromBranch: number | null = null;

  if (enforceGeofence) {
    if (rest.latitude === undefined || rest.longitude === undefined) {
      return NextResponse.json(
        { error: "No se recibió ubicación GPS para validar la sucursal" },
        { status: 422 }
      );
    }

    distanceFromBranch = Math.round(distanceInMeters(
      { latitude: rest.latitude, longitude: rest.longitude },
      { latitude: branch.latitude as number, longitude: branch.longitude as number }
    ));

    if (distanceFromBranch > branch.radiusMeters) {
      return NextResponse.json(
        { error: `La ubicación está fuera del radio permitido (${distanceFromBranch} m de ${branch.radiusMeters} m)` },
        { status: 422 }
      );
    }
  } else if (
    branchHasGeofence &&
    !skipGeofence &&
    rest.latitude !== undefined &&
    rest.longitude !== undefined
  ) {
    // Si llega GPS en desktop, se guarda distancia informativa pero no se bloquea.
    distanceFromBranch = Math.round(distanceInMeters(
      { latitude: rest.latitude, longitude: rest.longitude },
      { latitude: branch.latitude as number, longitude: branch.longitude as number }
    ));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);

      const lastRecord = await tx.attendanceRecord.findFirst({
        where: { employeeId, recordedAt: { gte: todayStart, lte: todayEnd } },
        orderBy: { recordedAt: "desc" },
        select: { id: true, type: true, recordedAt: true },
      });

      const minutesSinceLastRecord = lastRecord ? differenceInMinutes(today, lastRecord.recordedAt) : Infinity;
      const insideWindow = minutesSinceLastRecord < windowMinutes;

      // Anti-double-tap window logic
      if (lastRecord?.type === type) {
        if (insideWindow) {
          throw new DuplicateRecordError(
            type === "CHECK_IN"
              ? `Ya existe una entrada reciente de ${employee.fullName}. Debe esperar ${windowMinutes} minutos para marcar otra entrada.`
              : `Ya existe una salida reciente de ${employee.fullName}. Debe esperar ${windowMinutes} minutos para marcar otra salida.`
          );
        }
        // Outside window: same type can flip to a new session (next-day behaviour)
      }

      // Cannot checkout without a prior check-in today
      if (type === "CHECK_OUT" && (!lastRecord || (lastRecord.type === "CHECK_OUT" && insideWindow))) {
        throw new DuplicateRecordError(
          `El empleado ${employee.fullName} no tiene una entrada registrada hoy. Primero debe registrar una entrada.`
        );
      }

      const record = await tx.attendanceRecord.create({
        data: {
          companyId: employee.companyId,
          branchId,
          employeeId,
          type,
          ...rest,
          distanceFromBranch,
          ipAddress:
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            request.headers.get("x-real-ip") ??
            null,
        },
        include: {
          employee: { select: { fullName: true, photo: true, documentNumber: true, position: { select: { name: true } } } },
          branch: { select: { name: true } },
        },
      });

      return record;
    });

    scheduleWebhookEvent({
      companyId: result.companyId,
      event:
        type === "CHECK_IN" ? "attendance.checked_in" : "attendance.checked_out",
      data: {
        id: result.id,
        employeeId: result.employeeId,
        branchId: result.branchId,
        type: result.type,
        recordedAt: result.recordedAt.toISOString(),
        employeeName: result.employee.fullName,
        branchName: result.branch.name,
        source: "dashboard",
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateRecordError) {
      await createAuditLog({
        request,
        session,
        action: "DUPLICATE_ATTENDANCE",
        entity: "ATTENDANCE",
        entityId: employeeId,
        newValues: { employeeId, branchId, type, reason: err.message },
      });
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Attendance error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

class DuplicateRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateRecordError";
  }
}

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const branchId = searchParams.get("branchId") ?? undefined;
  const date = searchParams.get("date");

  const companyId =
    session.role === "SAAS_SUPER_ADMIN" ? undefined : session.companyId ?? undefined;

  const dateFilter = date
    ? {
        gte: startOfDay(new Date(date)),
        lte: endOfDay(new Date(date)),
      }
    : undefined;

  const [records, total] = await prisma.$transaction([
    prisma.attendanceRecord.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(dateFilter ? { recordedAt: dateFilter } : {}),
      },
      orderBy: { recordedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: { select: { fullName: true, photo: true, documentNumber: true, position: { select: { name: true } } } },
        branch: { select: { name: true } },
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(dateFilter ? { recordedAt: dateFilter } : {}),
      },
    }),
  ]);

  return NextResponse.json({
    data: records,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
