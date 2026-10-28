"use client";

import { useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import {
  computeMonthlyPrice,
  formatCop,
  formatUsd,
  type MarketingBillingConfig,
  type MarketingCurrency,
} from "@/lib/billing";

interface PricingCalculatorProps {
  config: MarketingBillingConfig;
}

export function PricingCalculator({ config }: PricingCalculatorProps) {
  const [employees, setEmployees] = useState(config.freeEmployeeLimit + 2);
  const [currency, setCurrency] = useState<MarketingCurrency>("COP");

  const estimate = useMemo(
    () => computeMonthlyPrice(config, employees, currency),
    [config, employees, currency]
  );

  const format = (amount: number) =>
    currency === "COP" ? formatCop(amount) : formatUsd(amount);

  return (
    <div className="mx-auto mt-14 max-w-3xl overflow-hidden rounded-[2rem] border border-black/10 bg-white">
      <div className="grid gap-8 p-7 sm:p-10">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#9b7400]/25 bg-[#f9c626]/15 text-[#9b7400]">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-extrabold text-[#171714]">Calcula tu mensualidad</p>
            <p className="text-sm text-black/50">
              Precios leídos en vivo desde la configuración de cobro.
            </p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-4">
            <label htmlFor="pricing-employees" className="text-sm font-semibold text-black/60">
              Empleados a facturar
            </label>
            <span className="text-lg font-extrabold tracking-[-0.03em] text-[#171714]">
              {estimate.employeeCount}
            </span>
          </div>
          <input
            id="pricing-employees"
            type="range"
            min={1}
            max={500}
            step={1}
            value={employees}
            onChange={(event) => setEmployees(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer accent-[#9b7400]"
          />
          <p className="mt-2 text-xs text-black/40">
            El plan gratis cubre hasta {config.freeEmployeeLimit} empleados; este estimado
            corresponde al cupo contratado en el plan de pago.
          </p>
        </div>

        <div className="flex gap-2">
          {(["COP", "USD"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              aria-pressed={currency === c}
              className={`rounded-full px-5 py-2 text-sm font-extrabold transition ${
                currency === c
                  ? "bg-[#171714] text-white"
                  : "border border-black/15 text-black/60 hover:border-black/30"
              }`}
            >
              {c === "COP" ? "Pesos (COP)" : "Dólares (USD)"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-px border-t border-black/10 bg-black/10 sm:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-white p-7 sm:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-black/45">
            Total estimado al mes
          </p>
          <p className="mt-4 text-4xl font-extrabold tracking-[-0.05em] text-[#171714] sm:text-5xl">
            {format(estimate.totalAmount)}
          </p>
          <p className="mt-2 text-sm text-black/55">
            {estimate.employeeCount} empleados × {format(estimate.unitPrice)} por empleado al
            mes
          </p>
        </div>
        <div className="bg-[#171714] p-7 text-white sm:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#f9c626]">
            Cobro
          </p>
          <p className="mt-4 text-2xl font-extrabold tracking-[-0.04em]">
            Solo mensual
          </p>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Periodos de {config.billingPeriodDays} días. Los empleados añadidos a mitad de
            periodo se cobran proporcional a los días restantes.
          </p>
        </div>
      </div>

      <div className="flex gap-3 border-t border-black/10 px-7 py-5 text-xs leading-5 text-black/40 sm:px-10">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Estimado informativo: multiplica el número de empleados del cupo por el precio
          unitario vigente. La cotización final se confirma al pagar dentro de la aplicación,
          en la página de precios de tu cuenta.
        </p>
      </div>
    </div>
  );
}
