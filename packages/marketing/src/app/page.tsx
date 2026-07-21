import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Braces,
  CheckCircle2,
  Clock,
  MapPin,
  ScanFace,
  Sparkles,
} from "lucide-react";
import { RoiCalculator } from "@/components/roi-calculator";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

const features = [
  {
    icon: ScanFace,
    number: "01",
    title: "Una cara. Una marcación.",
    description:
      "Registro facial con face-api y búsqueda de similitud en pgvector. La imagen no es el dato: el sistema trabaja con descriptores faciales.",
  },
  {
    icon: MapPin,
    number: "02",
    title: "El lugar sí importa.",
    description:
      "Geofence para marcaciones desde dispositivos móviles, configurado por sucursal para validar el radio de operación.",
  },
  {
    icon: BarChart3,
    number: "03",
    title: "Del registro al reporte.",
    description:
      "Historial, novedades y reportes de asistencia para revisar lo que pasó sin reconstruir el día en una hoja de cálculo.",
  },
  {
    icon: Braces,
    number: "04",
    title: "Listo para conversar.",
    description:
      "API pública, webhooks y servidor MCP para conectar la información de RR. HH. con los flujos de tu empresa.",
  },
];

const steps = [
  ["Configura", "Crea tu empresa, sucursales y reglas de ubicación."],
  ["Registra", "Agrega tu equipo y habilita sus registros faciales."],
  ["Marca", "Tu equipo registra entradas y salidas desde el flujo asignado."],
  ["Entiende", "Consulta asistencia, novedades y reportes en un solo lugar."],
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-black/10 bg-[#f6f3eb]">
        <div className="absolute inset-0 fine-grid opacity-60" />
        <div className="page-shell relative grid min-h-[calc(100vh-76px)] items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="relative z-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-bold backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#a67d08]" aria-hidden="true" />
              7 días de prueba · 10 registros faciales incluidos
            </div>
            <h1 className="display-title max-w-[760px] text-balance">
              La hora de entrada,{" "}
              <span className="relative whitespace-nowrap">
                sin cuentos.
                <span className="absolute -bottom-1 left-0 -z-10 h-[0.24em] w-full -rotate-1 bg-[#f9c626]" />
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[#646159] md:text-xl">
              Control de asistencia facial para saber quién llegó, desde dónde marcó y qué necesita
              tu atención. Claro para tu equipo. Útil para tu operación.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href={`${appUrl}/register`}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#171714] px-7 py-4 font-extrabold text-white transition hover:bg-[#34342f]"
              >
                Empezar prueba gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </a>
              <Link
                href="/producto"
                className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white/50 px-7 py-4 font-bold transition hover:bg-white"
              >
                Conocer el producto
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#68655d]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#8d6b08]" /> Sin tarjeta para empezar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#8d6b08]" /> Configuración guiada
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] lg:mx-0">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-black/10">
              <div className="hero-orbit absolute inset-6 rounded-full border border-dashed border-black/20">
                <span className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#171714]" />
              </div>
            </div>
            <div className="relative rounded-[2rem] border border-black/10 bg-[#171714] p-3 shadow-[0_35px_100px_-40px_rgba(0,0,0,0.65)] sm:p-5">
              <div className="overflow-hidden rounded-[1.45rem] bg-[#fdfbf5]">
                <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f9c626]" />
                    <span className="text-xs font-extrabold uppercase tracking-[0.12em]">
                      Hoy · Equipo central
                    </span>
                  </div>
                  <span className="text-xs text-[#7b776e]">En vivo</span>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
                  <div className="rounded-2xl bg-[#f9c626] p-5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">Personas presentes</span>
                      <Clock className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-7 text-5xl font-extrabold tracking-[-0.06em]">24</p>
                    <p className="mt-1 text-sm text-black/60">última marcación: entrada</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#77736a]">
                      A tiempo
                    </p>
                    <p className="mt-5 text-3xl font-extrabold">21</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#77736a]">
                      Por revisar
                    </p>
                    <p className="mt-5 text-3xl font-extrabold">03</p>
                  </div>
                </div>
                <div className="border-t border-black/10 px-6 py-5">
                  <div className="flex h-20 items-end gap-2">
                    {[35, 48, 42, 69, 56, 82, 74, 90, 65, 79, 94, 87].map((height, index) => (
                      <span
                        key={`${height}-${index}`}
                        className="flex-1 rounded-t-sm bg-[#171714]"
                        style={{ height: `${height}%`, opacity: 0.28 + index * 0.045 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="float-soft absolute -bottom-8 -left-4 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-xl sm:-left-10">
              <p className="text-xs font-bold text-[#77736a]">Marcación validada</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-extrabold">
                <MapPin className="h-4 w-4 text-[#9b7400]" /> Dentro de la sucursal
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 bg-[#fffdf7] py-10">
        <div className="page-shell flex flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
          <p className="max-w-md font-bold tracking-[-0.02em]">
            Pensado para operaciones con personas, turnos y sucursales; no para sumar otra hoja de
            cálculo.
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-[#625f57]">
            {["Asistencia", "Sucursales", "Novedades", "Reportes"].map((item) => (
              <span key={item} className="rounded-full border border-black/10 px-4 py-2">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#fffdf7] py-20 md:py-28">
        <div className="page-shell">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <span className="eyebrow">Todo en su lugar</span>
              <h2 className="section-title mt-5 max-w-2xl text-balance">
                Menos persecución. Más contexto.
              </h2>
            </div>
            <p className="max-w-lg self-end text-lg leading-8 text-[#68655d] lg:justify-self-end">
              Captura la marcación, valida sus condiciones y conviértela en información que tu
              equipo administrativo sí puede usar.
            </p>
          </div>

          <div className="mt-14 grid border-l border-t border-black/10 md:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="group border-b border-r border-black/10 p-6 transition hover:bg-[#f6f3eb] sm:p-9"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f9c626] transition-transform group-hover:rotate-3">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-extrabold text-black/30">{feature.number}</span>
                </div>
                <h3 className="mt-10 text-2xl font-extrabold tracking-[-0.04em]">{feature.title}</h3>
                <p className="mt-4 max-w-md leading-7 text-[#68655d]">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sun-grid border-y border-black/10 py-20 md:py-28">
        <div className="page-shell">
          <span className="eyebrow">Así se mueve</span>
          <h2 className="section-title mt-5 max-w-3xl text-balance">
            De cero a una operación que se explica sola.
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border border-black/15 bg-black/15 md:grid-cols-4">
            {steps.map(([title, description], index) => (
              <div key={title} className="bg-[#f9c626] p-7 sm:p-9">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-black/30 text-sm font-extrabold">
                  {index + 1}
                </span>
                <h3 className="mt-16 text-xl font-extrabold tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-black/65">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="integraciones" className="overflow-hidden bg-[#f2eee4] py-20 md:py-28">
        <div className="page-shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <span className="eyebrow">Conecta tu operación</span>
            <h2 className="section-title mt-5 text-balance">
              Tus datos no tienen que quedarse encerrados.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#68655d]">
              Usa la API pública, recibe eventos mediante webhooks o consulta información de RR. HH.
              desde clientes compatibles con MCP.
            </p>
            <Link
              href="/producto#integraciones"
              className="mt-8 inline-flex items-center gap-2 border-b-2 border-black pb-1 font-extrabold"
            >
              Ver capacidades técnicas <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="relative rounded-[2rem] bg-[#171714] p-6 text-white shadow-soft sm:p-9">
            <div className="absolute -right-28 -top-28 h-60 w-60 rounded-full bg-[#f9c626] blur-[90px] opacity-30" />
            <div className="relative flex items-center justify-between border-b border-white/15 pb-5">
              <p className="font-mono text-sm text-white/60">cuenti / integrations</p>
              <span className="h-2.5 w-2.5 rounded-full bg-[#f9c626]" />
            </div>
            <div className="relative mt-8 grid gap-3">
              {[
                ["API", "Consulta y escritura con tokens por empresa"],
                ["WEBHOOKS", "Eventos firmados para tus automatizaciones"],
                ["MCP", "Herramientas de consulta para RR. HH."],
              ].map(([name, description]) => (
                <div key={name} className="rounded-2xl border border-white/15 p-5 transition hover:border-[#f9c626]/60">
                  <div className="flex gap-4">
                    <span className="font-mono text-xs font-bold text-[#f9c626]">{name}</span>
                    <p className="text-sm leading-6 text-white/65">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RoiCalculator />

      <section className="relative overflow-hidden bg-[#fffdf7] py-20 md:py-28">
        <div className="absolute inset-0 dot-field opacity-40" />
        <div className="page-shell relative">
          <div className="rounded-[2.2rem] bg-[#f9c626] px-6 py-14 text-center shadow-soft sm:px-10 md:py-20">
            <ScanFace className="mx-auto h-10 w-10" aria-hidden="true" />
            <h2 className="section-title mx-auto mt-6 max-w-3xl text-balance">
              Que la próxima marcación ya cuente.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-black/65">
              Prueba cuenti time durante 7 días con hasta 10 registros faciales.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={`${appUrl}/register`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#171714] px-7 py-4 font-extrabold text-white hover:bg-[#34342f]"
              >
                Crear mi cuenta <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={`${appUrl}/pricing`}
                className="inline-flex items-center justify-center rounded-full border border-black/25 px-7 py-4 font-extrabold hover:bg-white/30"
              >
                Revisar planes
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
