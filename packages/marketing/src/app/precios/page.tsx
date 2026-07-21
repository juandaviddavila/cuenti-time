import type { Metadata } from "next";
import { ArrowRight, Check, HelpCircle, Sparkles } from "lucide-react";
import { absoluteUrl, siteConfig } from "@/lib/site";
import {
  fetchBillingConfig,
  formatCop,
  formatUsd,
} from "@/lib/billing";

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchBillingConfig();
  const description = `Plan gratis hasta ${config.freeEmployeeLimit} empleados. Plan de pago desde ${formatCop(config.priceCopPerEmployeeMonthly)}/empleado/mes o ${formatUsd(config.priceUsdPerEmployeeMonthly)} USD (cobro mensual).`;
  return {
    title: "Precios",
    description,
    alternates: { canonical: absoluteUrl("/precios") },
    openGraph: {
      title: "Precios",
      description,
      url: absoluteUrl("/precios"),
      locale: siteConfig.locale,
      type: "website",
    },
  };
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  ""
);

export default async function PricingPage() {
  const config = await fetchBillingConfig();

  const freeFeatures = [
    `Hasta ${config.freeEmployeeLimit} empleados activos`,
    "Sucursales, geofence móvil y marcaciones",
    "Reportes operativos",
    "Sin API pública ni MCP",
  ];

  const paidFeatures = [
    "Cupo de empleados según lo contratado",
    "API REST, webhooks y MCP RRHH",
    "Empleados adicionales con prorrateo si queda periodo",
    "Cobro únicamente mensual",
  ];

  const faqs = [
    {
      question: "¿Qué incluye el plan gratis?",
      answer: `Puedes operar con hasta ${config.freeEmployeeLimit} empleados. No incluye API ni MCP; esas integraciones requieren plan de pago activo.`,
    },
    {
      question: "¿Cómo se cobra el plan de pago?",
      answer: `Cada empleado cuesta ${formatCop(config.priceCopPerEmployeeMonthly)}/mes o ${formatUsd(config.priceUsdPerEmployeeMonthly)} USD/mes. El cobro es solo mensual.`,
    },
    {
      question: "¿Qué pasa si necesito un empleado a mitad de mes?",
      answer:
        "Debes comprar el cupo adicional antes de registrarlo. Si faltan días del periodo, se cobra el proporcional (en COP sin decimales; en USD hasta 2 decimales).",
    },
    {
      question: "¿Dónde pago?",
      answer:
        "Desde la aplicación en /pricing, con link de pago Cuenti Pay. Si la suscripción vence, verás un aviso con enlace de renovación.",
    },
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-black/10 bg-[#f6f3eb] py-20 md:py-28">
        <div className="absolute inset-0 fine-grid opacity-60" />
        <div className="page-shell relative text-center">
          <span className="eyebrow">Precios vivos desde configuración</span>
          <h1 className="display-title mx-auto mt-7 max-w-5xl text-balance">
            Empieza gratis. Escala cuando el cupo lo pida.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#68655d] md:text-xl">
            Plan free hasta {config.freeEmployeeLimit} empleados. Plan de pago por empleado, solo
            mensual, con API y MCP.
          </p>
        </div>
      </section>

      <section className="bg-[#fffdf7] py-16 md:py-24">
        <div className="page-shell">
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-[2rem] border border-black/10 p-7 sm:p-10">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#171714] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-white">
                <Sparkles className="h-3.5 w-3.5 text-[#f9c626]" aria-hidden="true" />
                Plan gratis
              </span>
              <p className="mt-8 text-5xl font-extrabold tracking-[-0.06em]">$0</p>
              <p className="mt-2 text-lg font-bold">Hasta {config.freeEmployeeLimit} empleados</p>
              <ul className="mt-8 grid gap-3">
                {freeFeatures.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-black/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#9b7400]" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={`${appUrl}/register`}
                className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-[#171714] px-6 py-4 font-extrabold text-white transition hover:bg-[#34342f]"
              >
                Crear cuenta <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-[#171714] p-7 text-white sm:p-10">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f9c626]">
                Plan de pago
              </p>
              <p className="mt-8 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">
                {formatCop(config.priceCopPerEmployeeMonthly)}
                <span className="text-lg font-medium text-white/55"> / empleado / mes</span>
              </p>
              <p className="mt-2 text-white/60">
                o {formatUsd(config.priceUsdPerEmployeeMonthly)} USD · cobro mensual
              </p>
              <ul className="mt-8 grid gap-3">
                {paidFeatures.map((item) => (
                  <li key={item} className="flex gap-3 border-b border-white/10 pb-3 text-sm text-white/75">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#f9c626]" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={`${appUrl}/register`}
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#f9c626] px-6 py-4 font-extrabold text-[#171714] transition hover:bg-[#e9b817]"
              >
                Crear cuenta <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-[#f4f0e6] py-20 md:py-28">
        <div className="page-shell">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <HelpCircle className="h-9 w-9 text-[#9b7400]" aria-hidden="true" />
              <h2 className="section-title mt-5">Preguntas claras.</h2>
            </div>
            <div className="divide-y divide-black/10 border-y border-black/10">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-extrabold [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/20 text-lg transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pt-4 leading-7 text-[#68655d]">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
