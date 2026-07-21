"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, Loader2, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type {
  BillingCurrency,
  BillingInvoiceDto,
  BillingQuote,
} from "@/lib/billing/types";

function formatMoney(amount: number, currency: BillingCurrency): string {
  if (currency === "COP") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface BillingStatus {
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  maxEmployees: number;
  usedSlots: number;
  freeEmployeeLimit: number;
  hasPendingInvoice: boolean;
  pendingInvoice: BillingInvoiceDto | null;
  publicConfig: {
    freeEmployeeLimit: number;
    priceCopPerEmployeeMonthly: number;
    priceUsdPerEmployeeMonthly: number;
    billingPeriodDays: number;
  };
}

interface Props {
  isLoggedIn: boolean;
}

export function PricingClient({ isLoggedIn }: Props) {
  const [currency, setCurrency] = useState<BillingCurrency>("COP");
  const [slots, setSlots] = useState(4);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [customer, setCustomer] = useState({
    nombre_cliente: "",
    identificacion: "",
    telefono1: "",
    id_tipo_persona: 1 as 1 | 2,
  });

  const unitPrice = useMemo(() => {
    if (!status) return null;
    return currency === "COP"
      ? status.publicConfig.priceCopPerEmployeeMonthly
      : status.publicConfig.priceUsdPerEmployeeMonthly;
  }, [currency, status]);

  const monthlyPreview = useMemo(() => {
    if (unitPrice === null) return null;
    const amount =
      currency === "COP"
        ? Math.round(slots * unitPrice)
        : Math.round(slots * unitPrice * 100) / 100;
    return amount;
  }, [slots, unitPrice, currency]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/billing/config");
        const json = await res.json();
        if (res.ok && json.data) {
          setStatus((prev) =>
            prev
              ? { ...prev, publicConfig: json.data, freeEmployeeLimit: json.data.freeEmployeeLimit }
              : {
                  plan: "free",
                  subscriptionStatus: "none",
                  subscriptionExpiresAt: null,
                  maxEmployees: json.data.freeEmployeeLimit,
                  usedSlots: 0,
                  freeEmployeeLimit: json.data.freeEmployeeLimit,
                  hasPendingInvoice: false,
                  pendingInvoice: null,
                  publicConfig: json.data,
                }
          );
        }
      } catch {
        /* fallback UI */
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    void (async () => {
      try {
        const res = await fetch("/api/billing");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "No se pudo cargar billing");
        setStatus(json.data);
        setSlots(Math.max(json.data.usedSlots || 1, json.data.maxEmployees || 4, 4));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar plan");
      }
    })();
  }, [isLoggedIn]);

  async function refreshQuote() {
    if (!isLoggedIn) return;
    setQuoting(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          targetEmployeeSlots: slots,
          currency,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Cotización fallida");
      setQuote(json.data);
    } catch (err) {
      setQuote(null);
      toast.error(err instanceof Error ? err.message : "Error al cotizar");
    } finally {
      setQuoting(false);
    }
  }

  async function handleCheckout() {
    if (!isLoggedIn) {
      toast.error("Inicia sesión con tu cuenta de empresa para pagar");
      return;
    }
    if (!customer.nombre_cliente || !customer.identificacion || !customer.telefono1) {
      toast.error("Completa los datos de facturación");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          targetEmployeeSlots: slots,
          currency,
          billingCustomer: customer,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo iniciar el pago");
      const invoice = json.data as BillingInvoiceDto;
      if (invoice.paymentUrl) {
        window.location.href = invoice.paymentUrl;
        return;
      }
      toast.error("No se recibió link de pago");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al pagar");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelPending() {
    if (!status?.pendingInvoice) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/billing/invoices/${status.pendingInvoice.id}/cancel`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo cancelar");
      toast.success("Pago pendiente cancelado");
      const refresh = await fetch("/api/billing");
      const refreshed = await refresh.json();
      if (refresh.ok) setStatus(refreshed.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setLoading(false);
    }
  }

  const freeLimit = status?.freeEmployeeLimit ?? 3;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
            <Scan className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Planes cuenti time</h1>
            <p className="text-slate-400">
              Gratis hasta {freeLimit} empleados. Plan de pago mensual por empleado (API y MCP incluidos).
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Plan gratis</p>
            <h2 className="mt-3 text-2xl font-bold">Hasta {freeLimit} empleados</h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              {[
                "Marcaciones, sucursales y reportes básicos",
                "Registro facial dentro del cupo",
                "Sin API pública ni MCP",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
            {!isLoggedIn ? (
              <Button asChild className="mt-8 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                <Link href="/register">Crear cuenta gratis</Link>
              </Button>
            ) : (
              <p className="mt-8 text-sm text-slate-400">
                Tu empresa: plan <strong>{status?.plan ?? "…"}</strong> · cupo{" "}
                {status?.usedSlots ?? "…"}/{status?.maxEmployees ?? "…"}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-orange-500/30 bg-slate-900/70 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Plan de pago</p>
            <h2 className="mt-3 text-2xl font-bold">
              {unitPrice === null ? "Consultando…" : formatMoney(unitPrice, currency)}
              <span className="text-base font-normal text-slate-400"> / empleado / mes</span>
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Cobro solo mensual
              {status?.publicConfig.billingPeriodDays
                ? ` (${status.publicConfig.billingPeriodDays} días)`
                : ""}
              . Empleados adicionales a mitad de periodo se prorratean.
            </p>

            <div className="mt-6 flex gap-2">
              {(["COP", "USD"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    currency === c ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="slots">Empleados a facturar</Label>
                <Input
                  id="slots"
                  type="number"
                  min={1}
                  max={5000}
                  value={slots}
                  onChange={(e) => setSlots(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-2 border-slate-700 bg-slate-950"
                />
              </div>
              <p className="text-sm text-slate-400">
                Estimado mensual:{" "}
                <strong className="text-white">
                  {monthlyPreview === null ? "Consultando…" : formatMoney(monthlyPreview, currency)}
                </strong>
                {quote ? (
                  <>
                    {" "}
                    · Cotización: {formatMoney(quote.totalAmount, quote.currency)} ({quote.kind}
                    {quote.isProrated ? `, ${quote.proratedDays} días` : ""})
                  </>
                ) : null}
              </p>
              {isLoggedIn ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Razón social</Label>
                    <Input
                      className="mt-2 border-slate-700 bg-slate-950"
                      value={customer.nombre_cliente}
                      onChange={(e) =>
                        setCustomer((c) => ({ ...c, nombre_cliente: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>NIT / ID</Label>
                    <Input
                      className="mt-2 border-slate-700 bg-slate-950"
                      value={customer.identificacion}
                      onChange={(e) =>
                        setCustomer((c) => ({ ...c, identificacion: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input
                      className="mt-2 border-slate-700 bg-slate-950"
                      value={customer.telefono1}
                      onChange={(e) =>
                        setCustomer((c) => ({ ...c, telefono1: e.target.value }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Tipo de persona</Label>
                    <select
                      className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      value={customer.id_tipo_persona}
                      onChange={(e) =>
                        setCustomer((c) => ({
                          ...c,
                          id_tipo_persona: Number(e.target.value) === 2 ? 2 : 1,
                        }))
                      }
                    >
                      <option value={1}>Natural (1)</option>
                      <option value={2}>Jurídica (2)</option>
                    </select>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                {isLoggedIn ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700"
                      disabled={quoting}
                      onClick={() => void refreshQuote()}
                    >
                      {quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Cotizar
                    </Button>
                    <Button
                      type="button"
                      className="bg-orange-500 hover:bg-orange-600"
                      disabled={loading || Boolean(status?.hasPendingInvoice)}
                      onClick={() => void handleCheckout()}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Pagar con Cuenti Pay
                    </Button>
                  </>
                ) : (
                  <Button asChild className="bg-orange-500 hover:bg-orange-600">
                    <Link href="/login?callbackUrl=/pricing">Iniciar sesión para pagar</Link>
                  </Button>
                )}
              </div>

              {status?.pendingInvoice ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <p>
                    Tienes un pago pendiente ({status.pendingInvoice.codigoUnico}).
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {status.pendingInvoice.paymentUrl ? (
                      <Button asChild size="sm" className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                        <a href={status.pendingInvoice.paymentUrl}>Continuar pago</a>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/40"
                      disabled={loading}
                      onClick={() => void handleCancelPending()}
                    >
                      Cancelar pendiente
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
