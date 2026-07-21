import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { JsonLd } from "@/components/json-ld";
import { articles } from "@/lib/articles";
import { absoluteUrl, appUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Recursos sobre asistencia y gestión del tiempo",
  description:
    "Guías originales sobre control de asistencia, normativa colombiana, biometría, nómina, productividad e integraciones para RR. HH.",
  alternates: {
    canonical: absoluteUrl("/recursos"),
  },
  openGraph: {
    title: "Recursos sobre asistencia y gestión del tiempo",
    description:
      "Criterios prácticos para tomar mejores decisiones de asistencia, nómina y datos laborales.",
    url: absoluteUrl("/recursos"),
    type: "website",
    locale: siteConfig.locale,
  },
};

export default function ResourcesPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Recursos de cuenti time",
          description: metadata.description ?? "",
          url: absoluteUrl("/recursos"),
          mainEntity: {
            "@type": "ItemList",
            itemListElement: articles.map((article, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: absoluteUrl(`/recursos/${article.slug}`),
              name: article.title,
            })),
          },
        }}
      />

      <section className="fine-grid border-b border-black/10 bg-paper py-20 md:py-28">
        <div className="page-shell max-w-5xl">
          <span className="eyebrow">Biblioteca práctica</span>
          <h1 className="display-title text-balance mt-6 max-w-5xl">
            Tiempo, personas y evidencia.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 text-black/65 md:text-xl">
            Guías para gestionar asistencia con criterio: normativa colombiana,
            privacidad, nómina, productividad e integraciones explicadas sin
            promesas infladas.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="page-shell">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <span className="eyebrow">Lecturas recientes</span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] md:text-5xl">
                Diez decisiones mejor informadas
              </h2>
            </div>
            <p className="hidden text-sm font-bold text-black/50 md:block">
              {articles.length} artículos originales
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
      </section>

      <section className="sun-grid border-y border-black/10 py-16 md:py-24">
        <div className="page-shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <span className="text-xs font-extrabold uppercase tracking-[0.15em]">
              De la lectura a la operación
            </span>
            <h2 className="section-title text-balance mt-5">
              Prueba una gestión del tiempo más clara.
            </h2>
          </div>
          <Link
            href={appUrl("/register")}
            className="shrink-0 bg-black px-7 py-4 text-sm font-extrabold text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Crear cuenta
          </Link>
        </div>
      </section>
    </>
  );
}
