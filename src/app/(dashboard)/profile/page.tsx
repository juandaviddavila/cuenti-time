"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/auth-store";
import { LogOut, User, Mail, Shield, Building2, Calendar, Lock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const pwdSchema = z
  .object({
    currentPassword: z.string().min(1, "Requerido"),
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Requerido"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "La nueva contraseña debe ser distinta a la actual",
    path: ["newPassword"],
  });

type PwdForm = z.infer<typeof pwdSchema>;

export default function ProfilePage() {
  const router  = useRouter();
  const { user, logout } = useAuthStore();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const pwdForm = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* continue */ }
    logout();
    toast.success("Sesión cerrada");
    router.push("/login");
  };

  const onChangePassword = async (values: PwdForm) => {
    setSavingPwd(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.error ?? "No se pudo cambiar la contraseña");
      toast.success(json.message ?? "Contraseña actualizada");
      setPwdOpen(false);
      pwdForm.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSavingPwd(false);
    }
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

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                pwdForm.reset();
                setPwdOpen(true);
              }}
            >
              <Lock className="w-4 h-4 mr-2" />
              Cambiar contraseña
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <form onSubmit={pwdForm.handleSubmit(onChangePassword)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                {...pwdForm.register("currentPassword")}
              />
              {pwdForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">
                  {pwdForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                {...pwdForm.register("newPassword")}
              />
              {pwdForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {pwdForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...pwdForm.register("confirmPassword")}
              />
              {pwdForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {pwdForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwdOpen(false)}
                disabled={savingPwd}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingPwd}>
                {savingPwd ? "Guardando..." : "Actualizar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
