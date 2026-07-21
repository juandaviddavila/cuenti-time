import { prisma } from "@/lib/prisma";
import { stringToBigint } from "@/lib/bigint";
import {
  calculateMaxEmployeesFromPlan,
  type BillingCycle,
} from "@/lib/pricing";

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export async function applyApprovedPayment(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: stringToBigint(paymentId) },
    include: { company: { select: { subscriptionExpiresAt: true, maxEmployees: true } } },
  });

  if (!payment || payment.status === "APPROVED") return;

  const billingCycle = payment.billingCycle as BillingCycle;
  const baseDate =
    payment.company.subscriptionExpiresAt &&
    payment.company.subscriptionExpiresAt.getTime() > Date.now()
      ? payment.company.subscriptionExpiresAt
      : new Date();

  const newExpiry =
    billingCycle === "yearly"
      ? addYears(baseDate, 1)
      : addMonths(baseDate, 1);

  const newMaxEmployees = calculateMaxEmployeesFromPlan(payment.additionalEmployees);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "APPROVED" },
    }),
    prisma.company.update({
      where: { id: payment.companyId },
      data: {
        subscriptionExpiresAt: newExpiry,
        maxEmployees: newMaxEmployees,
      },
    }),
  ]);
}
