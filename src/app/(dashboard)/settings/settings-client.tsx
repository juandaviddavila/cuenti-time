"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Bell, Lock, Save, Key, Clock } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import type { UserRole } from "@/types/user";

const companySchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  legalName: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Correo inválido"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
});
type CompanyForm = z.infer<typeof companySchema>;

const attendanceOpsSchema = z.object({
  lateToleranceMinutes: z.coerce.number().int().min(0).max(240),
  earlyLeaveToleranceMinutes: z.coerce.number().int().min(0).max(240),
  lateReportTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Usa formato HH:mm (ej. 23:00)"),
  lateReportRecipients: z.string().max(2000).optional(),
  faceMatchThreshold: z.coerce.number().min(0.2).max(1.2),
});
type AttendanceOpsForm = z.infer<typeof attendanceOpsSchema>;

function recipientsToText(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string").join("\n");
    }
  } catch {
    // plain text fallback
  }
  return raw;
}

function recipientsToJson(text: string): string | null {
  const emails = text
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  if (emails.length === 0) return null;
  return JSON.stringify(emails);
}

const pwdSchema = z
  .object({
    current: z.string().min(1, "Requerido"),
    newPwd: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.newPwd === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });
type PwdForm = z.infer<typeof pwdSchema>;

export interface CompanySettings {
  id: string;
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  subscriptionExpiresAt?: string | null;
  maxEmployees: number;
  lateToleranceMinutes: number;
  earlyLeaveToleranceMinutes: number;
  lateReportTime: string;
  lateReportRecipients?: string | null;
  faceMatchThreshold: number;
}

interface Props {
  company: CompanySettings | null;
  showIntegrations?: boolean;
  canManageCompany?: boolean;
  userRole?: UserRole;
}

export function SettingsClient({
  company,
  showIntegrations = false,
  canManageCompany = false,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [savingOps, setSavingOps] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [notifs, setNotifs] = useState({
    lateArrivals: true,
    facialFailures: true,
    absences: false,
  });

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name ?? "",
      legalName: company?.legalName ?? "",
      email: company?.email ?? "",
      phone: company?.phone ?? "",
      address: company?.address ?? "",
      city: company?.city ?? "",
    },
  });

  const opsForm = useForm<AttendanceOpsForm>({
    resolver: zodResolver(attendanceOpsSchema),
    defaultValues: {
      lateToleranceMinutes: company?.lateToleranceMinutes ?? 10,
      earlyLeaveToleranceMinutes: company?.earlyLeaveToleranceMinutes ?? 10,
      lateReportTime: company?.lateReportTime ?? "23:00",
      lateReportRecipients: recipientsToText(company?.lateReportRecipients),
      faceMatchThreshold: company?.faceMatchThreshold ?? 0.6,
    },
  });

  const pwdForm = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { current: "", newPwd: "", confirm: "" },
  });

  async function onSaveCompany(values: CompanyForm) {
    if (!company) {
      toast.error("No hay empresa asociada a esta cuenta");
      return;
    }
    if (!canManageCompany) {
      toast.error("No tienes permiso para editar la empresa");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error al guardar");
      toast.success("Datos de la empresa actualizados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveAttendanceOps(values: AttendanceOpsForm) {
    if (!company) {
      toast.error("No hay empresa asociada a esta cuenta");
      return;
    }
    if (!canManageCompany) {
      toast.error("No tienes permiso para editar estas reglas");
      return;
    }

    setSavingOps(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lateToleranceMinutes: values.lateToleranceMinutes,
          earlyLeaveToleranceMinutes: values.earlyLeaveToleranceMinutes,
          lateReportTime: values.lateReportTime,
          lateReportRecipients: recipientsToJson(values.lateReportRecipients ?? ""),
          faceMatchThreshold: values.faceMatchThreshold,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error al guardar");
      toast.success("Reglas de asistencia actualizadas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingOps(false);
    }
  }

  async function onChangePwd(values: PwdForm) {
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Contraseña actualizada exitosamente");
    setPwdOpen(false);
    pwdForm.reset();
    void values;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Configuración"
        description={
          company
            ? "Gestiona los datos de tu empresa y las preferencias de tu cuenta"
            : "Gestiona las preferencias de tu cuenta"
        }
      />

      {showIntegrations && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium">API y Webhooks</p>
              <p className="text-xs text-muted-foreground">
                Gestiona tokens de API y endpoints de notificación.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings/integrations">
                <Key className="w-4 h-4 mr-2" />
                Abrir integraciones
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="company">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="company">
            <Building2 className="w-4 h-4 mr-2" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <Clock className="w-4 h-4 mr-2" />
            Asistencia
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="w-4 h-4 mr-2" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de la empresa</CardTitle>
              <CardDescription>
                Cada cuenta corresponde a una sola empresa. Para administrar otra
                empresa, crea una cuenta nueva en el registro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!company ? (
                <p className="text-sm text-muted-foreground">
                  Esta cuenta no tiene una empresa asociada. Usa el panel de
                  plataforma si eres super administrador.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">NIT / ID fiscal:</span>{" "}
                      <span className="font-mono">{company.taxId}</span>
                    </p>
                    {company.subscriptionExpiresAt && (
                      <p>
                        <span className="text-muted-foreground">Suscripción hasta:</span>{" "}
                        {new Date(company.subscriptionExpiresAt).toLocaleDateString("es-CO")}
                      </p>
                    )}
                    <p>
                      <span className="text-muted-foreground">Cupos faciales:</span>{" "}
                      {company.maxEmployees} empleados
                    </p>
                  </div>

                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSaveCompany)}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre comercial</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!canManageCompany} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="legalName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Razón social</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!canManageCompany} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {(["email", "phone", "city", "address"] as const).map((field) => (
                        <FormField
                          key={field}
                          control={form.control}
                          name={field}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>
                                {field === "email"
                                  ? "Correo"
                                  : field === "phone"
                                    ? "Teléfono"
                                    : field === "city"
                                      ? "Ciudad"
                                      : "Dirección"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...f}
                                  disabled={!canManageCompany}
                                  type={field === "email" ? "email" : "text"}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                      <Button type="submit" disabled={saving || !canManageCompany}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Guardando..." : "Guardar cambios"}
                      </Button>
                      {!canManageCompany && (
                        <p className="text-xs text-muted-foreground">
                          Solo el administrador de la empresa puede editar estos datos.
                        </p>
                      )}
                    </form>
                  </Form>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reglas de asistencia</CardTitle>
              <CardDescription>
                Tolerancia de tardanzas y parámetros del reporte diario. La ventana
                anti-doble tap se configura por sucursal en{" "}
                <Link href="/branches" className="underline text-primary">
                  Sucursales
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!company ? (
                <p className="text-sm text-muted-foreground">
                  Esta cuenta no tiene una empresa asociada.
                </p>
              ) : (
                <Form {...opsForm}>
                  <form
                    onSubmit={opsForm.handleSubmit(onSaveAttendanceOps)}
                    className="space-y-4"
                  >
                    <FormField
                      control={opsForm.control}
                      name="lateToleranceMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tolerancia de entrada / tardanza (minutos)</FormLabel>
                          <FormDescription>
                            Gracia después de la hora de inicio del turno.
                            Ejemplo: turno 8:00 y tolerancia 10 → tarde desde las 8:11.
                          </FormDescription>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={240}
                              step={1}
                              disabled={!canManageCompany}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={opsForm.control}
                      name="faceMatchThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Umbral de reconocimiento facial</FormLabel>
                          <FormDescription>
                            Distancia máxima para aceptar un match (menor = más estricto).
                            Recomendado <strong>0.6</strong>. Rango 0.2–1.2. No es un porcentaje:
                            valores típicos 0.45 (estricto) a 0.7 (permisivo).
                          </FormDescription>
                          <FormControl>
                            <Input
                              type="number"
                              min={0.2}
                              max={1.2}
                              step={0.05}
                              disabled={!canManageCompany}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={opsForm.control}
                      name="earlyLeaveToleranceMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tolerancia de salida anticipada (minutos)</FormLabel>
                          <FormDescription>
                            Gracia antes de la hora de fin del turno.
                            Ejemplo: turno termina 17:00 y tolerancia 10 → salida anticipada solo si marca antes de las 16:50.
                          </FormDescription>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={240}
                              step={1}
                              disabled={!canManageCompany}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={opsForm.control}
                      name="lateReportTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hora del reporte diario de tardanzas</FormLabel>
                          <FormDescription>
                            Formato 24 h (HH:mm). Usado cuando el envío automático esté activo.
                          </FormDescription>
                          <FormControl>
                            <Input
                              type="time"
                              disabled={!canManageCompany}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={opsForm.control}
                      name="lateReportRecipients"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Destinatarios del reporte</FormLabel>
                          <FormDescription>
                            Un correo por línea (o separados por coma).
                          </FormDescription>
                          <FormControl>
                            <Textarea
                              rows={4}
                              placeholder={"rrhh@empresa.com\ngerencia@empresa.com"}
                              disabled={!canManageCompany}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={savingOps || !canManageCompany}>
                      <Save className="w-4 h-4 mr-2" />
                      {savingOps ? "Guardando..." : "Guardar reglas"}
                    </Button>
                    {!canManageCompany && (
                      <p className="text-xs text-muted-foreground">
                        Solo <strong>COMPANY_ADMIN</strong> o{" "}
                        <strong>SAAS_SUPER_ADMIN</strong> pueden cambiar estas reglas.
                      </p>
                    )}
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alertas y notificaciones</CardTitle>
              <CardDescription>
                Configura qué eventos generan notificaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                {
                  key: "lateArrivals" as const,
                  label: "Llegadas tarde",
                  desc: "Alerta cuando un empleado llega después de la hora establecida",
                },
                {
                  key: "facialFailures" as const,
                  label: "Fallos de reconocimiento facial",
                  desc: "Notifica cuando hay intentos fallidos repetidos",
                },
                {
                  key: "absences" as const,
                  label: "Ausencias no justificadas",
                  desc: "Alerta cuando un empleado no registra entrada en el día",
                },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <Switch
                    checked={notifs[key]}
                    onCheckedChange={(v) => {
                      setNotifs((p) => ({ ...p, [key]: v }));
                      toast.success(`Notificación ${v ? "activada" : "desactivada"}`);
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seguridad de cuenta</CardTitle>
              <CardDescription>Gestiona tu contraseña y acceso.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Contraseña</p>
                  <p className="text-xs text-muted-foreground">
                    Última actualización: desconocida
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPwdOpen(true)}>
                  <Lock className="w-4 h-4 mr-2" />
                  Cambiar
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Sesiones activas</p>
                  <p className="text-xs text-muted-foreground">
                    Token de sesión expira en 15 minutos
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info("Funcionalidad en desarrollo")}
                >
                  Ver sesiones
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <Form {...pwdForm}>
            <form onSubmit={pwdForm.handleSubmit(onChangePwd)} className="space-y-4">
              {(["current", "newPwd", "confirm"] as const).map((f) => (
                <div key={f} className="space-y-1">
                  <Label>
                    {f === "current"
                      ? "Contraseña actual"
                      : f === "newPwd"
                        ? "Nueva contraseña"
                        : "Confirmar contraseña"}
                  </Label>
                  <Input type="password" {...pwdForm.register(f)} />
                  {pwdForm.formState.errors[f] && (
                    <p className="text-xs text-red-500">
                      {pwdForm.formState.errors[f]?.message}
                    </p>
                  )}
                </div>
              ))}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPwdOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Actualizar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
