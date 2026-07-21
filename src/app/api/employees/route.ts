import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { canRegisterAdditionalFace, canAddEmployee, requireActiveCompanySubscription } from "@/lib/subscription";
import { scheduleWebhookEvent } from "@/lib/webhooks/dispatch";
import { stringToBigint } from "@/lib/bigint";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createEmployeeSchema = z.object({
  companyId: z.coerce.bigint().positive(),
  branchId: z.coerce.bigint().positive(),
  fullName: z.string().min(1).max(200),
  documentType: z.enum(["CC", "CE", "PASSPORT", "NIT", "OTHER"]).default("CC"),
  documentNumber: z.string().min(1).max(50),
  // Puede ser cuid o id fijo del seed/registro (p.ej. pos-general-<companyId>)
  positionId: z.coerce.bigint().positive().nullish().or(z.literal("").transform(() => null)),
  email: z.string().email().max(254).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().max(20).optional().or(z.literal("").transform(() => undefined)),
  photo: z
    .string()
    .max(5_000_000, "La foto es demasiado grande")
    .refine(
      value => value.startsWith("data:image/") || /^https?:\/\//.test(value),
      "La foto debe ser una imagen válida"
    )
    .optional()
    .nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  faceRegistered: z.boolean().default(false),
  hireDate: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  internalCode: z.string().max(50).optional().or(z.literal("").transform(() => undefined)),
});

// ─── GET /api/employees ────────────────────────────────────────────────────────

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
  const branchId = searchParams.get("branchId") ?? undefined;
  const branchIdBigInt = branchId ? stringToBigint(branchId) : undefined;
  const status = searchParams.get("status") ?? undefined;
  const faceRegisteredParam = searchParams.get("faceRegistered");
  const search = searchParams.get("search") ?? undefined;

  const companyFilter = getCompanyFilter(session);

  const faceRegisteredFilter =
    faceRegisteredParam === "true"
      ? true
      : faceRegisteredParam === "false"
        ? false
        : undefined;

  const where: Prisma.EmployeeWhereInput = {
    ...companyFilter,
    ...(branchId ? { branchId: branchIdBigInt } : {}),
    ...(status === "ACTIVE" || status === "INACTIVE" ? { status } : {}),
    ...(faceRegisteredFilter !== undefined ? { faceRegistered: faceRegisteredFilter } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search } },
            { documentNumber: { contains: search } },
            { internalCode: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  try {
    const [employees, total] = await prisma.$transaction([
      prisma.employee.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          branch: { select: { name: true } },
          position: { select: { id: true, name: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return NextResponse.json({
      data: employees,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST /api/employees ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    session.role !== "SAAS_SUPER_ADMIN" &&
    session.role !== "COMPANY_ADMIN" &&
    session.role !== "FACE_REGISTRAR"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { companyId, branchId, positionId } = parsed.data;

  // Non-platform roles can only create employees in their own company
  if (session.role !== "SAAS_SUPER_ADMIN" && session.companyId !== companyId.toString()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subscription = await requireActiveCompanySubscription(session);
  if (!subscription.ok) {
    return NextResponse.json(
      { error: subscription.error, code: subscription.code },
      { status: subscription.status }
    );
  }

  const slotLimit = await canAddEmployee(companyId);
  if (!slotLimit.ok) {
    return NextResponse.json(
      { error: slotLimit.error, code: slotLimit.code },
      { status: slotLimit.status }
    );
  }

  if (parsed.data.faceRegistered) {
    const faceLimit = await canRegisterAdditionalFace(companyId);
    if (!faceLimit.ok) {
      return NextResponse.json(
        { error: faceLimit.error, code: faceLimit.code },
        { status: faceLimit.status }
      );
    }
  }

  // Verify the branch belongs to the same company
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { companyId: true },
  });

  if (!branch || branch.companyId !== companyId) {
    return NextResponse.json(
      { error: "La sucursal no pertenece a la empresa indicada" },
      { status: 422 }
    );
  }

  // Verify the position belongs to the same company
  if (positionId) {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: { companyId: true, active: true },
    });
    if (!position || position.companyId !== companyId) {
      return NextResponse.json(
        { error: "El cargo no pertenece a la empresa indicada" },
        { status: 422 }
      );
    }
  }

  try {
    const employee = await prisma.employee.create({
      data: {
        ...parsed.data,
        hireDate: parsed.data.hireDate ? new Date(parsed.data.hireDate) : undefined,
      },
      include: {
        branch: { select: { name: true } },
        position: { select: { id: true, name: true } },
      },
    });
    await createAuditLog({
      request,
      session,
      action: "CREATE",
      entity: "EMPLOYEE",
      entityId: employee.id,
      companyId: employee.companyId,
      newValues: { fullName: employee.fullName, documentNumber: employee.documentNumber, branchId: employee.branchId, positionId: employee.positionId },
    });
    scheduleWebhookEvent({
      companyId: employee.companyId,
      event: "employee.created",
      data: {
        id: employee.id,
        fullName: employee.fullName,
        documentNumber: employee.documentNumber,
        branchId: employee.branchId,
        positionId: employee.positionId,
        status: employee.status,
        faceRegistered: employee.faceRegistered,
      },
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un empleado con ese número de documento en esta empresa" },
        { status: 409 }
      );
    }
    console.error("POST /api/employees error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
