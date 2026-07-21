import type { Metadata } from "next";
import { ArrowRight, Check, HelpCircle, Sparkles } from "lucide-react";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Precios",
  description: "Empieza con la prueba de 7 días de cuenti time y consulta los planes disponibles.",
  alternates: { canonical: absoluteUrl("/precios") },
  openGraph: {
    title: "Precios",
    description:
      "Empieza con la prueba de 7 días de cuenti time y consulta los planes disponibles.",
    url: absoluteUrl("/precios"),
    locale: siteConfig.locale,
    type: "website",
  },
};

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

const included = [
  "Hasta 10 registros faciales durante la prueba",
  "Sucursales y geofence móvil",
  "Marcaciones e historial de asistencia",
  "Reportes operativos",
  "Acceso a configuración de integraciones",
];

const faqs = [
  {
    question: "¿Cuánto dura la prueba?",
    answer:
      "La prueba dura 7 días desde la creación de la empresa e incluye capacidad para 10 registros faciales.",
  },
  {
    question: "¿El límite aplica a empleados o registros faciales?",
    answer:
      "Durante la prueba, el cupo de 10 aplica a nuevos registros faciales. Puedes organizar la información básica de tu equipo por separado.",
  },
  {
    question: "¿Qué puedo revisar durante la prueba?",
    answer:
      "Puedes recorrer el flujo de asistencia, configurar sucursales, consultar reportes y registrar hasta 10 identidades faciales.",
  },
  {
    question: "¿Dónde consulto el valor vigente de los planes?",
    answer:
      "La pantalla de planes de la aplicación muestra la información comercial vigente para continuar después de la prueba.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-black/10 bg-[#f6f3eb] py-20 md:py-28">
        <div className="absolute inset-0 fine-grid opacity-60" />
        <div className="page-shell relative text-center">
          <span className="eyebrow">Empieza por verlo funcionar</span>
          <h1 className="display-title mx-auto mt-7 max-w-5xl text-balance">
            Siete días para hacer cuentas con datos.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#68655d] md:text-xl">
            Configura tu operación, registra hasta 10 identidades faciales y recorre el flujo antes
            de elegir cómo continuar.
          </p>
        </div>
      </section>

      <section className="bg-[#fffdf7] py-16 md:py-24">
        <div className="page-shell">
          <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2.2rem] border border-black/10 shadow-soft lg:grid-cols-[0.9fr_1.1fr]">
            <div className="sun-grid flex flex-col justify-between p-7 sm:p-10 lg:p-12">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#171714] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-white">
                  <Sparkles className="h-3.5 w-3.5 text-[#f9c626]" aria-hidden="true" />
                  Prueba inicial
                </span>
                <p className="mt-10 text-7xl font-extrabold tracking-[-0.08em]">7</p>
                <p className="text-xl font-extrabold tracking-[-0.03em]">días para explorar</p>
                <p className="mt-4 max-w-sm leading-7 text-black/65">
                  Recorre el producto con tu operación. Al terminar, revisa el precio vigente en la
                  aplicación.
                </p>
              </div>
              <a
                href={`${appUrl}/register`}
                className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-[#171714] px-6 py-4 font-extrabold text-white transition hover:bg-[#34342f]"
              >
                Activar prueba <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="bg-[#171714] p-7 text-white sm:p-10 lg:p-12">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f9c626]">
                Qué puedes recorrer
              </p>
              <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl">
                El flujo real, con tu contexto.
              </h2>
              <ul className="mt-9 grid gap-4">
                {included.map((item) => (
                  <li key={item} className="flex gap-3 border-b border-white/10 pb-4 text-white/75">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f9c626] text-[#171714]">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-sm leading-6">{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href={`${appUrl}/pricing`}
                className="mt-8 inline-flex items-center gap-2 border-b border-white/40 pb-1 text-sm font-bold text-white/75 hover:text-white"
              >
                Consultar planes vigentes <ArrowRight className="h-4 w-4" aria-hidden="true" />
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

      <section className="bg-[#fffdf7] py-20 text-center md:py-28">
        <div className="page-shell">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8d6b08]">
            Tu operación pone los datos
          </p>
          <h2 className="section-title mx-auto mt-5 max-w-3xl text-balance">
            Empieza sin comprometerte a adivinar.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[#68655d]">
            Crea tu empresa, prueba el flujo y decide con el contexto de tu propio equipo.
          </p>
          <a
            href={`${appUrl}/register`}
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#f9c626] px-7 py-4 font-extrabold transition hover:bg-[#e9b817]"
          >
            Empezar prueba de 7 días <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}
