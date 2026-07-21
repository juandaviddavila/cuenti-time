import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { scheduleWebhookEvent } from "@/lib/webhooks/dispatch";
import { stringToBigint } from "@/lib/bigint";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createBranchSchema = z.object({
  companyId: z.coerce.bigint().positive(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  duplicateWindowMinutes: z.number().min(0.1).max(1440).default(10),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  googlePlaceId: z.string().max(255).optional(),
  radiusMeters: z.number().int().min(1).max(100000).optional(),
});

// ─── GET /api/branches ─────────────────────────────────────────────────────────

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
  const search = searchParams.get("search") ?? undefined;

  // Super admin can filter by an explicit companyId param; others are scoped
  const companyFilter = getCompanyFilter(session);

  // If super admin passes companyId as query param, narrow to that company
  const queryCompanyId = searchParams.get("companyId") ?? undefined;
  const queryCompanyIdBigInt = queryCompanyId ? stringToBigint(queryCompanyId) : undefined;
  const resolvedCompanyFilter: Prisma.BranchWhereInput =
    session.role === "SAAS_SUPER_ADMIN" && queryCompanyId
      ? { companyId: queryCompanyIdBigInt }
      : companyFilter;

  const where: Prisma.BranchWhereInput = {
    ...resolvedCompanyFilter,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { city: { contains: search } },
          ],
        }
      : {}),
  };

  try {
    const [branches, total] = await prisma.$transaction([
      prisma.branch.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { name: true } },
          _count: { select: { employees: true } },
        },
      }),
      prisma.branch.count({ where }),
    ]);

    return NextResponse.json({
      data: branches,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("GET /api/branches error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST /api/branches ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "SAAS_SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = createBranchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { companyId } = parsed.data;

  // Una cuenta de empresa solo puede crear sucursales en su propia companyId.
  const resolvedCompanyId =
    session.role === "COMPANY_ADMIN"
      ? (session.companyId ?? companyId)
      : companyId;

  if (!resolvedCompanyId) {
    return NextResponse.json({ error: "Empresa no definida" }, { status: 400 });
  }

  if (session.role === "COMPANY_ADMIN" && session.companyId !== resolvedCompanyId?.toString()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const branch = await prisma.branch.create({
      data: { ...parsed.data, companyId: BigInt(resolvedCompanyId) },
      include: {
        company: { select: { name: true } },
        _count: { select: { employees: true } },
      },
    });
    await createAuditLog({
      request,
      session,
      action: "CREATE",
      entity: "BRANCH",
      entityId: branch.id,
      companyId: branch.companyId,
      newValues: { name: branch.name, code: branch.code, status: branch.status },
    });
    scheduleWebhookEvent({
      companyId: branch.companyId,
      event: "branch.created",
      data: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        status: branch.status,
        city: branch.city,
        latitude: branch.latitude,
        longitude: branch.longitude,
        radiusMeters: branch.radiusMeters,
      },
    });
    return NextResponse.json(branch, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe una sucursal con ese código en esta empresa" },
        { status: 409 }
      );
    }
    console.error("POST /api/branches error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
