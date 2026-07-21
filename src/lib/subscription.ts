import { prisma } from "@/lib/prisma";
import type { ServerSession } from "@/lib/server-auth";
import { syncCompanySubscriptionStatus } from "@/lib/billing/service";
import { stringToBigint } from "@/lib/bigint";

export type SubscriptionGuardResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      code:
        | "COMPANY_NOT_FOUND"
        | "SUBSCRIPTION_EXPIRED"
        | "FACE_REGISTRATION_LIMIT_REACHED"
        | "EMPLOYEE_SLOT_LIMIT_REACHED"
        | "PAID_PLAN_REQUIRED";
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

  let company = await prisma.company.findUnique({
    where: { id: stringToBigint(session.companyId) },
  });

  if (!company) {
    return {
      ok: false,
      status: 404,
      error: "Empresa no encontrada",
      code: "COMPANY_NOT_FOUND",
    };
  }

  company = await syncCompanySubscriptionStatus(company);

  if (company.plan === "free") {
    return { ok: true };
  }

  if (
    company.subscriptionStatus === "expired" ||
    isSubscriptionExpired(company.subscriptionExpiresAt)
  ) {
    return {
      ok: false,
      status: 402,
      error: "La suscripción de la empresa está vencida",
      code: "SUBSCRIPTION_EXPIRED",
    };
  }

  return { ok: true };
}

export async function requirePaidActivePlan(
  session: ServerSession
): Promise<SubscriptionGuardResult> {
  if (session.role === "SAAS_SUPER_ADMIN") {
    return { ok: true };
  }
  if (!session.companyId) {
    return {
      ok: false,
      status: 403,
      error: "Se requiere plan de pago con suscripción activa (API y MCP)",
      code: "PAID_PLAN_REQUIRED",
    };
  }

  let company = await prisma.company.findUnique({
    where: { id: stringToBigint(session.companyId) },
  });
  if (!company) {
    return {
      ok: false,
      status: 404,
      error: "Empresa no encontrada",
      code: "COMPANY_NOT_FOUND",
    };
  }

  company = await syncCompanySubscriptionStatus(company);

  if (
    company.plan !== "paid" ||
    company.subscriptionStatus !== "active" ||
    isSubscriptionExpired(company.subscriptionExpiresAt)
  ) {
    return {
      ok: false,
      status: 402,
      error:
        "API, MCP y webhooks requieren plan de pago activo. Actualiza tu cupo en /pricing.",
      code: "PAID_PLAN_REQUIRED",
    };
  }

  return { ok: true };
}

export async function hasExpiredCompanySubscription(companyId: bigint): Promise<boolean> {
  let company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return false;
  company = await syncCompanySubscriptionStatus(company);
  if (company.plan === "free") return false;
  return (
    company.subscriptionStatus === "expired" ||
    isSubscriptionExpired(company.subscriptionExpiresAt)
  );
}

export async function getEmployeeQuotaStatus(companyId: bigint) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { maxEmployees: true },
  });

  if (!company) return null;

  const activeEmployees = await prisma.employee.count({
    where: { companyId, status: "ACTIVE" },
  });

  const registeredFaces = await prisma.employee.count({
    where: { companyId, status: "ACTIVE", faceRegistered: true },
  });

  return {
    maxEmployees: company.maxEmployees,
    activeEmployees,
    registeredFaces,
    overQuota: activeEmployees > company.maxEmployees,
    canAddEmployee: activeEmployees < company.maxEmployees,
    canRegisterFace: registeredFaces < company.maxEmployees,
    excessCount: Math.max(0, activeEmployees - company.maxEmployees),
  };
}

/** @deprecated Prefer getEmployeeQuotaStatus — el cupo ahora es por empleados activos. */
export async function getFaceQuotaStatus(companyId: bigint) {
  const quota = await getEmployeeQuotaStatus(companyId);
  if (!quota) return null;
  return {
    maxEmployees: quota.maxEmployees,
    registeredFaces: quota.registeredFaces,
    overQuota: quota.registeredFaces > quota.maxEmployees,
    canRegister: quota.canRegisterFace,
    excessCount: Math.max(0, quota.registeredFaces - quota.maxEmployees),
  };
}

export async function canAddEmployee(companyId: bigint): Promise<SubscriptionGuardResult> {
  const quota = await getEmployeeQuotaStatus(companyId);

  if (!quota) {
    return {
      ok: false,
      status: 404,
      error: "Empresa no encontrada",
      code: "COMPANY_NOT_FOUND",
    };
  }

  if (!quota.canAddEmployee) {
    return {
      ok: false,
      status: 402,
      error: `Cupo de ${quota.maxEmployees} empleado(s) alcanzado (${quota.activeEmployees} activos). Compra cupos adicionales en /pricing antes de registrar más.`,
      code: "EMPLOYEE_SLOT_LIMIT_REACHED",
    };
  }

  return { ok: true };
}

export async function canRegisterAdditionalFace(
  companyId: bigint
): Promise<SubscriptionGuardResult> {
  const quota = await getEmployeeQuotaStatus(companyId);

  if (!quota) {
    return {
      ok: false,
      status: 404,
      error: "Empresa no encontrada",
      code: "COMPANY_NOT_FOUND",
    };
  }

  if (!quota.canRegisterFace) {
    const error =
      quota.excessCount > 0
        ? `Cupo de ${quota.maxEmployees} empleados. Tiene ${quota.registeredFaces} con rostro. Inactive empleados o compra cupos en /pricing.`
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
