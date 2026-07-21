import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="fine-grid grid min-h-[70vh] place-items-center px-6 py-20">
      <div className="max-w-xl text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="section-title mt-5">Esta página no marcó entrada.</h1>
        <p className="mt-6 text-lg leading-8 text-black/60">
          El enlace cambió o el recurso ya no está disponible.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-black px-7 py-4 font-extrabold text-white"
        >
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
