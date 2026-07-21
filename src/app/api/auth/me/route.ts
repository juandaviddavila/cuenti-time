import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-auth";
import { stringToBigint, serializeRecord } from "@/lib/bigint";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: stringToBigint(session.userId) },
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

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Empresa del tenant activo: sesión (impersonación) o empresa del usuario.
  const activeCompanyId = session.companyId ?? user.companyId;

  let companyName: string | null = null;
  if (activeCompanyId) {
    const company = await prisma.company.findUnique({
      where: { id: stringToBigint(activeCompanyId) },
      select: { name: true },
    });
    companyName = company?.name ?? null;
  }

  let impersonation: {
    companyId: string;
    companyName: string;
    impersonatorUserId: string;
    impersonatorName: string;
  } | null = null;

  if (session.isImpersonating && session.impersonatorUserId && session.companyId) {
    const impersonator = await prisma.user.findUnique({
       where: { id: stringToBigint(session.impersonatorUserId) },
      select: { name: true },
    });

    if (companyName && impersonator) {
      impersonation = {
        companyId: session.companyId.toString(),
        companyName,
        impersonatorUserId: session.impersonatorUserId,
        impersonatorName: impersonator.name,
      };
    }
  }

  return NextResponse.json(serializeRecord({
    user: {
      ...user,
      role: session.role,
      companyId: activeCompanyId ?? user.companyId,
      companyName,
      createdAt: user.createdAt.toISOString(),
    },
    isImpersonating: session.isImpersonating,
    impersonation,
  }));
}
