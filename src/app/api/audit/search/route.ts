import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const auditSearchSchema = z.object({
  from: z.string().regex(ISO_DATE_REGEX, "Formato de fecha inválido").optional(),
  to: z.string().regex(ISO_DATE_REGEX, "Formato de fecha inválido").optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  branchId: z.string().cuid().optional(),
  employeeId: z.string().optional(), // single id or comma-separated list
  companyId: z.string().cuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── GET /api/audit/search ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const parsed = auditSearchSchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    action: searchParams.get("action") ?? undefined,
    entity: searchParams.get("entity") ?? undefined,
    branchId: searchParams.get("branchId") ?? undefined,
    employeeId: searchParams.get("employeeId") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? "1",
    pageSize: searchParams.get("pageSize") ?? "20",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { from, to, action, entity, branchId, employeeId, companyId, search, page, pageSize } =
    parsed.data;

  const employeeIds = Array.from(
    new Set(
      [
        ...(employeeId
          ? employeeId.split(",").map((s) => s.trim()).filter(Boolean)
          : []),
        ...searchParams
          .getAll("employeeId")
          .flatMap((v) => v.split(","))
          .map((s) => s.trim())
          .filter(Boolean),
      ]
    )
  );

  // Multi-tenant safety: only SAAS_SUPER_ADMIN may explicitly scope to another company
  const companyFilter = getCompanyFilter(session);
  const resolvedCompanyFilter: Prisma.AuditLogWhereInput =
    session.role === "SAAS_SUPER_ADMIN" && companyId
      ? { companyId }
      : companyFilter;

  const entityIdFilters: Prisma.AuditLogWhereInput[] = [];
  if (branchId) {
    entityIdFilters.push({ entity: "BRANCH", entityId: branchId });
  }
  if (employeeIds.length === 1) {
    entityIdFilters.push({ entity: "EMPLOYEE", entityId: employeeIds[0] });
  } else if (employeeIds.length > 1) {
    entityIdFilters.push({ entity: "EMPLOYEE", entityId: { in: employeeIds } });
  }

  const where: Prisma.AuditLogWhereInput = {
    ...resolvedCompanyFilter,
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(entityIdFilters.length > 0 ? { OR: entityIdFilters } : {}),
    ...(search
      ? {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { entity: { contains: search, mode: "insensitive" } },
            { action: { contains: search, mode: "insensitive" } },
            { entityId: { contains: search, mode: "insensitive" } },
            { ipAddress: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        oldValues: l.oldValues,
        newValues: l.newValues,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        userId: l.userId,
        userName: l.user?.name ?? "Sistema",
        userEmail: l.user?.email,
        companyId: l.companyId,
        companyName: l.company?.name,
        createdAt: l.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("GET /api/audit/search error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
