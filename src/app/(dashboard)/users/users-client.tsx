"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Shield, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { getInitials, formatDateTime } from "@/lib/utils";
import type { UserRole, Status } from "@/types/user";

interface UserRow {
  id: string;
  companyId?: string;
  name: string;
  email: string;
  role: UserRole;
  status: Status;
  avatar?: string;
  branchId?: string;
  bypassGeofence?: boolean;
  canManageIntegrations?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Props {
  users: UserRow[];
  branches: Branch[];
  currentUserRole: UserRole;
  currentCompanyId: string;
}

const ROLE_STYLES: Record<UserRole, { label: string; classes: string }> = {
  SAAS_SUPER_ADMIN: {
    label: "Super Admin",
    classes:
      "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800",
  },
  COMPANY_ADMIN: {
    label: "Admin Empresa",
    classes: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
  },
  BRANCH_SUPERVISOR: {
    label: "Supervisor",
    classes:
      "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
  },
  FACE_REGISTRAR: {
    label: "Registrador",
    classes:
      "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800",
  },
  REPORT_VIEWER: {
    label: "Visualizador",
    classes:
      "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800",
  },
  DEVELOPER: {
    label: "Desarrollador",
    classes:
      "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800",
  },
};

const AVAILABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "COMPANY_ADMIN", label: "Admin Empresa" },
  { value: "BRANCH_SUPERVISOR", label: "Supervisor de Sucursal" },
  { value: "FACE_REGISTRAR", label: "Registrador Facial" },
  { value: "REPORT_VIEWER", label: "Visualizador de Reportes" },
  { value: "DEVELOPER", label: "Desarrollador" },
];

const createUserSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum([
    "COMPANY_ADMIN",
    "BRANCH_SUPERVISOR",
    "FACE_REGISTRAR",
    "REPORT_VIEWER",
    "DEVELOPER",
  ] as const),
  branchId: z.string().cuid().optional(),
  bypassGeofence: z.boolean().default(false),
  canManageIntegrations: z.boolean().default(false),
});

const editUserSchema = z.object({
  bypassGeofence: z.boolean(),
  canManageIntegrations: z.boolean(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type EditUserFormValues = z.infer<typeof editUserSchema>;

export function UsersClient({
  users: initialUsers,
  branches,
  currentUserRole,
  currentCompanyId,
}: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreate =
    currentUserRole === "SAAS_SUPER_ADMIN" ||
    currentUserRole === "COMPANY_ADMIN";

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "REPORT_VIEWER",
      branchId: "",
      bypassGeofence: false,
      canManageIntegrations: false,
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      bypassGeofence: false,
      canManageIntegrations: false,
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        !search ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  function openCreate() {
    form.reset({
      name: "",
      email: "",
      password: "",
      role: "REPORT_VIEWER",
      branchId: "",
      bypassGeofence: false,
      canManageIntegrations: false,
    });
    setDialogOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    editForm.reset({
      bypassGeofence: user.bypassGeofence ?? false,
      canManageIntegrations: user.canManageIntegrations ?? false,
    });
    setEditDialogOpen(true);
  }

  async function onSubmit(values: CreateUserFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          companyId: currentCompanyId || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Error al crear usuario");
      }
      const created = (await res.json()) as UserRow & {
        createdAt: string;
        updatedAt: string;
      };
      setUsers((prev) => [
        {
          ...created,
          createdAt: created.createdAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success("Usuario creado exitosamente");
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onEditPermissions(values: EditUserFormValues) {
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Error al actualizar permisos");
      }
      const updated = (await res.json()) as UserRow;
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
      );
      toast.success("Permisos actualizados");
      setEditDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleUserStatus(user: UserRow) {
    const newStatus: Status = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
      );
      toast.success(
        `Usuario ${newStatus === "ACTIVE" ? "activado" : "desactivado"}`
      );
    } catch {
      toast.error("Error al cambiar estado del usuario");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios del Sistema"
        description={`${users.length} usuario${users.length !== 1 ? "s" : ""} registrado${users.length !== 1 ? "s" : ""}`}
        action={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo usuario
            </Button>
          ) : undefined
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Sin usuarios"
          description="No se encontraron usuarios con los filtros actuales."
          action={
            canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo usuario
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                {canCreate && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const roleStyle = ROLE_STYLES[u.role];
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${roleStyle.classes} text-xs`}
                      >
                        {roleStyle.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.bypassGeofence && (
                          <Badge variant="outline" className="text-[10px]">
                            Sin geofence
                          </Badge>
                        )}
                        {u.canManageIntegrations && (
                          <Badge variant="outline" className="text-[10px]">
                            API/Webhooks
                          </Badge>
                        )}
                        {!u.bypassGeofence && !u.canManageIntegrations && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}
                    </TableCell>
                    {canCreate && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u)}
                            className="text-xs"
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Permisos
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserStatus(u)}
                            className="text-xs"
                          >
                            {u.status === "ACTIVE" ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create user dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="María García" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="maria@empresa.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AVAILABLE_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {branches.length > 0 && (
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Sucursal{" "}
                        <span className="text-muted-foreground font-normal">
                          (opcional)
                        </span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin sucursal asignada" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin sucursal</SelectItem>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="bypassGeofence"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-lg border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel>Exento de geolocalización</FormLabel>
                      <FormDescription>
                        Puede marcar asistencia sin validar el radio GPS de la sucursal.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="canManageIntegrations"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-lg border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel>Gestionar API y webhooks</FormLabel>
                      <FormDescription>
                        Acceso a tokens de API, webhooks y documentación técnica.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creando..." : "Crear usuario"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Permisos de {editingUser?.name}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditPermissions)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="bypassGeofence"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-lg border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel>Exento de geolocalización</FormLabel>
                      <FormDescription>
                        No valida distancia GPS al registrar asistencia.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="canManageIntegrations"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-lg border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel>Gestionar API y webhooks</FormLabel>
                      <FormDescription>
                        Acceso a integraciones aunque no tenga rol Desarrollador.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : "Guardar permisos"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
