export const BASE_INCLUDED_EMPLOYEES = 10;
export const BASE_MONTHLY_COP = 30_000;
export const ADDITIONAL_EMPLOYEE_MONTHLY_COP = 1_500;
export const ANNUAL_DISCOUNT = 0.2;

export type BillingCycle = "monthly" | "yearly";

export function calculateMonthlySubtotalCOP(additionalEmployees: number): number {
  return BASE_MONTHLY_COP + additionalEmployees * ADDITIONAL_EMPLOYEE_MONTHLY_COP;
}

export function calculatePlanTotalCOP(
  billingCycle: BillingCycle,
  additionalEmployees: number
): number {
  const monthly = calculateMonthlySubtotalCOP(additionalEmployees);
  if (billingCycle === "yearly") {
    return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));
  }
  return monthly;
}

export function copToWompiCents(amountCop: number): number {
  return Math.round(amountCop * 100);
}

export function calculateMaxEmployeesFromPlan(additionalEmployees: number): number {
  return BASE_INCLUDED_EMPLOYEES + additionalEmployees;
}

export function formatCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}
