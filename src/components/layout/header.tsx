"use client";

import { useState } from "react";
import { Bell, Search, Moon, Sun, Monitor, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";

interface HeaderProps {
  title?: string;
  alertCount?: number;
}

export function Header({ title, alertCount = 0 }: HeaderProps) {
  const { user } = useAuthStore();
  const { setTheme, theme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 h-14 md:h-16 bg-background/90 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 md:px-6">
        <div className="flex items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menú"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          {title && (
            <h1 className="text-base font-semibold text-foreground hidden md:block">
              {title}
            </h1>
          )}
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-auto">
          <label className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar..."
              className="w-full h-9 rounded-lg border border-border bg-muted/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/40 transition-shadow"
              aria-label="Buscar"
            />
          </label>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-muted-foreground hover:text-foreground"
            aria-label="Buscar"
          >
            <Search className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label={`Notificaciones${alertCount > 0 ? ` (${alertCount})` : ""}`}
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 w-4 h-4 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0">
                {alertCount > 9 ? "9+" : alertCount}
              </Badge>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Cambiar tema"
              >
                {theme === "dark" ? (
                  <Moon className="w-4 h-4" />
                ) : theme === "light" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="w-4 h-4 mr-2" /> Claro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="w-4 h-4 mr-2" /> Oscuro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="w-4 h-4 mr-2" /> Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 rounded-full pl-1.5 pr-2"
                aria-label="Menú de usuario"
              >
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="bg-foreground text-background text-[11px] font-medium">
                    {user ? getInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:block text-sm font-medium max-w-[120px] truncate">
                  {user?.name?.split(" ")[0] ?? "Usuario"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-3 py-2 border-b border-border space-y-0.5">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-foreground/80 truncate pt-1">
                  {user?.companyName
                    ? user.companyName
                    : user?.role === "SAAS_SUPER_ADMIN"
                      ? "Plataforma (sin empresa)"
                      : "Sin empresa asignada"}
                </p>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/profile">Mi perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Configuración</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </>
  );
}
