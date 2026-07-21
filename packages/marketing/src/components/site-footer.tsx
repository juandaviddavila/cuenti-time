import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#050c12] text-white">
      <div className="page-shell py-14 md:py-16">
        <div className="grid gap-12 border-b border-white/[0.08] pb-12 lg:grid-cols-[1.5fr_0.7fr_0.7fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06]">
                <Image src="/logo-simbolo.svg" alt="" width={23} height={23} />
              </span>
              <span className="text-lg font-bold tracking-[-0.04em]">
                cuenti <span className="text-[#55e6c1]">time</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/50">
              Evidencia clara de asistencia para operaciones con personas, turnos y sucursales.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#55e6c1]">
              Producto
            </p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/55">
              <Link href="/producto" className="hover:text-white">Producto</Link>
              <Link href="/#funciones" className="hover:text-white">Funciones</Link>
              <Link href="/precios" className="hover:text-white">Precios</Link>
              <Link href="/#roi" className="hover:text-white">Calculadora ROI</Link>
              <Link href="/#integraciones" className="hover:text-white">Integraciones</Link>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#55e6c1]">
              Recursos
            </p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/55">
              <Link href="/recursos" className="hover:text-white">Guías y contexto</Link>
              <a href={`${appUrl}/login`} className="hover:text-white">Ingresar</a>
              <a href={`${appUrl}/register`} className="hover:text-white">Crear cuenta</a>
              <a href={`${appUrl}/pricing`} className="inline-flex items-center gap-1 hover:text-white">
                Ver planes <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} cuenti time. Hecho para equipos que mueven a Colombia.</p>
          <p>Control de asistencia con criterio y privacidad.</p>
        </div>
      </div>
    </footer>
  );
}
