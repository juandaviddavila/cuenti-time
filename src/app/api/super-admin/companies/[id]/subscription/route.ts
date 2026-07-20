import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { createAuditLog } from "@/lib/audit";
import { getFaceQuotaStatus } from "@/lib/subscription";

const subscriptionSchema = z.object({
  subscriptionExpiresAt: z.string().datetime().nullable(),
  maxEmployees: z.number().int().min(1),
});

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.company.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      subscriptionExpiresAt: true,
      maxEmployees: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const company = await prisma.company.update({
    where: { id: params.id },
    data: {
      subscriptionExpiresAt: parsed.data.subscriptionExpiresAt
        ? new Date(parsed.data.subscriptionExpiresAt)
        : null,
      maxEmployees: parsed.data.maxEmployees,
    },
    include: {
      _count: { select: { branches: true, employees: true } },
    },
  });

  const quota = await getFaceQuotaStatus(company.id);

  await createAuditLog({
    request,
    session,
    action: "UPDATE_SUBSCRIPTION",
    entity: "COMPANY",
    entityId: company.id,
    companyId: company.id,
    oldValues: {
      subscriptionExpiresAt: existing.subscriptionExpiresAt?.toISOString() ?? null,
      maxEmployees: existing.maxEmployees,
    },
    newValues: {
      subscriptionExpiresAt: company.subscriptionExpiresAt?.toISOString() ?? null,
      maxEmployees: company.maxEmployees,
    },
  });

  return NextResponse.json({
    ...company,
    subscriptionExpiresAt: company.subscriptionExpiresAt?.toISOString() ?? null,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    quota,
  });
}
