import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

export function SiteFooter() {
  return (
    <footer className="bg-[#171714] text-white">
      <div className="page-shell py-16 md:py-20">
        <div className="grid gap-12 border-b border-white/15 pb-14 lg:grid-cols-[1.4fr_0.6fr_0.6fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <Image src="/logo-simbolo.svg" alt="" width={34} height={34} />
              <span className="text-xl font-extrabold tracking-[-0.04em]">cuenti time</span>
            </Link>
            <p className="mt-5 max-w-md text-base leading-7 text-white/60">
              La asistencia de tu equipo, clara desde la entrada hasta el reporte.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f9c626]">
              Explorar
            </p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/70">
              <Link href="/producto" className="hover:text-white">Producto</Link>
              <Link href="/precios" className="hover:text-white">Precios</Link>
              <Link href="/#roi" className="hover:text-white">Calculadora ROI</Link>
              <Link href="/#integraciones" className="hover:text-white">Integraciones</Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f9c626]">
              Tu cuenta
            </p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/70">
              <a href={`${appUrl}/login`} className="hover:text-white">Ingresar</a>
              <a href={`${appUrl}/register`} className="hover:text-white">Crear cuenta</a>
              <a href={`${appUrl}/pricing`} className="inline-flex items-center gap-1 hover:text-white">
                Ver planes <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-7 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} cuenti time. Hecho para equipos que mueven a Colombia.</p>
          <p>Control de asistencia con criterio.</p>
        </div>
      </div>
    </footer>
  );
}
