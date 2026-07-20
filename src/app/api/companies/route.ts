import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200),
  taxId: z.string().min(1).max(50),
  email: z.string().email().max(254),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default("Colombia"),
  logo: z.string().url().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  maxEmployees: z.number().int().min(1).default(10),
});

// ─── GET /api/companies ────────────────────────────────────────────────────────

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

  // Non-super-admin only sees their own company
  const companyFilter = getCompanyFilter(session);

  const where: Prisma.CompanyWhereInput = {
    ...companyFilter,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { legalName: { contains: search } },
            { taxId: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  try {
    const [companies, total] = await prisma.$transaction([
      prisma.company.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { branches: true, employees: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return NextResponse.json({
      data: companies,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("GET /api/companies error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST /api/companies ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "SAAS_SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const company = await prisma.$transaction(async (tx) => {
      const createdCompany = await tx.company.create({
        data: parsed.data,
        include: {
          _count: { select: { branches: true, employees: true } },
        },
      });

      await tx.position.create({
        data: {
          companyId: createdCompany.id,
          name: "general",
          active: true,
        },
      });

      await tx.incidentType.create({
        data: {
          companyId: createdCompany.id,
          name: "general",
          active: true,
        },
      });

      return createdCompany;
    });

    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe una empresa con ese taxId" },
        { status: 409 }
      );
    }
    console.error("POST /api/companies error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
