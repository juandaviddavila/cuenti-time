"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Check, Scan, CreditCard, Code2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ADDITIONAL_EMPLOYEE_MONTHLY_COP,
  ANNUAL_DISCOUNT,
  BASE_INCLUDED_EMPLOYEES,
  BASE_MONTHLY_COP,
  calculateMaxEmployeesFromPlan,
  calculatePlanTotalCOP,
  formatCop,
  type BillingCycle,
} from "@/lib/pricing";

const benefits = [
  "10 empleados con registro facial incluidos",
  "Sucursales ilimitadas, turnos, novedades y reportes",
  "API REST pública con tokens y documentación Swagger",
  "Webhooks para integrar con nómina, ERP o BI",
  `Empleados adicionales desde ${formatCop(ADDITIONAL_EMPLOYEE_MONTHLY_COP)}/mes`,
];

interface WompiCheckoutConfig {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  redirectUrl: string;
  signature: { integrity: string };
}

interface WompiWidget {
  open: (callback: (result: { transaction: { status: string } }) => void) => void;
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: WompiCheckoutConfig) => WompiWidget;
  }
}

interface Props {
  isLoggedIn: boolean;
  wompiEnabled: boolean;
}

export function PricingClient({ isLoggedIn, wompiEnabled }: Props) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [additionalEmployees, setAdditionalEmployees] = useState(0);
  const [paying, setPaying] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  const monthlySubtotal = BASE_MONTHLY_COP + additionalEmployees * ADDITIONAL_EMPLOYEE_MONTHLY_COP;
  const total = useMemo(
    () => calculatePlanTotalCOP(billingCycle, additionalEmployees),
    [billingCycle, additionalEmployees]
  );
  const maxEmployees = calculateMaxEmployeesFromPlan(additionalEmployees);

  async function handlePay() {
    if (!isLoggedIn) {
      toast.error("Inicia sesión con tu cuenta de empresa para pagar");
      return;
    }
    if (!wompiEnabled || !widgetReady || !window.WidgetCheckout) {
      toast.error("Pasarela Wompi no disponible. Revisa la configuración.");
      return;
    }

    setPaying(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingCycle, additionalEmployees }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar el pago");

      const checkout = new window.WidgetCheckout({
        currency: data.currency,
        amountInCents: data.amountInCents,
        reference: data.reference,
        publicKey: data.publicKey,
        redirectUrl: data.redirectUrl,
        signature: { integrity: data.integritySignature },
      });

      checkout.open((result) => {
        if (result.transaction?.status === "APPROVED") {
          window.location.href = data.redirectUrl;
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al pagar");
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.wompi.co/widget.js"
        strategy="afterInteractive"
        onLoad={() => setWidgetReady(true)}
      />

      <main className="min-h-screen bg-slate-950 text-white">
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <Scan className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-orange-300">cuenti time</p>
              <h1 className="text-3xl font-bold">Plan de asistencia facial</h1>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <h2 className="text-xl font-semibold">Beneficios incluidos</h2>
              <div className="mt-6 space-y-3">
                {benefits.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
                <div className="flex items-center gap-2 text-orange-300">
                  <Code2 className="h-5 w-5" />
                  <p className="font-medium">API para integrar</p>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Expone empleados, asistencia y eventos vía REST. Genera tokens en
                  Configuración → Integraciones y consulta la documentación Swagger en{" "}
                  <code className="text-orange-200">/api/v1/docs</code>.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-orange-500/30 bg-orange-500/10 p-8">
              <p className="text-slate-300">Configura tu plan</p>

              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant={billingCycle === "monthly" ? "default" : "outline"}
                  className={billingCycle === "monthly" ? "bg-orange-500 hover:bg-orange-600" : "border-slate-700 text-white"}
                  onClick={() => setBillingCycle("monthly")}
                >
                  Mensual
                </Button>
                <Button
                  type="button"
                  variant={billingCycle === "yearly" ? "default" : "outline"}
                  className={billingCycle === "yearly" ? "bg-orange-500 hover:bg-orange-600" : "border-slate-700 text-white"}
                  onClick={() => setBillingCycle("yearly")}
                >
                  Anual (−{Math.round(ANNUAL_DISCOUNT * 100)}%)
                </Button>
              </div>

              <div className="mt-6 space-y-2">
                <Label className="text-slate-200">Empleados adicionales (sobre {BASE_INCLUDED_EMPLOYEES})</Label>
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={additionalEmployees}
                  onChange={(e) => setAdditionalEmployees(Math.max(0, Number(e.target.value) || 0))}
                  className="bg-slate-900 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-400">
                  Cupo total con este plan: {maxEmployees} empleados con rostro.
                </p>
              </div>

              <div className="mt-8 border-t border-white/10 pt-6">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold">{formatCop(total)}</span>
                  <span className="pb-1 text-slate-400">
                    / {billingCycle === "yearly" ? "año" : "mes"}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <p className="mt-1 text-sm text-slate-400">
                    Equivale a {formatCop(Math.round(total / 12))}/mes (antes {formatCop(monthlySubtotal * 12)})
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                {isLoggedIn ? (
                  <Button
                    className="bg-orange-500 text-white hover:bg-orange-600"
                    onClick={handlePay}
                    disabled={paying || !wompiEnabled}
                  >
                    {paying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {paying ? "Abriendo Wompi..." : "Pagar con Wompi"}
                  </Button>
                ) : (
                  <Button asChild className="bg-orange-500 text-white hover:bg-orange-600">
                    <Link href="/login?callbackUrl=/pricing">Iniciar sesión para pagar</Link>
                  </Button>
                )}
                <Button asChild variant="outline" className="border-slate-700 bg-slate-950 text-white hover:bg-slate-800">
                  <Link href="/register">Probar 7 días gratis</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
