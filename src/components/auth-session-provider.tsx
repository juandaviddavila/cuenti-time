"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { User } from "@/types/user";

/**
 * Rehidrata el store desde las cookies httpOnly (access/refresh).
 * Así la sesión sobrevive reinicios del servidor y recargas del navegador.
 */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      try {
        let res = await fetch("/api/auth/me", { credentials: "same-origin" });

        if (res.status === 401) {
          const refresh = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "same-origin",
          });
          if (refresh.ok) {
            res = await fetch("/api/auth/me", { credentials: "same-origin" });
          }
        }

        if (cancelled) return;

        if (!res.ok) {
          logout();
          return;
        }

        const json = (await res.json()) as { user?: User };
        if (!json.user) {
          logout();
          return;
        }

        // El access token real vive en cookie httpOnly; el store solo guarda perfil.
        setUser(json.user, "cookie");
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const finishHydration = useAuthStore.persist.onFinishHydration(() => {
      void bootstrap();
    });

    if (useAuthStore.persist.hasHydrated()) {
      void bootstrap();
    }

    return () => {
      cancelled = true;
      finishHydration();
    };
  }, [logout, setLoading, setUser]);

  return <>{children}</>;
}
