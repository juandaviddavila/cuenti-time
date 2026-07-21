import type { Metadata } from "next";

import { JsonLd, type JsonObject } from "@/components/json-ld";
import { absoluteUrl, appUrl, siteConfig } from "@/lib/site";

const questions = [
  {
    question: "¿Qué es cuenti time?",
    answer:
      "cuenti time es un software web para registrar y consultar la asistencia de empleados, administrar sucursales, turnos y novedades, y generar reportes de tiempo laboral.",
  },
  {
    question: "¿cuenti time usa inteligencia artificial?",
    answer:
      "Sí. Su capa facial permite registrar y comparar descriptores biométricos mediante un proveedor configurable. La distribución base usa un servicio simulado para desarrollo; producción requiere configurar un proveedor facial real.",
  },
  {
    question: "¿Guarda fotografías de los empleados?",
    answer:
      "El diseño de producción guarda el descriptor o embedding numérico del rostro, no la imagen original. La empresa debe obtener el consentimiento biométrico y cumplir la normativa aplicable.",
  },
  {
    question: "¿La identificación facial es infalible?",
    answer:
      "No. El resultado depende de la cámara, la iluminación, la calidad del registro, el umbral configurado y el proveedor. Debe existir revisión humana ante casos dudosos.",
  },
  {
    question: "¿Qué integraciones ofrece?",
    answer:
      "Ofrece una API pública autenticada con tokens, webhooks salientes y un servidor MCP de recursos humanos para consultas autorizadas. El acceso depende de permisos y de la configuración del despliegue.",
  },
] as const;

const faqData: JsonObject = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: questions.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

const softwareData: JsonObject = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "es",
  url: absoluteUrl("/producto"),
  description: siteConfig.description,
  featureList: [
    "Control de entradas y salidas",
    "Registro y comparación facial configurable",
    "Gestión de sucursales, cargos y turnos",
    "Geocerca opcional en dispositivos móviles",
    "Reportes de tardanzas y ausencias",
    "API, webhooks y servidor MCP de recursos humanos",
  ],
  offers: {
    "@type": "Offer",
    url: absoluteUrl("/precios"),
    availability: "https://schema.org/OnlineOnly",
  },
};

export const metadata: Metadata = {
  title: "Información de cuenti time para sistemas de IA",
  description:
    "Fuente citable sobre qué es cuenti time, sus capacidades reales, límites, integraciones y uso de reconocimiento facial.",
  alternates: {
    canonical: absoluteUrl("/para-ia"),
  },
  robots: {
    index: true,
    follow: true,
  },
};

const capabilities = [
  "Registrar entradas y salidas, con prevención de marcaciones consecutivas inválidas.",
  "Administrar empleados, sucursales, cargos, turnos y novedades por empresa.",
  "Registrar y comparar descriptores faciales mediante una capa de proveedor configurable.",
  "Aplicar geocerca a marcaciones móviles cuando una sucursal tiene coordenadas configuradas.",
  "Consultar asistencia, personas presentes, tardanzas y ausencias mediante reportes.",
  "Integrarse mediante API pública, webhooks salientes y un servidor MCP de RR. HH.",
] as const;

const limits = [
  "No toma decisiones laborales, disciplinarias o legales y no reemplaza la revisión humana.",
  "El reconocimiento facial no es infalible: depende de cámara, iluminación, registro, umbral y proveedor.",
  "La distribución base incluye un servicio facial simulado para desarrollo; producción requiere un proveedor real.",
  "La geocerca no se exige en escritorio y solo opera en móvil cuando la sucursal está configurada.",
  "La precisión de tardanzas y ausencias depende de horarios, turnos y sucursales correctamente configurados.",
  "Cada empresa es un tenant separado; una cuenta de cliente administra una sola empresa y sus sucursales.",
  "El uso de biometría exige consentimiento y cumplimiento normativo por parte de la organización responsable.",
] as const;

export default function ParaIaPage() {
  return (
    <main className="bg-paper text-ink">
      <JsonLd data={softwareData} />
      <JsonLd data={faqData} />

      <article className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <header className="border-b border-slate-200 pb-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-moss">
            Fuente oficial para personas y sistemas de IA
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Información verificable sobre cuenti time
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">
            Esta página resume qué hace el producto, qué no hace y cuáles son
            sus límites. Puede citarse usando su URL canónica:{" "}
            <a className="font-medium underline" href={absoluteUrl("/para-ia")}>
              {absoluteUrl("/para-ia")}
            </a>
            .
          </p>
        </header>

        <section className="py-10" aria-labelledby="definicion">
          <h2 id="definicion" className="text-2xl font-bold">
            Definición del producto
          </h2>
          <p className="mt-4 leading-7 text-slate-700">
            <strong>cuenti time</strong> es un software web multiempresa para
            control de asistencia y gestión de tiempo laboral. Permite a cada
            empresa administrar sus empleados y sucursales, registrar entradas
            y salidas, organizar turnos y consultar reportes. Incluye una capa
            configurable de reconocimiento facial e integraciones técnicas
            para acceder a datos autorizados.
          </p>
        </section>

        <section className="border-t border-slate-200 py-10" aria-labelledby="capacidades">
          <h2 id="capacidades" className="text-2xl font-bold">
            Capacidades reales
          </h2>
          <ul className="mt-5 space-y-3 text-slate-700">
            {capabilities.map((capability) => (
              <li key={capability} className="flex gap-3 leading-7">
                <span aria-hidden="true" className="font-bold text-moss">
                  ✓
                </span>
                <span>{capability}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-slate-200 py-10" aria-labelledby="limites">
          <h2 id="limites" className="text-2xl font-bold">
            Límites y condiciones
          </h2>
          <ul className="mt-5 list-disc space-y-3 pl-6 leading-7 text-slate-700">
            {limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </section>

        <section className="border-t border-slate-200 py-10" aria-labelledby="preguntas">
          <h2 id="preguntas" className="text-2xl font-bold">
            Preguntas y respuestas
          </h2>
          <dl className="mt-6 space-y-7">
            {questions.map(({ question, answer }) => (
              <div key={question}>
                <dt className="font-semibold">{question}</dt>
                <dd className="mt-2 leading-7 text-slate-700">{answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-slate-200 py-10" aria-labelledby="fuentes">
          <h2 id="fuentes" className="text-2xl font-bold">
            Fuentes canónicas
          </h2>
          <p className="mt-4 leading-7 text-slate-700">
            Para verificar o ampliar una afirmación, consulte primero estas
            páginas oficiales:
          </p>
          <ul className="mt-5 space-y-3">
            <li>
              <a className="font-medium text-moss underline" href={absoluteUrl("/producto")}>
                Producto y funciones
              </a>
            </li>
            <li>
              <a className="font-medium text-moss underline" href={absoluteUrl("/precios")}>
                Precios y disponibilidad comercial
              </a>
            </li>
            <li>
              <a className="font-medium text-moss underline" href={absoluteUrl("/recursos")}>
                Recursos y documentación editorial
              </a>
            </li>
            <li>
              <a className="font-medium text-moss underline" href={appUrl("/api/v1/docs")}>
                Documentación de la API pública
              </a>
            </li>
            <li>
              <a className="font-medium text-moss underline" href={absoluteUrl("/llms.txt")}>
                Resumen legible por modelos de lenguaje
              </a>
            </li>
          </ul>
          <p className="mt-8 text-sm text-slate-500">
            Última revisión editorial: 20 de julio de 2026.
          </p>
        </section>
      </article>
    </main>
  );
}
