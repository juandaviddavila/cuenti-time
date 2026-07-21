"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { APP_NAME, BRAND } from "@/lib/brand";
import { BrandLockup } from "@/components/brand-lockup";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import {
  filterNavEntries,
  groupContainsActivePath,
  isNavGroup,
  isPathActive,
  type NavEntry,
  type NavGroup,
  type NavLink,
} from "@/components/layout/nav-items";

function NavLinkRow({
  item,
  pathname,
  collapsed,
  nested = false,
}: {
  item: NavLink;
  pathname: string;
  collapsed: boolean;
  nested?: boolean;
}) {
  const isActive = isPathActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 group",
        nested ? "px-3 py-2 ml-2" : "px-3 py-2.5",
        collapsed ? "justify-center" : "",
        isActive
          ? "bg-white/10 text-sidebar-foreground"
          : "text-slate-400 hover:text-sidebar-foreground hover:bg-white/5"
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon
        className={cn(
          "shrink-0",
          nested ? "w-4 h-4" : "w-5 h-5",
          isActive
            ? "text-sidebar-foreground"
            : "text-slate-500 group-hover:text-sidebar-foreground"
        )}
      />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function NavGroupBlock({
  group,
  pathname,
  collapsed,
  open,
  onToggle,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const childActive = groupContainsActivePath(group, pathname);
  const groupActive = Boolean(group.href && isPathActive(pathname, group.href)) || childActive;

  if (collapsed) {
    const target = group.href ?? group.children[0]?.href ?? "#";
    return (
      <Link
        href={target}
        className={cn(
          "flex items-center justify-center px-3 py-2.5 rounded-lg transition-all",
          groupActive
            ? "bg-white/10 text-sidebar-foreground"
            : "text-slate-400 hover:text-sidebar-foreground hover:bg-white/5"
        )}
        title={group.label}
      >
        <group.icon className="w-5 h-5 shrink-0" />
      </Link>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
          groupActive
            ? "bg-white/10 text-sidebar-foreground"
            : "text-slate-400 hover:text-sidebar-foreground hover:bg-white/5"
        )}
        aria-expanded={open}
      >
        <group.icon
          className={cn(
            "w-5 h-5 shrink-0",
            groupActive ? "text-sidebar-foreground" : "text-slate-500"
          )}
        />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="space-y-0.5 border-l border-white/10 ml-5 pl-1">
          {group.children.map((child) => (
            <NavLinkRow
              key={child.href}
              item={child}
              pathname={pathname}
              collapsed={false}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, hasIntegrationAccess } = useAuthStore();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const visibleEntries: NavEntry[] = filterNavEntries(
    user?.role,
    hasIntegrationAccess()
  );

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const entry of visibleEntries) {
        if (isNavGroup(entry) && groupContainsActivePath(entry, pathname)) {
          next[entry.id] = true;
        }
      }
      return next;
    });
    // Only react to route changes for auto-expand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
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
        {visibleEntries.map((entry) => {
          if (entry.kind === "link") {
            return (
              <NavLinkRow
                key={entry.href}
                item={entry}
                pathname={pathname}
                collapsed={collapsed}
              />
            );
          }
          return (
            <NavGroupBlock
              key={entry.id}
              group={entry}
              pathname={pathname}
              collapsed={collapsed}
              open={Boolean(openGroups[entry.id])}
              onToggle={() => toggleGroup(entry.id)}
            />
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
