import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { articles, getArticleBySlug } from "@/lib/articles";
import { absoluteUrl, appUrl, siteConfig } from "@/lib/site";

interface ArticlePageProps {
  params: {
    slug: string;
  };
}

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function generateStaticParams(): ArticlePageProps["params"][] {
  return articles.map((article) => ({ slug: article.slug }));
}

export function generateMetadata({ params }: ArticlePageProps): Metadata {
  const article = getArticleBySlug(params.slug);

  if (!article) {
    return {
      title: "Artículo no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const url = absoluteUrl(`/recursos/${article.slug}`);

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      url,
      locale: siteConfig.locale,
      publishedTime: article.publishedAt,
      authors: [siteConfig.name],
    },
  };
}

export default function ArticlePage({ params }: ArticlePageProps) {
  const article = getArticleBySlug(params.slug);

  if (!article) {
    notFound();
  }

  const articleUrl = absoluteUrl(`/recursos/${article.slug}`);
  const publishedLabel = dateFormatter.format(
    new Date(`${article.publishedAt}T00:00:00Z`),
  );

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.description,
          datePublished: article.publishedAt,
          dateModified: article.publishedAt,
          inLanguage: "es-CO",
          mainEntityOfPage: articleUrl,
          author: {
            "@type": "Organization",
            name: siteConfig.name,
            url: siteConfig.siteUrl,
          },
          publisher: {
            "@type": "Organization",
            name: siteConfig.name,
            url: siteConfig.siteUrl,
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Inicio",
              item: absoluteUrl("/"),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Recursos",
              item: absoluteUrl("/recursos"),
            },
            {
              "@type": "ListItem",
              position: 3,
              name: article.title,
              item: articleUrl,
            },
          ],
        }}
      />

      <article>
        <header className="fine-grid border-b border-black/10 bg-paper py-16 md:py-24">
          <div className="page-shell max-w-4xl">
            <nav
              aria-label="Migas de pan"
              className="mb-10 flex flex-wrap items-center gap-2 text-sm font-bold text-black/55"
            >
              <Link href="/" className="hover:text-black">
                Inicio
              </Link>
              <span aria-hidden="true">/</span>
              <Link href="/recursos" className="hover:text-black">
                Recursos
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="text-black">
                {article.category}
              </span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 text-xs font-extrabold uppercase tracking-[0.14em]">
              <span className="rounded-full bg-sun px-3 py-1">
                {article.category}
              </span>
              <time dateTime={article.publishedAt}>{publishedLabel}</time>
              <span aria-hidden="true">·</span>
              <span>{article.readingTime}</span>
            </div>

            <h1 className="text-balance mt-7 text-4xl font-extrabold leading-[1.02] tracking-[-0.055em] md:text-6xl">
              {article.title}
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-black/65 md:text-xl">
              {article.description}
            </p>
          </div>
        </header>

        <div className="page-shell max-w-4xl py-12 md:py-20">
          <aside className="border-l-4 border-sun bg-paper p-6 md:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-black/55">
              Respuesta corta
            </p>
            <p className="mt-3 text-lg font-bold leading-8 md:text-xl">
              {article.answer}
            </p>
          </aside>

          <div className="mt-14 space-y-14">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-balance text-3xl font-extrabold tracking-[-0.045em] md:text-4xl">
                  {section.heading}
                </h2>
                <div className="mt-6 space-y-5 text-[1.0625rem] leading-8 text-black/75">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="mt-7 grid gap-3 border-y border-black/10 py-6 text-[1.0625rem] leading-7 md:grid-cols-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sun"
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <section className="mt-16 border-t border-black/10 pt-10">
            <h2 className="text-2xl font-extrabold tracking-[-0.035em]">
              Fuentes consultadas
            </h2>
            <p className="mt-3 leading-7 text-black/60">
              Las referencias permiten revisar el contexto original. Las guías
              de este sitio son informativas y no sustituyen asesoría jurídica,
              contable o de seguridad.
            </p>
            <ol className="mt-6 space-y-3">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline decoration-sun decoration-2 underline-offset-4 hover:decoration-black"
                  >
                    {source.title}
                    <span className="sr-only"> (abre en una pestaña nueva)</span>
                  </a>
                </li>
              ))}
            </ol>
          </section>

          <footer className="sun-grid mt-16 border border-black/10 p-7 md:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.15em]">
              Lleva estas ideas a la práctica
            </p>
            <div className="mt-4 flex flex-col items-start justify-between gap-7 md:flex-row md:items-end">
              <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-[-0.045em] md:text-4xl">
                Gestiona asistencia con reglas claras y evidencia útil.
              </h2>
              <Link
                href={appUrl("/register")}
                className="shrink-0 bg-black px-7 py-4 text-sm font-extrabold text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                Crear cuenta
              </Link>
            </div>
          </footer>

          <div className="mt-10">
            <Link
              href="/recursos"
              className="text-sm font-extrabold underline decoration-sun decoration-2 underline-offset-4"
            >
              ← Volver a todos los recursos
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
