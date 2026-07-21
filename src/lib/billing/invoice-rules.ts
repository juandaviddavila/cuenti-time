import type { BillingInvoiceStatus } from "@/lib/billing/types";
import {
  BILLING_INVOICE_ALREADY_PAID_MESSAGE,
  BILLING_INVOICE_NOT_CANCELLABLE_MESSAGE,
} from "@/lib/billing/types";

export class BillingConflictError extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "BillingConflictError";
  }
}

export function assertInvoiceCancellable(invoice: {
  status: BillingInvoiceStatus | string;
  paidAt: Date | null;
}): void {
  if (invoice.status === "paid" || invoice.paidAt) {
    throw new BillingConflictError(BILLING_INVOICE_ALREADY_PAID_MESSAGE);
  }
  if (invoice.status !== "pending") {
    throw new BillingConflictError(BILLING_INVOICE_NOT_CANCELLABLE_MESSAGE);
  }
}
