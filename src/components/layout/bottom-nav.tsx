"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ScanFace,
  Clock,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { label: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { label: "Empleados", href: "/employees", icon: Users },
  { label: "Facial", href: "/facial-registration", icon: ScanFace },
  { label: "Asistencia", href: "/attendance", icon: Clock },
  { label: "Informes", href: "/reports", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-sidebar/95 backdrop-blur-md border-t border-sidebar-border safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-1.5">
        {MOBILE_NAV.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                isActive
                  ? "text-blue-400"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
