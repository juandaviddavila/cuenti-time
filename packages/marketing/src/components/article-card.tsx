import Link from "next/link";
import type { Article } from "@/lib/articles";

interface ArticleCardProps {
  article: Article;
}

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <article className="group relative flex h-full flex-col border border-black/10 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:shadow-soft md:p-8">
      <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold uppercase tracking-[0.14em] text-black/55">
        <span className="rounded-full bg-sun px-3 py-1 text-black">
          {article.category}
        </span>
        <time dateTime={article.publishedAt}>
          {dateFormatter.format(new Date(`${article.publishedAt}T00:00:00Z`))}
        </time>
        <span aria-hidden="true">·</span>
        <span>{article.readingTime}</span>
      </div>

      <h2 className="text-balance text-2xl font-extrabold leading-tight tracking-[-0.035em] md:text-3xl">
        <Link
          href={`/recursos/${article.slug}`}
          className="outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-black"
        >
          {article.title}
        </Link>
      </h2>

      <p className="mt-4 flex-1 leading-7 text-black/65">{article.description}</p>

      <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-5 text-sm font-extrabold">
        <span>Leer artículo</span>
        <span
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </article>
  );
}
