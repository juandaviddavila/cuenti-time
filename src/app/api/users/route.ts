import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { resolveEffectiveRole } from "@/lib/super-admin-access";
import { stringToBigint } from "@/lib/bigint";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  companyId: z.coerce.bigint().positive().nullish(),
  name: z.string().min(1).max(200),
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(8).max(128),
  role: z
    .enum([
      "SAAS_SUPER_ADMIN",
      "COMPANY_ADMIN",
      "BRANCH_SUPERVISOR",
      "FACE_REGISTRAR",
      "REPORT_VIEWER",
      "DEVELOPER",
    ])
    .default("REPORT_VIEWER"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  avatar: z.string().url().optional(),
  branchId: z.coerce.bigint().positive().nullish(),
  bypassGeofence: z.boolean().default(false),
  canManageIntegrations: z.boolean().default(false),
});

// ─── GET /api/users ────────────────────────────────────────────────────────────

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

  const companyFilter = getCompanyFilter(session);

  // Super admin can filter by explicit companyId param
  const queryCompanyId = searchParams.get("companyId") ?? undefined;
  const queryCompanyIdBigInt = queryCompanyId ? stringToBigint(queryCompanyId) : undefined;
  const resolvedCompanyFilter: Prisma.UserWhereInput =
    session.role === "SAAS_SUPER_ADMIN" && queryCompanyId
      ? { companyId: queryCompanyIdBigInt }
      : companyFilter;

  const where: Prisma.UserWhereInput = {
    ...resolvedCompanyFilter,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  try {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          companyId: true,
          name: true,
          email: true,
          role: true,
          status: true,
          avatar: true,
          branchId: true,
          bypassGeofence: true,
          canManageIntegrations: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          // Never return password hash
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      data: users.map((user) => ({
        ...user,
        role: resolveEffectiveRole(user.email, user.role),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST /api/users ───────────────────────────────────────────────────────────

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

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { password, companyId, role, ...rest } = parsed.data;

  if (role === "SAAS_SUPER_ADMIN") {
    return NextResponse.json(
      { error: "El acceso de super admin se configura en SUPER_ADMIN_EMAILS" },
      { status: 422 }
    );
  }

  // COMPANY_ADMIN can only create users for their own company
  if (session.role === "COMPANY_ADMIN") {
    if (companyId && companyId.toString() !== session.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const resolvedCompanyId =
    session.role === "SAAS_SUPER_ADMIN" ? (companyId ? BigInt(companyId) : null) : session.companyId ? BigInt(session.companyId) : null;

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        ...rest,
        role,
        companyId: resolvedCompanyId,
        password: hashedPassword,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        branchId: true,
        bypassGeofence: true,
        canManageIntegrations: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await createAuditLog({
      request,
      session,
      action: "CREATE",
      entity: "USER",
      entityId: user.id,
      companyId: user.companyId,
      newValues: { name: user.name, email: user.email, role: user.role, status: user.status },
    });
    return NextResponse.json(
      { ...user, role: resolveEffectiveRole(user.email, user.role) },
      { status: 201 }
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }
    console.error("POST /api/users error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
