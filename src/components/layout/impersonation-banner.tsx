"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ImpersonationInfo {
  companyName: string;
}

export function ImpersonationBanner() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [info, setInfo] = useState<ImpersonationInfo | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isImpersonating && data?.impersonation) {
          setInfo({ companyName: data.impersonation.companyName });
        }
      })
      .catch(() => {});
  }, []);

  if (!info) return null;

  async function stopImpersonation() {
    setStopping(true);
    try {
      const res = await fetch("/api/super-admin/impersonate/stop", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo salir de la cuenta");

      setUser(data.user, data.accessToken);
      toast.success("Volviste a la consola de super admin");
      router.push("/super-admin");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al salir");
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Estás viendo la cuenta de <strong>{info.companyName}</strong> como super administrador.
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="bg-amber-950 text-amber-50 hover:bg-amber-900 shrink-0"
        onClick={stopImpersonation}
        disabled={stopping}
      >
        <LogOut className="h-4 w-4 mr-1" />
        {stopping ? "Saliendo..." : "Salir de esta cuenta"}
      </Button>
    </div>
  );
}
