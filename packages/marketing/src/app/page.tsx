import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Radio,
  ScanFace,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { RoiCalculator } from "@/components/roi-calculator";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { fetchBillingConfig, formatCop, formatUsd } from "@/lib/billing";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

const features = [
  {
    icon: ScanFace,
    number: "01",
    title: "Registro facial",
    description:
      "Face-api y búsqueda de similitud en pgvector para validar cada marcación mediante un descriptor numérico.",
  },
  {
    icon: MapPin,
    number: "02",
    title: "Geocerca por sucursal",
    description:
      "Valida el radio de operación cuando una persona marca desde un dispositivo móvil.",
  },
  {
    icon: BarChart3,
    number: "03",
    title: "Reportes con contexto",
    description:
      "Historial, novedades y reportes para revisar la asistencia sin reconstruir el día en una hoja de cálculo.",
  },
  {
    icon: Braces,
    number: "04",
    title: "Operación conectada",
    description:
      "API pública, webhooks y servidor MCP para integrar los datos de RR. HH. con otros flujos.",
  },
];

const steps = [
  ["Configura", "Crea la empresa, las sucursales y sus reglas de ubicación."],
  ["Registra", "Agrega a tu equipo y habilita sus registros faciales."],
  ["Marca", "Cada persona registra su entrada o salida en el flujo asignado."],
  ["Revisa", "Consulta asistencia, novedades y reportes desde un solo lugar."],
] as const;

const staticFaqs = [
  {
    question: "¿La geocerca rastrea al trabajador todo el día?",
    answer:
      "No. La ubicación se solicita al marcar desde un dispositivo móvil y se usa para calcular la distancia a la sucursal. No es un sistema de seguimiento continuo.",
  },
  {
    question: "¿cuenti time reemplaza un software de nómina?",
    answer:
      "No. Organiza la evidencia de asistencia, turnos y novedades para facilitar la revisión previa a nómina. Puede integrarse con otros sistemas mediante API y webhooks.",
  },
  {
    question: "¿Qué información facial almacena el sistema?",
    answer:
      "El producto trabaja con un descriptor numérico del rostro para comparar similitud. La implementación requiere consentimiento biométrico y no necesita conservar la fotografía original.",
  },
] as const;

const chartBars = [42, 58, 46, 72, 64, 86, 76, 92, 70, 84, 96, 88];

interface DashboardNavigationItem {
  icon: LucideIcon;
  label: string;
  active: boolean;
}

interface IntegrationItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

const dashboardNavigation: DashboardNavigationItem[] = [
  { icon: LayoutDashboard, label: "Resumen", active: true },
  { icon: Users, label: "Empleados", active: false },
  { icon: Clock3, label: "Asistencia", active: false },
  { icon: MapPin, label: "Sucursales", active: false },
  { icon: BarChart3, label: "Reportes", active: false },
];

const integrations: IntegrationItem[] = [
  {
    icon: Braces,
    title: "API pública",
    description: "Consulta y escritura mediante tokens aislados por empresa.",
  },
  {
    icon: Webhook,
    title: "Webhooks",
    description: "Eventos firmados con reintentos para tus automatizaciones.",
  },
  {
    icon: ShieldCheck,
    title: "MCP para RR. HH.",
    description: "Herramientas de consulta para clientes compatibles con MCP.",
  },
];

export default async function HomePage() {
  const billing = await fetchBillingConfig();
  const faqs = [
    {
      question: "¿El plan gratis requiere tarjeta?",
      answer: `No. Puedes crear una cuenta en plan gratis con hasta ${billing.freeEmployeeLimit} empleados, sin ingresar una tarjeta. API y MCP requieren plan de pago.`,
    },
    ...staticFaqs,
  ];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: siteConfig.name,
              url: siteConfig.siteUrl,
              logo: absoluteUrl("/logo-simbolo.svg"),
            },
            {
              "@type": "SoftwareApplication",
              name: siteConfig.name,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: siteConfig.description,
              url: siteConfig.siteUrl,
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "COP",
                description: `Plan gratis hasta ${billing.freeEmployeeLimit} empleados; plan de pago desde ${formatCop(billing.priceCopPerEmployeeMonthly)} o ${formatUsd(billing.priceUsdPerEmployeeMonthly)} USD por empleado al mes, con cobro mensual`,
              },
            },
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            },
          ],
        }}
      />

      <div className="landing-dark overflow-hidden bg-[#071018] text-white">
        <section className="hero-glow relative border-b border-white/[0.08]">
          <div className="fine-grid absolute inset-0" />
          <div className="page-shell relative pb-16 pt-20 text-center md:pb-24 md:pt-28">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#55e6c1]/25 bg-[#55e6c1]/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8ef0d5]">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              Asistencia verificable, en tiempo real
            </div>
            <h1 className="display-title mx-auto mt-7 max-w-5xl text-balance">
              La asistencia de tu equipo,{" "}
              <span className="text-[#55e6c1]">convertida en evidencia.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/55 md:text-lg md:leading-8">
              Control facial, ubicación por sucursal y reportes claros para entender quién marcó,
              desde dónde y qué necesita revisión.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={`${appUrl}/register`}
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#55e6c1] px-6 py-3.5 text-sm font-bold text-[#061019] transition hover:bg-[#7aefd3]"
              >
                Empezar gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </a>
              <Link
                href="/producto"
                className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Explorar el producto
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/38">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#55e6c1]" /> Sin tarjeta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#55e6c1]" /> Hasta{" "}
                {billing.freeEmployeeLimit} empleados gratis
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#55e6c1]" /> Reportes incluidos
              </span>
            </div>

            <div className="relative mx-auto mt-14 max-w-6xl md:mt-20">
              <div className="absolute -inset-10 bg-[radial-gradient(circle_at_50%_30%,rgba(85,230,193,0.12),transparent_58%)]" />
              <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#0a1620] p-1.5 shadow-[0_40px_120px_-45px_rgba(0,0,0,0.95)] md:rounded-2xl md:p-2">
                <div className="flex h-8 items-center gap-1.5 border-b border-white/[0.07] px-3">
                  <span className="h-2 w-2 rounded-full bg-white/15" />
                  <span className="h-2 w-2 rounded-full bg-white/15" />
                  <span className="h-2 w-2 rounded-full bg-[#f9c626]/70" />
                  <span className="mx-auto -translate-x-5 text-[9px] font-medium tracking-wide text-white/25">
                    cuenti time · panel de asistencia
                  </span>
                </div>
                <div className="grid min-h-[470px] grid-cols-1 bg-[#f4f6f5] text-left text-[#102028] md:grid-cols-[190px_1fr]">
                  <aside className="hidden border-r border-[#dce3e1] bg-[#0b1720] p-4 text-white md:block">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-5 text-sm font-bold">
                      <span className="grid h-7 w-7 place-items-center rounded-md bg-[#55e6c1] text-[#071018]">
                        <Fingerprint className="h-4 w-4" />
                      </span>
                      cuenti <span className="-ml-1.5 text-[#55e6c1]">time</span>
                    </div>
                    <nav className="mt-5 space-y-1 text-[11px]">
                      {dashboardNavigation.map((item) => {
                        const NavigationIcon = item.icon;
                        return (
                          <div
                            key={item.label}
                            className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 ${
                              item.active ? "bg-[#55e6c1]/10 text-[#7aefd3]" : "text-white/40"
                            }`}
                          >
                            <NavigationIcon className="h-3.5 w-3.5" />
                            {item.label}
                          </div>
                        );
                      })}
                    </nav>
                    <div className="mt-24 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[9px] uppercase tracking-widest text-white/30">Sucursal activa</p>
                      <p className="mt-2 text-[11px] font-semibold text-white/70">Equipo central</p>
                      <p className="mt-1 text-[9px] text-[#55e6c1]">● Operación en línea</p>
                    </div>
                  </aside>

                  <div className="min-w-0 p-4 sm:p-6 md:p-7">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7d7a]">
                          Lunes, 20 de julio
                        </p>
                        <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] sm:text-xl">
                          Resumen de asistencia
                        </h2>
                      </div>
                      <span className="rounded-md border border-[#d8e1df] bg-white px-2.5 py-1.5 text-[9px] font-semibold text-[#49605c]">
                        Hoy
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                      {[
                        ["Presentes", "24", "+3 hoy", "#55e6c1"],
                        ["A tiempo", "21", "87,5 %", "#55e6c1"],
                        ["Por revisar", "03", "Novedades", "#f9c626"],
                        ["Sucursales", "04", "Activas", "#55e6c1"],
                      ].map(([label, value, note, color]) => (
                        <div key={label} className="rounded-lg border border-[#dfe6e4] bg-white p-3.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#71817e]">
                              {label}
                            </p>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                          </div>
                          <p className="mt-3 text-2xl font-bold tracking-[-0.05em]">{value}</p>
                          <p className="mt-1 text-[9px] text-[#71817e]">{note}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
                      <div className="rounded-lg border border-[#dfe6e4] bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold">Marcaciones por hora</p>
                            <p className="mt-0.5 text-[9px] text-[#71817e]">Entradas registradas hoy</p>
                          </div>
                          <Activity className="h-4 w-4 text-[#55bfa4]" />
                        </div>
                        <div className="mt-6 flex h-24 items-end gap-1.5 border-b border-[#e6ecea]">
                          {chartBars.map((height, index) => (
                            <span
                              key={`${height}-${index}`}
                              className="flex-1 rounded-t-[2px] bg-[#55e6c1]"
                              style={{ height: `${height}%`, opacity: 0.35 + index * 0.045 }}
                            />
                          ))}
                        </div>
                        <div className="mt-2 flex justify-between text-[8px] text-[#8a9895]">
                          <span>6:00</span>
                          <span>8:00</span>
                          <span>10:00</span>
                          <span>12:00</span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#dfe6e4] bg-white p-4 shadow-sm">
                        <p className="text-xs font-bold">Actividad reciente</p>
                        <div className="mt-4 space-y-3.5">
                          {[
                            ["AM", "Ana M.", "Entrada", "08:02"],
                            ["JC", "Juan C.", "Entrada", "07:58"],
                            ["LV", "Laura V.", "Entrada", "07:51"],
                          ].map(([initials, name, action, time]) => (
                            <div key={name} className="flex items-center gap-2.5">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8f8f3] text-[8px] font-bold text-[#21896f]">
                                {initials}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[10px] font-semibold">{name}</p>
                                <p className="text-[8px] text-[#81908d]">{action}</p>
                              </div>
                              <span className="text-[8px] text-[#81908d]">{time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="float-soft absolute -bottom-5 right-3 hidden items-center gap-3 rounded-lg border border-white/10 bg-[#0d1c26] px-4 py-3 text-left shadow-xl sm:flex md:right-8">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#55e6c1]/10 text-[#55e6c1]">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/35">Marcación validada</p>
                  <p className="mt-0.5 text-xs font-semibold text-white/80">Dentro de la sucursal</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.08] bg-[#09151e] py-10">
          <div className="page-shell flex flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
            <p className="max-w-lg text-sm font-medium leading-6 text-white/65">
              Diseñado para operaciones con personas, turnos y sucursales que necesitan evidencia,
              no más trabajo manual.
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {["Asistencia", "Sucursales", "Novedades", "Reportes"].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.08] py-20 md:py-24">
          <div className="page-shell">
            <div className="max-w-2xl">
              <span className="eyebrow">El costo de la imprecisión</span>
              <h2 className="section-title mt-5 text-balance">
                La asistencia es un dato operativo, no un trámite.
              </h2>
              <p className="mt-5 text-base leading-7 text-white/50">
                Referencias internacionales ayudan a dimensionar el problema. Cada empresa debe
                medir su propia línea base.
              </p>
            </div>
            <div className="mt-12 grid divide-y divide-white/10 border-y border-white/10 md:grid-cols-3 md:divide-x md:divide-y-0">
              {[
                ["80,15 %", "precisión promedio de nómina en el estudio estadounidense EY 2022; casi una de cada cinco requirió corrección."],
                ["US$291", "costo medio directo e indirecto por error reportado por EY. Es una referencia internacional, no una tarifa colombiana."],
                ["745.000", "muertes estimadas por OMS/OIT en 2016 asociadas a jornadas de 55 horas o más."],
              ].map(([value, description]) => (
                <div key={value} className="px-0 py-8 first:pl-0 md:px-8 md:first:pl-0 md:last:pr-0">
                  <p className="text-4xl font-semibold tracking-[-0.055em] text-[#55e6c1]">{value}</p>
                  <p className="mt-4 text-sm leading-6 text-white/45">{description}</p>
                </div>
              ))}
            </div>
            <p className="mt-7 text-[11px] leading-5 text-white/30">
              Fuentes:{" "}
              <a
                href="https://eyquest.com/files/Cost_and_Risks_Due_to_Payroll_Errors_2022_Final.pdf"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-white"
              >
                EY, HR Processing Risk and Cost Survey (2022)
              </a>{" "}
              y{" "}
              <a
                href="https://www.who.int/news/item/17-05-2021-long-working-hours-increasing-deaths-from-heart-disease-and-stroke-who-ilo"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-white"
              >
                OMS/OIT, estimación global sobre jornadas extensas
              </a>
              .
            </p>
          </div>
        </section>

        <section id="funciones" className="bg-[#09151e] py-20 md:py-28">
          <div className="page-shell">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <span className="eyebrow">Visibilidad de extremo a extremo</span>
                <h2 className="section-title mt-5 max-w-2xl text-balance">
                  De cada marcación a una decisión mejor informada.
                </h2>
              </div>
              <p className="max-w-lg self-end text-lg leading-8 text-white/48 lg:justify-self-end">
                Captura el registro, valida sus condiciones y conviértelo en información que el
                equipo administrativo puede revisar.
              </p>
            </div>

            <div className="mt-14 grid overflow-hidden rounded-2xl border border-white/10 md:grid-cols-2">
              {features.map((feature) => (
                <article
                  key={feature.number}
                  className="group border-b border-white/10 p-7 transition last:border-b-0 hover:bg-white/[0.025] md:border-r md:p-9 md:[&:nth-child(2n)]:border-r-0 md:[&:nth-child(n+3)]:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#55e6c1]/20 bg-[#55e6c1]/[0.07] text-[#55e6c1]">
                      <feature.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[10px] text-white/20">{feature.number}</span>
                  </div>
                  <h3 className="mt-8 text-xl font-semibold tracking-[-0.03em]">{feature.title}</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/45">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.08] py-20 md:py-28">
          <div className="page-shell">
            <div className="max-w-2xl">
              <span className="eyebrow">Puesta en marcha</span>
              <h2 className="section-title mt-5 text-balance">Una ruta clara de la configuración al reporte.</h2>
            </div>
            <ol className="relative mt-14 grid gap-4 md:grid-cols-4 md:gap-0">
              <span className="absolute left-[12.5%] right-[12.5%] top-5 hidden h-px bg-white/10 md:block" aria-hidden="true" />
              {steps.map(([title, description], index) => (
                <li key={title} className="relative md:px-5 md:first:pl-0 md:last:pr-0">
                  <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-[#55e6c1]/35 bg-[#071018] font-mono text-xs text-[#55e6c1]">
                    0{index + 1}
                  </span>
                  <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/42">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-[#0a1720] py-20 md:py-28">
          <div className="page-shell grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <span className="eyebrow">Privacidad y cumplimiento</span>
              <h2 className="section-title mt-5 text-balance">
                Control útil, sin convertirlo en vigilancia.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-white/48">
                Finalidad definida, acceso limitado, consentimiento documentado y revisión humana
                para tratar la evidencia con criterio.
              </p>
            </div>
            <div className="grid gap-3">
              <Link
                href="/recursos/biometria-laboral-ley-1581"
                className="group flex gap-5 rounded-xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-[#55e6c1]/30"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#55e6c1]/10 text-[#55e6c1]">
                  <LockKeyhole className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#55e6c1]">
                    Datos sensibles
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">Biometría con consentimiento y propósito.</h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    cuenti time trabaja con el descriptor numérico y permite documentar el
                    consentimiento bajo la Ley 1581.
                  </p>
                </div>
                <ChevronRight className="ml-auto mt-3 h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/recursos/ley-2466-2025-horas-extra-colombia"
                className="group flex gap-5 rounded-xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-[#55e6c1]/30"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#f9c626]/10 text-[#f9c626]">
                  <FileCheck2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#f9c626]">
                    Jornada y horas extra
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">Registros preparados para explicar la jornada.</h3>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    La Ley 2466 de 2025 exige detallar el trabajo suplementario. El software organiza
                    evidencia; la empresa conserva la responsabilidad de revisar y liquidar.
                  </p>
                </div>
                <ChevronRight className="ml-auto mt-3 h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        <section id="integraciones" className="border-y border-white/[0.08] py-20 md:py-28">
          <div className="page-shell">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
              <div>
                <span className="eyebrow">Integraciones</span>
                <h2 className="section-title mt-5 text-balance">La información lista para seguir su camino.</h2>
                <p className="mt-6 max-w-lg text-lg leading-8 text-white/48">
                  Consulta, automatiza o conecta la información de RR. HH. sin encerrarla en otra
                  herramienta aislada.
                </p>
                <Link
                  href="/producto#integraciones"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#55e6c1] hover:text-[#8ef0d5]"
                >
                  Ver capacidades técnicas <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-3">
                {integrations.map((integration) => {
                  const IntegrationIcon = integration.icon;
                  return (
                    <div key={integration.title} className="flex items-start gap-4 rounded-xl border border-white/10 bg-[#0b1821] p-5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#55e6c1]/20 bg-[#55e6c1]/[0.06] text-[#55e6c1]">
                        <IntegrationIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-semibold">{integration.title}</h3>
                        <p className="mt-1.5 text-sm leading-6 text-white/42">{integration.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <RoiCalculator />

        <section className="py-20 md:py-28">
          <div className="page-shell grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <span className="eyebrow">Preguntas frecuentes</span>
              <h2 className="section-title mt-5 text-balance">Lo importante, sin letra pequeña.</h2>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span className="text-xl font-light text-[#55e6c1] transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pt-4 text-sm leading-7 text-white/45">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/[0.08] py-20 md:py-28">
          <div className="fine-grid absolute inset-0 opacity-70" />
          <div className="page-shell relative">
            <div className="overflow-hidden rounded-2xl border border-[#55e6c1]/20 bg-[#0c1b24] px-6 py-14 text-center sm:px-10 md:py-20">
              <div className="absolute left-1/2 top-0 h-40 w-96 -translate-x-1/2 bg-[#55e6c1]/10 blur-[90px]" />
              <span className="relative mx-auto grid h-11 w-11 place-items-center rounded-xl border border-[#55e6c1]/20 bg-[#55e6c1]/10 text-[#55e6c1]">
                <ScanFace className="h-5 w-5" />
              </span>
              <h2 className="section-title relative mx-auto mt-6 max-w-3xl text-balance">
                Haz que cada marcación cuente.
              </h2>
              <p className="relative mx-auto mt-5 max-w-xl text-base leading-7 text-white/50">
                Empieza gratis con hasta {billing.freeEmployeeLimit} empleados. El plan de pago
                cuesta {formatCop(billing.priceCopPerEmployeeMonthly)} o{" "}
                {formatUsd(billing.priceUsdPerEmployeeMonthly)} USD por empleado al mes, con cobro
                mensual, e incluye API y MCP.
              </p>
              <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href={`${appUrl}/register`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#55e6c1] px-6 py-3.5 text-sm font-bold text-[#061019] hover:bg-[#7aefd3]"
                >
                  Crear mi cuenta <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={`${appUrl}/pricing`}
                  className="inline-flex items-center justify-center rounded-lg border border-white/15 px-6 py-3.5 text-sm font-semibold hover:bg-white/[0.05]"
                >
                  Revisar planes
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
