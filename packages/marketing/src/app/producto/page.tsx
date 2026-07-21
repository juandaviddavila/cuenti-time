import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  Braces,
  Check,
  Clock,
  MapPin,
  ScanFace,
} from "lucide-react";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { fetchBillingConfig, formatCop, formatUsd } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Producto",
  description:
    "Conoce las capacidades de control de asistencia, reportes e integraciones de cuenti time.",
  alternates: { canonical: absoluteUrl("/producto") },
  openGraph: {
    title: "Producto",
    description:
      "Conoce las capacidades de control de asistencia, reportes e integraciones de cuenti time.",
    url: absoluteUrl("/producto"),
    locale: siteConfig.locale,
    type: "website",
  },
};

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

const modules = [
  {
    icon: ScanFace,
    label: "Identidad",
    title: "Registro facial para marcar con claridad.",
    text: "cuenti time usa face-api para obtener descriptores faciales y pgvector para encontrar similitudes. El flujo permite registrar la identidad facial y usarla en las marcaciones.",
    points: ["Registro facial por empleado", "Búsqueda por similitud", "Consentimiento biométrico"],
    color: "bg-[#f9c626]",
  },
  {
    icon: MapPin,
    label: "Ubicación",
    title: "Geofence cuando la marcación ocurre en móvil.",
    text: "Define coordenadas y radio por sucursal. En dispositivos móviles, la marcación puede validar que la persona esté dentro del área configurada.",
    points: ["Radio configurable", "Validación móvil", "Distancia a la sucursal"],
    color: "bg-[#e7e2d6]",
  },
  {
    icon: BarChart3,
    label: "Lectura",
    title: "Reportes que parten de lo que sí pasó.",
    text: "Consulta el historial de asistencia, revisa entradas y salidas, y filtra reportes para entender ausencias y novedades de la operación.",
    points: ["Historial de asistencia", "Filtros por rango", "Exportación de reportes"],
    color: "bg-[#dfe9df]",
  },
];

export default async function ProductPage() {
  const billing = await fetchBillingConfig();

  return (
    <>
      <section className="overflow-hidden border-b border-black/10 bg-[#171714] py-20 text-white md:py-28">
        <div className="page-shell grid items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="eyebrow !text-[#f9c626]">El producto</span>
            <h1 className="display-title mt-7 max-w-4xl text-balance">
              Una señal clara para cada jornada.
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="max-w-lg text-lg leading-8 text-white/60">
              Desde la identidad y la ubicación hasta el reporte: una trazabilidad sencilla para
              equipos que necesitan saber qué ocurrió.
            </p>
            <a
              href={`${appUrl}/register`}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f9c626] px-6 py-4 font-extrabold text-[#171714]"
            >
              Empezar gratis <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#fffdf7] py-20 md:py-28">
        <div className="page-shell">
          <div className="mb-14 grid gap-5 md:grid-cols-2">
            <h2 className="section-title text-balance">Tres capas. Un mismo registro.</h2>
            <p className="max-w-lg self-end text-lg leading-8 text-[#68655d] md:justify-self-end">
              La marcación deja de ser un dato aislado cuando puedes leer identidad, contexto y
              resultado desde el mismo sistema.
            </p>
          </div>

          <div className="grid gap-5">
            {modules.map((module, index) => (
              <article
                key={module.label}
                className={`grid overflow-hidden rounded-[2rem] border border-black/10 ${module.color} lg:grid-cols-[0.85fr_1.15fr]`}
              >
                <div className="flex min-h-72 flex-col justify-between border-b border-black/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#171714] text-white">
                      <module.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-extrabold text-black/35">0{index + 1}</span>
                  </div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em]">{module.label}</p>
                </div>
                <div className="p-7 sm:p-10 lg:p-14">
                  <h3 className="max-w-xl text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl">
                    {module.title}
                  </h3>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-black/65">{module.text}</p>
                  <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                    {module.points.map((point) => (
                      <li key={point} className="flex items-center gap-2 text-sm font-bold">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-black/10">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="integraciones" className="bg-[#f4f0e6] py-20 md:py-28">
        <div className="page-shell grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <span className="eyebrow">Extensible por diseño</span>
            <h2 className="section-title mt-5 text-balance">La información puede seguir su camino.</h2>
            <p className="mt-6 text-lg leading-8 text-[#68655d]">
              Integra la asistencia con otros procesos usando interfaces ya disponibles en cuenti
              time.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              {
                icon: Braces,
                title: "API pública",
                text: "Tokens por empresa y endpoints para consultar o escribir según los permisos habilitados.",
              },
              {
                icon: ArrowRight,
                title: "Webhooks",
                text: "Eventos firmados para llevar cambios de empleados, asistencia, novedades y sucursales a otros flujos.",
              },
              {
                icon: Clock,
                title: "MCP de RR. HH.",
                text: "Herramientas de consulta para clientes compatibles, con acceso autenticado por empresa.",
              },
            ].map((item) => (
              <article key={item.title} className="flex gap-5 rounded-2xl border border-black/10 bg-[#fffdf7] p-6 sm:p-7">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f9c626]">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-extrabold tracking-[-0.03em]">{item.title}</h3>
                  <p className="mt-2 leading-7 text-[#68655d]">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sun-grid py-20 text-center md:py-28">
        <div className="page-shell">
          <h2 className="section-title mx-auto max-w-3xl text-balance">
            Conoce el flujo con tu propio equipo.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-black/65">
            Empieza gratis con hasta {billing.freeEmployeeLimit} empleados. Si necesitas más,
            paga {formatCop(billing.priceCopPerEmployeeMonthly)} o{" "}
            {formatUsd(billing.priceUsdPerEmployeeMonthly)} USD por empleado al mes, con cobro
            mensual.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={`${appUrl}/register`}
              className="rounded-full bg-[#171714] px-7 py-4 font-extrabold text-white"
            >
              Crear cuenta
            </a>
            <a
              href={`${appUrl}/pricing`}
              className="rounded-full border border-black/30 px-7 py-4 font-extrabold"
            >
              Ver planes
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
