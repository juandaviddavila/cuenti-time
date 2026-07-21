import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578").replace(
  /\/$/,
  "",
);

const navigation = [
  { href: "/producto", label: "Producto" },
  { href: "/precios", label: "Precios" },
  { href: "/recursos", label: "Recursos" },
  { href: "/#integraciones", label: "Integraciones" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-[#fffdf7]/90 backdrop-blur-xl">
      <div className="page-shell flex h-[76px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="cuenti time, inicio">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#171714]">
            <Image src="/logo-simbolo.svg" alt="" width={24} height={24} priority />
          </span>
          <span className="text-[1.05rem] font-extrabold tracking-[-0.04em]">
            cuenti <span className="text-[#9a7510]">time</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navegación principal">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-[#5d5b54] transition hover:text-black"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={`${appUrl}/login`}
            className="rounded-full px-4 py-2.5 text-sm font-bold transition hover:bg-black/5"
          >
            Ingresar
          </a>
          <a
            href={`${appUrl}/register`}
            className="group inline-flex items-center gap-2 rounded-full bg-[#171714] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#34342f]"
          >
            Prueba de 7 días
            <ArrowUpRight
              className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>

        <details className="group relative md:hidden">
          <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border border-black/15 [&::-webkit-details-marker]:hidden">
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Abrir menú</span>
          </summary>
          <div className="absolute right-0 top-14 w-[min(310px,calc(100vw-32px))] rounded-3xl border border-black/10 bg-[#fffdf7] p-3 shadow-2xl">
            <nav className="flex flex-col" aria-label="Navegación móvil">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl px-4 py-3.5 text-base font-bold hover:bg-black/5"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-2 h-px bg-black/10" />
              <a href={`${appUrl}/login`} className="rounded-2xl px-4 py-3.5 font-bold">
                Ingresar
              </a>
              <a
                href={`${appUrl}/register`}
                className="mt-1 rounded-2xl bg-[#f9c626] px-4 py-3.5 text-center font-extrabold"
              >
                Probar 7 días
              </a>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
