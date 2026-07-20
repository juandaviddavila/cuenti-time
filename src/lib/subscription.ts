import { prisma } from "@/lib/prisma";
import type { ServerSession } from "@/lib/server-auth";

export type SubscriptionGuardResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      code: "COMPANY_NOT_FOUND" | "SUBSCRIPTION_EXPIRED" | "FACE_REGISTRATION_LIMIT_REACHED";
    };

export function isSubscriptionExpired(expiresAt: Date | null | undefined): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

export async function requireActiveCompanySubscription(
  session: ServerSession
): Promise<SubscriptionGuardResult> {
  if (session.role === "SAAS_SUPER_ADMIN" || !session.companyId) {
    return { ok: true };
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { subscriptionExpiresAt: true },
  });

  if (!company) {
    return {
      ok: false,
      status: 404,
      error: "Empresa no encontrada",
      code: "COMPANY_NOT_FOUND",
    };
  }

  if (isSubscriptionExpired(company.subscriptionExpiresAt)) {
    return {
      ok: false,
      status: 402,
      error: "La suscripción de la empresa está vencida",
      code: "SUBSCRIPTION_EXPIRED",
    };
  }

  return { ok: true };
}

export async function hasExpiredCompanySubscription(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionExpiresAt: true },
  });

  return isSubscriptionExpired(company?.subscriptionExpiresAt);
}

export async function getFaceQuotaStatus(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { maxEmployees: true },
  });

  if (!company) return null;

  const registeredFaces = await prisma.employee.count({
    where: { companyId, status: "ACTIVE", faceRegistered: true },
  });

  return {
    maxEmployees: company.maxEmployees,
    registeredFaces,
    overQuota: registeredFaces > company.maxEmployees,
    canRegister: registeredFaces < company.maxEmployees,
    excessCount: Math.max(0, registeredFaces - company.maxEmployees),
  };
}

export async function canRegisterAdditionalFace(companyId: string): Promise<SubscriptionGuardResult> {
  const quota = await getFaceQuotaStatus(companyId);

  if (!quota) {
    return {
      ok: false,
      status: 404,
      error: "Empresa no encontrada",
      code: "COMPANY_NOT_FOUND",
    };
  }

  if (!quota.canRegister) {
    const error =
      quota.excessCount > 0
        ? `Cupo de ${quota.maxEmployees} empleados con rostro. Tiene ${quota.registeredFaces} activos con rostro registrado. Inactive ${quota.excessCount} empleado(s) antes de registrar uno nuevo.`
        : `Límite de ${quota.maxEmployees} empleados con registro facial alcanzado.`;

    return {
      ok: false,
      status: 402,
      error,
      code: "FACE_REGISTRATION_LIMIT_REACHED",
    };
  }

  return { ok: true };
}
