import type { Metadata } from "next";

import { JsonLd, type JsonObject } from "@/components/json-ld";
import { absoluteUrl, appUrl, siteConfig } from "@/lib/site";

const questions = [
  {
    question: "¿Qué es cuenti time?",
    answer:
      "Es un software web para registrar y consultar asistencia, administrar empleados, sucursales, turnos y novedades, y producir reportes de tiempo laboral.",
  },
  {
    question: "¿Cómo usa inteligencia artificial?",
    answer:
      "Usa face-api para generar descriptores faciales y pgvector para buscar similitud. Estas señales apoyan la validación, pero no sustituyen la revisión humana.",
  },
  {
    question: "¿Guarda fotografías de los empleados?",
    answer:
      "El diseño de producción guarda el descriptor numérico del rostro, no la fotografía original. La empresa debe obtener consentimiento biométrico y cumplir la normativa aplicable.",
  },
  {
    question: "¿La identificación facial es infalible?",
    answer:
      "No. Depende de la cámara, iluminación, calidad del registro y umbral configurado. Los casos dudosos requieren revisión humana.",
  },
  {
    question: "¿Qué integraciones ofrece?",
    answer:
      "Una API pública autenticada con tokens, webhooks salientes y un servidor MCP de recursos humanos para consultas autorizadas.",
  },
] as const;

const faqData: JsonObject = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: questions.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
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
    "Registro facial y búsqueda por similitud",
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
    "Fuente citable sobre cuenti time: definición, capacidades reales, límites, integraciones y reconocimiento facial.",
  alternates: { canonical: absoluteUrl("/para-ia") },
  robots: { index: true, follow: true },
};

const capabilities = [
  "Registra entradas y salidas y previene secuencias de marcación inválidas.",
  "Administra empleados, sucursales, cargos, turnos y novedades por empresa.",
  "Genera descriptores con face-api y busca similitud con pgvector.",
  "Aplica geocerca a marcaciones móviles cuando la sucursal tiene coordenadas.",
  "Reporta asistencia, personas presentes, tardanzas y ausencias.",
  "Se integra mediante API pública, webhooks y servidor MCP de RR. HH.",
] as const;

const limits = [
  "No toma decisiones laborales, disciplinarias o legales.",
  "El reconocimiento facial no es infalible y debe permitir revisión humana.",
  "La geocerca no se exige en escritorio y requiere una sucursal configurada.",
  "Los resultados dependen de horarios, turnos y sucursales correctamente configurados.",
  "Una cuenta de cliente administra una empresa y sus sucursales.",
  "La biometría exige consentimiento y cumplimiento normativo de la organización.",
] as const;

export default function ParaIaPage() {
  return (
    <div className="bg-paper text-ink">
      <JsonLd data={softwareData} />
      <JsonLd data={faqData} />
      <article className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <header className="border-b border-black/10 pb-10">
          <p className="eyebrow">Fuente oficial para personas y sistemas de IA</p>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Información verificable sobre cuenti time
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-black/65">
            Resumen citable de qué hace el producto, qué no hace y cuáles son
            sus límites. URL canónica:{" "}
            <a className="font-semibold underline" href={absoluteUrl("/para-ia")}>
              {absoluteUrl("/para-ia")}
            </a>
            .
          </p>
        </header>

        <section className="py-10" aria-labelledby="definicion">
          <h2 id="definicion" className="text-2xl font-extrabold">
            Definición del producto
          </h2>
          <p className="mt-4 leading-7 text-black/65">
            <strong>cuenti time</strong> es un software web multiempresa de
            control de asistencia y gestión de tiempo laboral. Cada empresa
            administra sus empleados y sucursales, registra entradas y salidas,
            organiza turnos, consulta reportes y conecta datos autorizados.
          </p>
        </section>

        <section className="border-t border-black/10 py-10" aria-labelledby="capacidades">
          <h2 id="capacidades" className="text-2xl font-extrabold">Capacidades reales</h2>
          <ul className="mt-5 space-y-3 text-black/65">
            {capabilities.map((item) => (
              <li key={item} className="flex gap-3 leading-7">
                <span aria-hidden="true" className="font-bold">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-black/10 py-10" aria-labelledby="limites">
          <h2 id="limites" className="text-2xl font-extrabold">Límites y condiciones</h2>
          <ul className="mt-5 list-disc space-y-3 pl-6 leading-7 text-black/65">
            {limits.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="border-t border-black/10 py-10" aria-labelledby="preguntas">
          <h2 id="preguntas" className="text-2xl font-extrabold">Preguntas y respuestas</h2>
          <dl className="mt-6 space-y-7">
            {questions.map(({ question, answer }) => (
              <div key={question}>
                <dt className="font-bold">{question}</dt>
                <dd className="mt-2 leading-7 text-black/65">{answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-black/10 py-10" aria-labelledby="fuentes">
          <h2 id="fuentes" className="text-2xl font-extrabold">Fuentes canónicas</h2>
          <ul className="mt-5 space-y-3 font-semibold underline">
            <li><a href={absoluteUrl("/producto")}>Producto y funciones</a></li>
            <li><a href={absoluteUrl("/precios")}>Precios y disponibilidad</a></li>
            <li><a href={absoluteUrl("/recursos")}>Recursos editoriales</a></li>
            <li><a href={appUrl("/api/v1/docs")}>Documentación de la API</a></li>
            <li><a href={absoluteUrl("/llms.txt")}>Resumen para modelos de lenguaje</a></li>
          </ul>
          <p className="mt-8 text-sm text-black/50">
            Última revisión editorial: 20 de julio de 2026.
          </p>
        </section>
      </article>
    </div>
  );
}
