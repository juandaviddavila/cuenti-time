import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { createAuditLog } from "@/lib/audit";
import { createAuthenticatedLoginResponse } from "@/lib/login-session";

const impersonateSchema = z.object({
  companyId: z.coerce.bigint().positive(),
});

export async function POST(request: NextRequest) {
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

  const parsed = impersonateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true, name: true, status: true },
  });

  if (!company) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      companyId: company.id,
      role: "COMPANY_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      avatar: true,
      status: true,
      bypassGeofence: true,
      canManageIntegrations: true,
      createdAt: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: "La empresa no tiene un administrador activo para impersonar" },
      { status: 422 }
    );
  }

  await createAuditLog({
    request,
    session: { ...session, userId: session.userId },
    action: "IMPERSONATE_START",
    entity: "COMPANY",
    entityId: company.id,
    companyId: company.id,
    newValues: {
      impersonatedUserId: targetUser.id,
      impersonatedEmail: targetUser.email,
      companyName: company.name,
    },
  });

  return createAuthenticatedLoginResponse(targetUser, {
    impersonatorId: session.userId.toString(),
  });
}
