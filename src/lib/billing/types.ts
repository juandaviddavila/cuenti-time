export type BillingCurrency = "COP" | "USD";
export type BillingInvoiceKind = "subscription" | "addon" | "renewal";
export type BillingInvoiceStatus = "pending" | "paid" | "cancelled" | "failed";
export type CompanyPlan = "free" | "paid";
export type SubscriptionStatus = "none" | "active" | "pending_payment" | "expired";
export type BillingPersonType = 1 | 2;

export interface BillingCustomerInput {
  nombre_cliente: string;
  identificacion: string;
  telefono1: string;
  id_tipo_persona: BillingPersonType;
}

export interface BillingQuoteInput {
  targetEmployeeSlots: number;
  currency: BillingCurrency;
}

export interface BillingCheckoutInput extends BillingQuoteInput {
  billingCustomer: BillingCustomerInput;
}

export interface BillingQuote {
  kind: BillingInvoiceKind;
  currency: BillingCurrency;
  targetEmployeeSlots: number;
  billedEmployeeQuantity: number;
  unitPrice: number;
  totalAmount: number;
  proratedDays: number | null;
  periodStart: string;
  periodEnd: string;
  minEmployeeSlots: number;
  currentEmployeeSlots: number;
  usedSlots: number;
  isProrated: boolean;
}

export interface BillingConfigPublic {
  freeEmployeeLimit: number;
  priceCopPerEmployeeMonthly: number;
  priceUsdPerEmployeeMonthly: number;
  /** Periodo de cobro en días (solo mensual). */
  billingPeriodDays: number;
}

export interface BillingConfigCuenti {
  tipoDocumento: number;
  type_match_producto: number;
  id_consecutivo: number;
  id_sucursal: number;
  id_bodega: number;
  id_vendedor: number;
  id_empleado: number;
  id_producto_cop: number;
  id_producto_usd: number;
  id_consecutivo_link_pago: number;
  convertir_remision_factura: number;
  descripcion_producto: string;
}

export interface BillingInvoiceDto {
  id: string;
  codigoUnico: string;
  companyId: string;
  status: BillingInvoiceStatus;
  kind: BillingInvoiceKind;
  currency: BillingCurrency;
  targetEmployeeSlots: number;
  billedEmployeeQuantity: number;
  unitPrice: number;
  totalAmount: number;
  proratedDays: number | null;
  periodStart: string;
  periodEnd: string;
  billingCustomer: BillingCustomerInput;
  paymentUrl: string | null;
  invoiceUrlExternal: string | null;
  cuentiTransactionId: number | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export const BILLING_INVOICE_ALREADY_PAID_MESSAGE =
  "La factura ya está pagada y no se puede cancelar";
export const BILLING_INVOICE_NOT_CANCELLABLE_MESSAGE =
  "Solo se pueden cancelar facturas pendientes";
