import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { createAuthenticatedLoginResponse } from "@/lib/login-session";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.isImpersonating || !session.impersonatorUserId) {
    return NextResponse.json({ error: "No hay impersonación activa" }, { status: 400 });
  }

  const superAdmin = await prisma.user.findUnique({
    where: { id: session.impersonatorUserId },
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
      emailVerifiedAt: true,
    },
  });

  if (!superAdmin || superAdmin.role !== "SAAS_SUPER_ADMIN" || !superAdmin.emailVerifiedAt) {
    return NextResponse.json({ error: "Sesión de super admin inválida" }, { status: 403 });
  }

  await createAuditLog({
    request,
    session: {
      ...session,
      userId: session.impersonatorUserId,
      role: "SAAS_SUPER_ADMIN",
      companyId: null,
      isImpersonating: false,
    },
    action: "IMPERSONATE_STOP",
    entity: "COMPANY",
    entityId: session.companyId,
    companyId: session.companyId,
    oldValues: {
      impersonatedUserId: session.userId,
      impersonatedEmail: session.email,
    },
  });

  return createAuthenticatedLoginResponse(superAdmin);
}
