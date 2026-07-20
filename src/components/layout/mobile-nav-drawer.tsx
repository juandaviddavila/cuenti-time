"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { NAV_ITEMS, type NavItem } from "@/components/layout/nav-items";

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, hasIntegrationAccess } = useAuthStore();

  const visibleItems: NavItem[] = user?.role
    ? NAV_ITEMS.filter((item) => {
        if (item.integrationOnly) return hasIntegrationAccess();
        return item.roles.includes(user.role);
      })
    : [];

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    onOpenChange(false);
    // Close when navigating; pathname is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // continue client cleanup
    }
    logout();
    onOpenChange(false);
    toast.success("Sesión cerrada");
    router.push("/login");
  };

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Cerrar menú"
        onClick={() => onOpenChange(false)}
      />
      <aside
        id="mobile-nav-drawer"
        className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-sidebar border-r border-sidebar-border shadow-xl animate-in slide-in-from-left duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b border-sidebar-border min-h-[56px]">
          <BrandLockup variant="on-dark" size="sm" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-sidebar-foreground"
            aria-label="Cerrar menú"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-sidebar-foreground"
                    : "text-slate-400 hover:text-sidebar-foreground hover:bg-white/5"
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 shrink-0",
                    isActive ? "text-sidebar-foreground" : "text-slate-500"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          {user && (
            <div className="px-3 py-2 rounded-lg bg-white/5">
              <p className="text-sidebar-foreground text-xs font-medium truncate">
                {user.name}
              </p>
              <p className="text-slate-500 text-xs truncate">{user.email}</p>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
    </div>
  );
}
