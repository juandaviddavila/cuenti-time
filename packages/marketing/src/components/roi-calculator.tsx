"use client";

import { useMemo, useState } from "react";
import { Calculator, Clock, Info } from "lucide-react";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface RangeFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
}

function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: RangeFieldProps) {
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <label htmlFor={id} className="text-sm font-bold text-[#5e5b52]">
          {label}
        </label>
        <span className="text-lg font-extrabold tracking-[-0.03em]">{displayValue}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-sun h-2 w-full cursor-pointer"
      />
    </div>
  );
}

export function RoiCalculator() {
  const [employees, setEmployees] = useState(35);
  const [monthlySalary, setMonthlySalary] = useState(1_800_000);
  const [dailyMinutes, setDailyMinutes] = useState(12);

  const result = useMemo(() => {
    const monthlyHours = (employees * dailyMinutes * 22) / 60;
    const hourlyCost = monthlySalary / 176;
    return {
      monthlyHours: Math.round(monthlyHours),
      opportunityValue: Math.round(monthlyHours * hourlyCost),
    };
  }, [dailyMinutes, employees, monthlySalary]);

  return (
    <section id="roi" className="bg-[#171714] py-20 text-white md:py-28">
      <div className="page-shell">
        <div className="grid items-start gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div className="lg:sticky lg:top-28">
            <span className="eyebrow !text-[#f9c626]">Haz tus cuentas</span>
            <h2 className="section-title mt-5 text-balance">
              El tiempo invisible también cuenta.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/60">
              Explora cuánto tiempo administrativo podría representar el control manual de
              asistencia. Es una estimación, no una promesa de ahorro.
            </p>
          </div>

          <div className="overflow-hidden rounded-[2rem] bg-[#fffdf7] text-[#171714] shadow-2xl">
            <div className="grid gap-8 p-6 sm:p-9">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f9c626]">
                  <Calculator className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-extrabold">Calculadora de oportunidad</p>
                  <p className="text-sm text-[#767269]">Mueve los controles según tu operación.</p>
                </div>
              </div>

              <RangeField
                id="employees"
                label="Personas en el equipo"
                value={employees}
                min={5}
                max={300}
                step={5}
                displayValue={`${employees}`}
                onChange={setEmployees}
              />
              <RangeField
                id="salary"
                label="Costo laboral mensual promedio"
                value={monthlySalary}
                min={1_000_000}
                max={8_000_000}
                step={100_000}
                displayValue={currency.format(monthlySalary)}
                onChange={setMonthlySalary}
              />
              <RangeField
                id="minutes"
                label="Minutos diarios por persona dedicados al proceso manual"
                value={dailyMinutes}
                min={2}
                max={45}
                step={1}
                displayValue={`${dailyMinutes} min`}
                onChange={setDailyMinutes}
              />
            </div>

            <div className="grid gap-px border-t border-black/10 bg-black/10 sm:grid-cols-2">
              <div className="bg-[#f4f0e6] p-6 sm:p-8">
                <Clock className="mb-5 h-5 w-5 text-[#8d6b08]" aria-hidden="true" />
                <p className="text-3xl font-extrabold tracking-[-0.05em]">
                  {result.monthlyHours} h
                </p>
                <p className="mt-2 text-sm leading-6 text-[#68655d]">
                  de gestión manual estimada al mes
                </p>
              </div>
              <div className="bg-[#f9c626] p-6 sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em]">
                  Valor de oportunidad
                </p>
                <p className="mt-4 text-3xl font-extrabold tracking-[-0.05em]">
                  {currency.format(result.opportunityValue)}
                </p>
                <p className="mt-2 text-sm leading-6 text-black/65">
                  referencia mensual, no ahorro garantizado
                </p>
              </div>
            </div>

            <div className="flex gap-3 border-t border-black/10 px-6 py-5 text-xs leading-5 text-[#777269] sm:px-9">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Supuestos: 22 días laborales al mes y 176 horas laborales mensuales. El cálculo
                multiplica personas × minutos diarios × días, y valora esas horas según el costo
                laboral promedio ingresado. El resultado real depende de cada operación.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
