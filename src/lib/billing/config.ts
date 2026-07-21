import { prisma } from "@/lib/prisma";
import type { BillingConfigCuenti, BillingConfigPublic } from "@/lib/billing/types";
import { BILLING_PERIOD_DAYS } from "@/lib/billing/pricing";

const DEFAULT_CONFIG = {
  freeEmployeeLimit: 3,
  priceCopPerEmployeeMonthly: 3500,
  priceUsdPerEmployeeMonthly: 1,
  tipoDocumento: 9,
  typeMatchProducto: 1,
  idConsecutivo: 1,
  idSucursal: 5,
  idBodega: 5,
  idVendedor: 1,
  idEmpleado: 1,
  idProductoCop: 123,
  idProductoUsd: 123,
  idConsecutivoLinkPago: 60,
  convertirRemisionFactura: 1,
  descripcionProducto: "cuenti time",
};

export async function ensureBillingConfig() {
  const existing = await prisma.billingConfig.findFirst({ orderBy: { id: "asc" } });
  if (existing) return existing;

  return prisma.billingConfig.create({ data: DEFAULT_CONFIG });
}

export async function getBillingConfig() {
  return ensureBillingConfig();
}

export function toBillingConfigPublic(
  config: Awaited<ReturnType<typeof getBillingConfig>>
): BillingConfigPublic {
  return {
    freeEmployeeLimit: config.freeEmployeeLimit,
    priceCopPerEmployeeMonthly: config.priceCopPerEmployeeMonthly,
    priceUsdPerEmployeeMonthly: config.priceUsdPerEmployeeMonthly,
    billingPeriodDays: BILLING_PERIOD_DAYS,
  };
}

export function toCuentiConfig(
  config: Awaited<ReturnType<typeof getBillingConfig>>
): BillingConfigCuenti {
  return {
    tipoDocumento: config.tipoDocumento,
    type_match_producto: config.typeMatchProducto,
    id_consecutivo: config.idConsecutivo,
    id_sucursal: config.idSucursal,
    id_bodega: config.idBodega,
    id_vendedor: config.idVendedor,
    id_empleado: config.idEmpleado,
    id_producto_cop: config.idProductoCop,
    id_producto_usd: config.idProductoUsd,
    id_consecutivo_link_pago: config.idConsecutivoLinkPago,
    convertir_remision_factura: config.convertirRemisionFactura,
    descripcion_producto: config.descripcionProducto,
  };
}
