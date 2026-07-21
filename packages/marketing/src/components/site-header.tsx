import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { fetchBillingConfig } from "@/lib/billing";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

const navigation = [
  { href: "/producto", label: "Producto" },
  { href: "/#funciones", label: "Funciones" },
  { href: "/#integraciones", label: "Integraciones" },
  { href: "/precios", label: "Precios" },
  { href: "/recursos", label: "Recursos" },
];

export async function SiteHeader() {
  const billing = await fetchBillingConfig();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#071018]/90 text-white backdrop-blur-xl">
      <div className="border-b border-white/[0.06] bg-[#09151e]">
        <div className="page-shell flex h-7 items-center justify-center text-center text-[10px] font-medium tracking-[0.08em] text-white/55 sm:text-[11px]">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#55e6c1]" />
          Plan gratis · Hasta {billing.freeEmployeeLimit} empleados · Sin tarjeta
        </div>
      </div>
      <div className="page-shell flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="cuenti time, inicio">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.06]">
            <Image src="/logo-simbolo.svg" alt="" width={21} height={21} priority />
          </span>
          <span className="text-base font-bold tracking-[-0.035em]">
            cuenti <span className="text-[#55e6c1]">time</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Navegación principal">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium text-white/58 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <a
            href={`${appUrl}/login`}
            className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            Ingresar
          </a>
          <a
            href={`${appUrl}/register`}
            className="group inline-flex items-center gap-2 rounded-lg bg-[#55e6c1] px-4 py-2.5 text-[13px] font-bold text-[#061019] transition hover:bg-[#76efd1]"
          >
            Empezar gratis
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>

        <details className="group relative sm:hidden">
          <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg border border-white/15 text-white [&::-webkit-details-marker]:hidden">
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Abrir menú</span>
          </summary>
          <div className="absolute right-0 top-12 w-[min(310px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#0b1821] p-3 shadow-2xl">
            <nav className="flex flex-col" aria-label="Navegación móvil">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.06] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-2 h-px bg-white/10" />
              <a href={`${appUrl}/login`} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75">
                Ingresar
              </a>
              <a
                href={`${appUrl}/register`}
                className="mt-1 rounded-xl bg-[#55e6c1] px-4 py-3 text-center text-sm font-bold text-[#061019]"
              >
                Empezar gratis
              </a>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
