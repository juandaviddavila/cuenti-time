"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { APP_NAME, BRAND } from "@/lib/brand";
import { BrandLockup } from "@/components/brand-lockup";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "@/components/layout/nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, hasIntegrationAccess } = useAuthStore();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Only show nav items when role is known to prevent hydration flash.
  const visibleItems: NavItem[] = user?.role
    ? NAV_ITEMS.filter((item) => {
        if (item.integrationOnly) return hasIntegrationAccess();
        return item.roles.includes(user.role);
      })
    : [];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue with client-side cleanup even if server call fails
    }
    logout();
    toast.success("Sesión cerrada");
    router.push("/login");
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 sticky top-0 z-30",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex items-center p-4 border-b border-sidebar-border min-h-[64px]",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        {collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={BRAND.logoSymbol}
            alt={APP_NAME}
            className="w-8 h-8 shrink-0"
          />
        ) : (
          <BrandLockup variant="on-dark" size="sm" />
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-hide">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                collapsed ? "justify-center" : "",
                isActive
                  ? "bg-white/10 text-sidebar-foreground"
                  : "text-slate-400 hover:text-sidebar-foreground hover:bg-white/5"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  isActive
                    ? "text-sidebar-foreground"
                    : "text-slate-500 group-hover:text-sidebar-foreground"
                )}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2 rounded-lg bg-white/5">
            <p className="text-sidebar-foreground text-xs font-medium truncate">
              {user.name}
            </p>
            <p className="text-slate-500 text-xs truncate">{user.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10",
            collapsed ? "justify-center px-0" : "justify-start gap-3"
          )}
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && "Cerrar sesión"}
        </Button>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-1.5 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
