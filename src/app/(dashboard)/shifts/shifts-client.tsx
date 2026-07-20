"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Clock,
  Edit,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { UserRole } from "@/types/user";

export interface Shift {
  id: string;
  companyId: string;
  name: string;
  mondayStart?: string | null;
  mondayEnd?: string | null;
  tuesdayStart?: string | null;
  tuesdayEnd?: string | null;
  wednesdayStart?: string | null;
  wednesdayEnd?: string | null;
  thursdayStart?: string | null;
  thursdayEnd?: string | null;
  fridayStart?: string | null;
  fridayEnd?: string | null;
  saturdayStart?: string | null;
  saturdayEnd?: string | null;
  sundayStart?: string | null;
  sundayEnd?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

interface Props {
  companyId: string;
  userRole: UserRole;
  shifts: Shift[];
}

const DAYS: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const DAY_SHORT_LABELS: Record<DayKey, string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mié",
  thursday: "Jue",
  friday: "Vie",
  saturday: "Sáb",
  sunday: "Dom",
};

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeValueSchema = z.union([
  z.string().regex(timePattern, "Formato inválido (HH:MM)"),
  z.literal(""),
]);

const shiftFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "El nombre es obligatorio")
      .max(100, "Máximo 100 caracteres"),
    mondayStart: timeValueSchema,
    mondayEnd: timeValueSchema,
    tuesdayStart: timeValueSchema,
    tuesdayEnd: timeValueSchema,
    wednesdayStart: timeValueSchema,
    wednesdayEnd: timeValueSchema,
    thursdayStart: timeValueSchema,
    thursdayEnd: timeValueSchema,
    fridayStart: timeValueSchema,
    fridayEnd: timeValueSchema,
    saturdayStart: timeValueSchema,
    saturdayEnd: timeValueSchema,
    sundayStart: timeValueSchema,
    sundayEnd: timeValueSchema,
  })
  .superRefine((data, ctx) => {
    DAYS.forEach((day) => {
      const startKey = `${day}Start` as keyof ShiftFormValues;
      const endKey = `${day}End` as keyof ShiftFormValues;
      const start = data[startKey];
      const end = data[endKey];
      if (start && end && start >= end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La hora de inicio debe ser menor que la de fin",
          path: [endKey],
        });
      }
    });
  });

type ShiftFormValues = z.infer<typeof shiftFormSchema>;

function emptyFormValues(): ShiftFormValues {
  return {
    name: "",
    mondayStart: "",
    mondayEnd: "",
    tuesdayStart: "",
    tuesdayEnd: "",
    wednesdayStart: "",
    wednesdayEnd: "",
    thursdayStart: "",
    thursdayEnd: "",
    fridayStart: "",
    fridayEnd: "",
    saturdayStart: "",
    saturdayEnd: "",
    sundayStart: "",
    sundayEnd: "",
  };
}

function shiftToFormValues(shift: Shift): ShiftFormValues {
  return {
    name: shift.name,
    mondayStart: shift.mondayStart ?? "",
    mondayEnd: shift.mondayEnd ?? "",
    tuesdayStart: shift.tuesdayStart ?? "",
    tuesdayEnd: shift.tuesdayEnd ?? "",
    wednesdayStart: shift.wednesdayStart ?? "",
    wednesdayEnd: shift.wednesdayEnd ?? "",
    thursdayStart: shift.thursdayStart ?? "",
    thursdayEnd: shift.thursdayEnd ?? "",
    fridayStart: shift.fridayStart ?? "",
    fridayEnd: shift.fridayEnd ?? "",
    saturdayStart: shift.saturdayStart ?? "",
    saturdayEnd: shift.saturdayEnd ?? "",
    sundayStart: shift.sundayStart ?? "",
    sundayEnd: shift.sundayEnd ?? "",
  };
}

function serializeTimeValue(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function formValuesToPayload(
  values: ShiftFormValues
): Omit<Shift, "id" | "companyId" | "active" | "createdAt" | "updatedAt"> {
  return {
    name: values.name,
    mondayStart: serializeTimeValue(values.mondayStart),
    mondayEnd: serializeTimeValue(values.mondayEnd),
    tuesdayStart: serializeTimeValue(values.tuesdayStart),
    tuesdayEnd: serializeTimeValue(values.tuesdayEnd),
    wednesdayStart: serializeTimeValue(values.wednesdayStart),
    wednesdayEnd: serializeTimeValue(values.wednesdayEnd),
    thursdayStart: serializeTimeValue(values.thursdayStart),
    thursdayEnd: serializeTimeValue(values.thursdayEnd),
    fridayStart: serializeTimeValue(values.fridayStart),
    fridayEnd: serializeTimeValue(values.fridayEnd),
    saturdayStart: serializeTimeValue(values.saturdayStart),
    saturdayEnd: serializeTimeValue(values.saturdayEnd),
    sundayStart: serializeTimeValue(values.sundayStart),
    sundayEnd: serializeTimeValue(values.sundayEnd),
  };
}

function getHoursSummary(shift: Shift): string {
  const parts = DAYS.map((day) => {
    const start = shift[`${day}Start` as keyof Shift] as
      | string
      | null
      | undefined;
    const end = shift[`${day}End` as keyof Shift] as string | null | undefined;
    if (!start && !end) return null;
    return `${DAY_SHORT_LABELS[day]} ${start ?? "--:--"}-${end ?? "--:--"}`;
  }).filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(", ") : "Sin horario definido";
}

function getActiveDaysCount(shift: Shift): number {
  return DAYS.filter((day) => {
    const start = shift[`${day}Start` as keyof Shift] as
      | string
      | null
      | undefined;
    const end = shift[`${day}End` as keyof Shift] as string | null | undefined;
    return Boolean(start && end);
  }).length;
}

export function ShiftsClient({
  companyId,
  userRole,
  shifts: initialShifts,
}: Props) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit =
    userRole === "SAAS_SUPER_ADMIN" || userRole === "COMPANY_ADMIN";

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: emptyFormValues(),
  });

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return shifts.filter((shift) => {
      const matchesSearch = !query || shift.name.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && shift.active) ||
        (statusFilter === "inactive" && !shift.active);
      return matchesSearch && matchesStatus;
    });
  }, [shifts, search, statusFilter]);

  function openCreate() {
    setEditingShift(null);
    form.reset(emptyFormValues());
    setDialogOpen(true);
  }

  function openEdit(shift: Shift) {
    setEditingShift(shift);
    form.reset(shiftToFormValues(shift));
    setDialogOpen(true);
  }

  async function onSubmit(values: ShiftFormValues) {
    setIsSubmitting(true);
    try {
      const payload = formValuesToPayload(values);

      if (editingShift) {
        const res = await fetch(`/api/shifts/${editingShift.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errorBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errorBody.error ?? "Error al actualizar el turno");
        }
        const updated = (await res.json()) as Shift;
        setShifts((prev) =>
          prev.map((s) =>
            s.id === editingShift.id
              ? { ...updated, createdAt: s.createdAt }
              : s
          )
        );
        toast.success("Turno actualizado");
      } else {
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, companyId }),
        });
        if (!res.ok) {
          const errorBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errorBody.error ?? "Error al crear el turno");
        }
        const created = (await res.json()) as Shift;
        setShifts((prev) => [created, ...prev]);
        toast.success("Turno creado exitosamente");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(shift: Shift) {
    if (!confirm(`¿Deseas desactivar el turno "${shift.name}"?`)) return;

    const res = await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" });
    if (res.ok) {
      setShifts((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, active: false } : s))
      );
      toast.success("Turno desactivado");
    } else {
      toast.error("Error al desactivar el turno");
    }
  }

  async function handleToggleActive(shift: Shift) {
    const newActive = !shift.active;
    const res = await fetch(`/api/shifts/${shift.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: newActive }),
    });
    if (res.ok) {
      setShifts((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, active: newActive } : s))
      );
      toast.success(`Turno ${newActive ? "activado" : "desactivado"}`);
    } else {
      toast.error("Error al cambiar el estado del turno");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Turnos"
        description={`${shifts.length} turno${
          shifts.length !== 1 ? "s" : ""
        } registrado${shifts.length !== 1 ? "s" : ""}`}
        action={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo turno
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar turno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            className="flex-1 sm:flex-none"
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === "active" ? "default" : "outline"}
            onClick={() => setStatusFilter("active")}
            className="flex-1 sm:flex-none"
          >
            Activos
          </Button>
          <Button
            variant={statusFilter === "inactive" ? "default" : "outline"}
            onClick={() => setStatusFilter("inactive")}
            className="flex-1 sm:flex-none"
          >
            Inactivos
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No hay turnos"
          description="No se encontraron turnos con los filtros actuales."
          action={
            canEdit ? (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo turno
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Horario semanal</TableHead>
                  <TableHead>Días configurados</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{shift.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {getHoursSummary(shift)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getActiveDaysCount(shift)} / {DAYS.length}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={shift.active ? "ACTIVE" : "INACTIVE"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(shift)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(shift)}
                              title={shift.active ? "Desactivar" : "Activar"}
                            >
                              {shift.active ? (
                                <ToggleRight className="w-4 h-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(shift)}
                              title="Desactivar"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((shift) => (
              <Card key={shift.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{shift.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getHoursSummary(shift)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getActiveDaysCount(shift)} de {DAYS.length} días
                        configurados
                      </p>
                      <div className="mt-2">
                        <StatusBadge
                          status={shift.active ? "ACTIVE" : "INACTIVE"}
                        />
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(shift)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(shift)}
                        >
                          {shift.active ? (
                            <ToggleRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(shift)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingShift ? "Editar turno" : "Nuevo turno"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del turno</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Turno diurno" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <p className="text-sm font-medium">Horario por día</p>
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start"
                  >
                    <div className="flex items-center h-10">
                      <span className="text-sm text-muted-foreground font-medium">
                        {DAY_LABELS[day]}
                      </span>
                    </div>
                    <FormField
                      control={form.control}
                      name={`${day}Start` as keyof ShiftFormValues}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">
                            Hora inicio {DAY_LABELS[day]}
                          </FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`${day}End` as keyof ShiftFormValues}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">
                            Hora fin {DAY_LABELS[day]}
                          </FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>

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
                    : editingShift
                    ? "Actualizar"
                    : "Crear turno"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
