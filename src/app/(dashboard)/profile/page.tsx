"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { LogOut, User, Mail, Shield, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { getInitials, formatDateTime } from "@/lib/utils";
import type { UserRole } from "@/types/user";

const ROLE_LABELS: Record<UserRole, string> = {
  SAAS_SUPER_ADMIN:  "Super Administrador",
  COMPANY_ADMIN:     "Administrador de Empresa",
  BRANCH_SUPERVISOR: "Supervisor de Sucursal",
  FACE_REGISTRAR:    "Registrador Facial",
  REPORT_VIEWER:     "Visualizador de Reportes",
  DEVELOPER:         "Desarrollador",
};

const ROLE_STYLES: Record<UserRole, string> = {
  SAAS_SUPER_ADMIN:  "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800",
  COMPANY_ADMIN:     "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
  BRANCH_SUPERVISOR: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
  FACE_REGISTRAR:    "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800",
  REPORT_VIEWER:     "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800",
  DEVELOPER:         "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800",
};

export default function ProfilePage() {
  const router  = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* continue */ }
    logout();
    toast.success("Sesión cerrada");
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Mi Perfil" description="Información de tu cuenta en cuenti time" />

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <Avatar className="w-20 h-20 shrink-0">
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{user.email}</p>
              <Badge variant="outline" className={`mt-2 text-xs ${ROLE_STYLES[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </div>

          <Separator className="my-5" />

          <div className="space-y-3">
            {[
              { icon: User,      label: "Nombre completo",  value: user.name },
              { icon: Mail,      label: "Correo electrónico", value: user.email },
              { icon: Shield,    label: "Rol",              value: ROLE_LABELS[user.role] },
              { icon: Building2, label: "ID de empresa",    value: user.companyId ?? "Plataforma global" },
              { icon: Calendar,  label: "Cuenta creada",    value: formatDateTime(user.createdAt) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-5" />

          <Button variant="destructive" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
