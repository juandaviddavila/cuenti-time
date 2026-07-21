import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { stringToBigint } from "@/lib/bigint";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const shiftSchema = z.object({
  name: z.string().min(1).max(100),
  mondayStart: z.string().regex(timePattern).optional().nullable(),
  mondayEnd: z.string().regex(timePattern).optional().nullable(),
  tuesdayStart: z.string().regex(timePattern).optional().nullable(),
  tuesdayEnd: z.string().regex(timePattern).optional().nullable(),
  wednesdayStart: z.string().regex(timePattern).optional().nullable(),
  wednesdayEnd: z.string().regex(timePattern).optional().nullable(),
  thursdayStart: z.string().regex(timePattern).optional().nullable(),
  thursdayEnd: z.string().regex(timePattern).optional().nullable(),
  fridayStart: z.string().regex(timePattern).optional().nullable(),
  fridayEnd: z.string().regex(timePattern).optional().nullable(),
  saturdayStart: z.string().regex(timePattern).optional().nullable(),
  saturdayEnd: z.string().regex(timePattern).optional().nullable(),
  sundayStart: z.string().regex(timePattern).optional().nullable(),
  sundayEnd: z.string().regex(timePattern).optional().nullable(),
  active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyFilter = getCompanyFilter(session);
  const { searchParams } = new URL(request.url);
  const active = searchParams.get("active");

  try {
    const shifts = await prisma.shift.findMany({
      where: {
        ...companyFilter,
        ...(active ? { active: active === "true" } : {}),
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: shifts });
  } catch (err) {
    console.error("GET /api/shifts error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

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
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = shiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const companyId = session.role === "SAAS_SUPER_ADMIN" && body && typeof body === "object" && "companyId" in body
    ? (body as { companyId?: string }).companyId ?? session.companyId
    : session.companyId;

  if (!companyId) {
    return NextResponse.json({ error: "No se pudo determinar la empresa" }, { status: 422 });
  }

  try {
    const companyIdBigInt = stringToBigint(companyId);
    const shift = await prisma.shift.create({
      data: { companyId: companyIdBigInt, ...parsed.data },
    });
    await createAuditLog({
      request,
      session,
      action: "CREATE",
      entity: "SHIFT",
      entityId: shift.id,
      companyId: companyIdBigInt,
      newValues: { name: shift.name },
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (err) {
    console.error("POST /api/shifts error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
