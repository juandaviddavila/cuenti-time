"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, FileText, Edit, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { IncidentType } from "@/types/incident-type";
import type { UserRole } from "@/types/user";

interface IncidentTypesClientProps {
  userRole: UserRole;
  companyId: string;
  initialIncidentTypes: IncidentType[];
}

const incidentTypeSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "Máximo 100 caracteres"),
  active: z.boolean(),
  countsAsAbsence: z.boolean(),
  excusesLate: z.boolean(),
  excusesEarlyLeave: z.boolean(),
});

type IncidentTypeFormValues = z.infer<typeof incidentTypeSchema>;

const DEFAULT_FORM: IncidentTypeFormValues = {
  name: "",
  active: true,
  countsAsAbsence: false,
  excusesLate: false,
  excusesEarlyLeave: false,
};

export function IncidentTypesClient({
  userRole,
  companyId,
  initialIncidentTypes,
}: IncidentTypesClientProps) {
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>(initialIncidentTypes);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IncidentType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit =
    userRole === "SAAS_SUPER_ADMIN" || userRole === "COMPANY_ADMIN";

  const form = useForm<IncidentTypeFormValues>({
    resolver: zodResolver(incidentTypeSchema),
    defaultValues: DEFAULT_FORM,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidentTypes.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [incidentTypes, search]);

  function openCreate() {
    setEditing(null);
    form.reset(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(incidentType: IncidentType) {
    setEditing(incidentType);
    form.reset({
      name: incidentType.name,
      active: incidentType.active,
      countsAsAbsence: incidentType.countsAsAbsence ?? false,
      excusesLate: incidentType.excusesLate ?? false,
      excusesEarlyLeave: incidentType.excusesEarlyLeave ?? false,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: IncidentTypeFormValues) {
    setIsSubmitting(true);
    try {
      const url = editing ? `/api/incident-types/${editing.id}` : "/api/incident-types";
      const method = editing ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        name: values.name,
        active: values.active,
        countsAsAbsence: values.countsAsAbsence,
        excusesLate: values.excusesLate,
        excusesEarlyLeave: values.excusesEarlyLeave,
      };
      if (!editing && companyId) {
        body.companyId = companyId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "Error al guardar el tipo de novedad");
      }

      const saved = (await res.json()) as IncidentType;

      if (editing) {
        setIncidentTypes((prev) =>
          prev.map((t) =>
            t.id === editing.id
              ? {
                  ...saved,
                  companyId: saved.companyId || t.companyId,
                }
              : t
          )
        );
        toast.success("Tipo de novedad actualizado");
      } else {
        setIncidentTypes((prev) =>
          [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
        );
        toast.success("Tipo de novedad creado");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(incidentType: IncidentType) {
    if (!confirm(`¿Deseas eliminar el tipo de novedad "${incidentType.name}"?`)) return;

    try {
      const res = await fetch(`/api/incident-types/${incidentType.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "Error al eliminar el tipo de novedad");
      }
      setIncidentTypes((prev) =>
        prev.map((t) => (t.id === incidentType.id ? { ...t, active: false } : t))
      );
      toast.success("Tipo de novedad eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tipos de Novedad"
        description={`${incidentTypes.length} tipo${
          incidentTypes.length !== 1 ? "s" : ""
        } de novedad registrado${incidentTypes.length !== 1 ? "s" : ""}`}
        action={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo tipo
            </Button>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tipo de novedad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin tipos de novedad"
          description="No se encontraron tipos de novedad con los filtros actuales."
          action={
            canEdit ? (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo tipo
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Semántica RR.HH.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((incidentType) => (
                  <TableRow key={incidentType.id}>
                    <TableCell className="font-medium text-sm">
                      {incidentType.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {incidentType.countsAsAbsence && (
                          <span className="rounded bg-muted px-1.5 py-0.5">Ausencia</span>
                        )}
                        {incidentType.excusesLate && (
                          <span className="rounded bg-muted px-1.5 py-0.5">Excusa tarde</span>
                        )}
                        {incidentType.excusesEarlyLeave && (
                          <span className="rounded bg-muted px-1.5 py-0.5">Excusa salida</span>
                        )}
                        {!incidentType.countsAsAbsence &&
                          !incidentType.excusesLate &&
                          !incidentType.excusesEarlyLeave && (
                            <span>—</span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={incidentType.active ? "ACTIVE" : "INACTIVE"}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(incidentType)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(incidentType)}
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((incidentType) => (
              <Card key={incidentType.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{incidentType.name}</p>
                      <div className="mt-2">
                        <StatusBadge
                          status={incidentType.active ? "ACTIVE" : "INACTIVE"}
                        />
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(incidentType)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(incidentType)}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar tipo de novedad" : "Nuevo tipo de novedad"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del tipo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. Incapacidad, Vacaciones"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Activo</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {field.value
                          ? "El tipo está disponible para registro"
                          : "El tipo está inactivo"}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="countsAsAbsence"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Cuenta como ausencia justificada</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Justifica no marcar (vacaciones, incapacidad, permiso…)
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="excusesLate"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Excusa tardanza</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        No cuenta minutos de llegada tarde
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="excusesEarlyLeave"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Excusa salida anticipada</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        No cuenta minutos de salida anticipada
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
                  {isSubmitting
                    ? "Guardando..."
                    : editing
                      ? "Actualizar"
                      : "Crear tipo"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
