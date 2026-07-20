"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Calendar as CalendarIcon,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
  Clock,
  FileText,
  AlertCircle,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  subMonths,
  addMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/user";

interface Incident {
  id: string;
  companyId: string;
  employeeId?: string | null;
  branchId?: string | null;
  incidentTypeId: string;
  date: string;
  overrideStart?: string | null;
  overrideEnd?: string | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; fullName: string } | null;
  branch?: { id: string; name: string } | null;
  incidentType: { id: string; name: string };
}

interface IncidentType {
  id: string;
  name: string;
  active?: boolean;
}

interface Employee {
  id: string;
  fullName: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Props {
  userRole: UserRole;
  incidents: Incident[];
  incidentTypes: IncidentType[];
  employees: Employee[];
  branches: Branch[];
}

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const incidentSchema = z.object({
  employeeId: z.string().optional(),
  branchId: z.string().optional(),
  incidentTypeId: z.string().min(1, "Seleccione un tipo de novedad"),
  date: z.date(),
  overrideStart: z.string().regex(timePattern, "Formato HH:MM").optional(),
  overrideEnd: z.string().regex(timePattern, "Formato HH:MM").optional(),
  reason: z.string().max(500).optional(),
});

type IncidentForm = z.infer<typeof incidentSchema>;

export function IncidentsClient({ userRole, incidents: initial, incidentTypes, employees, branches }: Props) {
  const canEdit = userRole === "SAAS_SUPER_ADMIN" || userRole === "COMPANY_ADMIN" || userRole === "BRANCH_SUPERVISOR";

  const [incidents, setIncidents] = useState<Incident[]>(initial);
  const [search, setSearch] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<IncidentForm>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      employeeId: "none",
      branchId: "none",
      incidentTypeId: "",
      date: new Date(),
      overrideStart: "",
      overrideEnd: "",
      reason: "",
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return incidents.filter((inc) => {
      const matchesSearch =
        !q ||
        inc.employee?.fullName.toLowerCase().includes(q) ||
        inc.branch?.name.toLowerCase().includes(q) ||
        inc.incidentType.name.toLowerCase().includes(q) ||
        (inc.reason ?? "").toLowerCase().includes(q);
      const matchesEmployee =
        employeeFilter.length === 0 ||
        (inc.employeeId != null && employeeFilter.includes(inc.employeeId));
      const matchesBranch = branchFilter === "all" || inc.branchId === branchFilter;
      const matchesDate = !selectedDate || isSameDay(new Date(inc.date), selectedDate);
      return matchesSearch && matchesEmployee && matchesBranch && matchesDate;
    });
  }, [incidents, search, employeeFilter, branchFilter, selectedDate]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Incident[]>();
    incidents.forEach((inc) => {
      const key = format(new Date(inc.date), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(inc);
      map.set(key, list);
    });
    return map;
  }, [incidents]);

  function openCreate() {
    setEditing(null);
    form.reset({
      employeeId: "none",
      branchId: "none",
      incidentTypeId: "",
      date: selectedDate ?? new Date(),
      overrideStart: "",
      overrideEnd: "",
      reason: "",
    });
    setDialogOpen(true);
  }

  function openEdit(incident: Incident) {
    setEditing(incident);
    form.reset({
      employeeId: incident.employeeId ?? "none",
      branchId: incident.branchId ?? "none",
      incidentTypeId: incident.incidentTypeId,
      date: new Date(incident.date),
      overrideStart: incident.overrideStart ?? "",
      overrideEnd: incident.overrideEnd ?? "",
      reason: incident.reason ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: IncidentForm) {
    setSaving(true);
    try {
      const payload = {
        employeeId:
          !values.employeeId || values.employeeId === "none"
            ? null
            : values.employeeId,
        branchId:
          !values.branchId || values.branchId === "none"
            ? null
            : values.branchId,
        incidentTypeId: values.incidentTypeId,
        date: values.date.toISOString(),
        overrideStart: values.overrideStart || null,
        overrideEnd: values.overrideEnd || null,
        reason: values.reason || null,
      };
      const url = editing ? `/api/incidents/${editing.id}` : "/api/incidents";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Error al guardar");
      }
      const saved = (await res.json()) as Incident;
      if (editing) {
        setIncidents((prev) => prev.map((i) => (i.id === editing.id ? saved : i)));
        toast.success("Novedad actualizada");
      } else {
        setIncidents((prev) => [saved, ...prev]);
        toast.success("Novedad creada");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    const res = await fetch(`/api/incidents/${id}`, { method: "DELETE" });
    if (res.ok) {
      setIncidents((prev) => prev.filter((i) => i.id !== id));
      toast.success("Novedad eliminada");
    } else {
      toast.error("Error al eliminar");
    }
    setDeleteTarget(null);
  }

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarDate), { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarDate]);

  const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novedades"
        description="Gestione incapacidades, permisos, horas extras y otros eventos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCalendarDate((d) => subMonths(d, 1))}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h3 className="text-sm font-semibold capitalize">
                {format(calendarDate, "MMMM yyyy", { locale: es })}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setCalendarDate((d) => addMonths(d, 1))}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
              {weekDayLabels.map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayIncidents = groupedByDate.get(key) ?? [];
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, calendarDate);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={cn(
                      "relative h-10 rounded-md text-sm flex items-center justify-center transition-colors",
                      !isCurrentMonth && "text-muted-foreground/50",
                      isSelected && "bg-primary text-primary-foreground",
                      !isSelected && isCurrentMonth && "hover:bg-accent"
                    )}
                  >
                    {format(day, "d")}
                    {dayIncidents.length > 0 && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>
            {selectedDate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Filtrando: {format(selectedDate, "dd/MM/yyyy")}
                </span>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSelectedDate(null)}>
                  Limpiar
                </Button>
              </div>
            )}
            {canEdit && (
              <Button className="w-full" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva novedad
              </Button>
            )}
          </CardContent>
        </Card>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empleado, sucursal, tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <SearchableSelect
              multiple
              value={employeeFilter}
              onValueChange={setEmployeeFilter}
              placeholder="Empleado"
              allLabel="Todos los empleados"
              searchPlaceholder="Buscar empleado..."
              triggerClassName="w-56"
              options={employees.map((e) => ({
                value: e.id,
                label: e.fullName,
              }))}
            />
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No hay novedades"
              description={selectedDate ? "No hay novedades para la fecha seleccionada." : "Cree una nueva novedad desde el calendario."}
            />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Empleado/Sucursal</TableHead>
                      <TableHead>Horario</TableHead>
                      <TableHead>Motivo</TableHead>
                      {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inc) => (
                      <TableRow key={inc.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(inc.date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-500/10 text-orange-600 border border-orange-200 dark:border-orange-800">
                            {inc.incidentType.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          {inc.employee ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              {inc.employee.fullName}
                            </div>
                          ) : inc.branch ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              {inc.branch.name}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {inc.overrideStart && inc.overrideEnd ? (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              {inc.overrideStart} - {inc.overrideEnd}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={inc.reason ?? undefined}>
                          {inc.reason || "—"}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(inc)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(inc)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden grid gap-3">
                {filtered.map((inc) => (
                  <Card key={inc.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {format(new Date(inc.date), "dd/MM/yyyy")}
                          </p>
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-500/10 text-orange-600 border border-orange-200 dark:border-orange-800">
                            {inc.incidentType.name}
                          </span>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(inc)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(inc)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {inc.employee ? (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {inc.employee.fullName}
                        </div>
                      ) : inc.branch ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {inc.branch.name}
                        </div>
                      ) : null}
                      {inc.overrideStart && inc.overrideEnd && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {inc.overrideStart} - {inc.overrideEnd}
                        </div>
                      )}
                      {inc.reason && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <FileText className="w-4 h-4 mt-0.5" />
                          {inc.reason}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar novedad" : "Nueva novedad"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="incidentTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de novedad</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {incidentTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Seleccione una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => field.onChange(date ?? new Date())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empleado</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value || "none"}
                          onValueChange={field.onChange}
                          placeholder="Seleccione..."
                          searchPlaceholder="Buscar empleado..."
                          options={[
                            { value: "none", label: "Ninguno" },
                            ...employees.map((e) => ({
                              value: e.id,
                              label: e.fullName,
                            })),
                          ]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sucursal</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Ninguna</SelectItem>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="overrideStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horario laboral inicio (opcional)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <p className="text-[0.8rem] text-muted-foreground">
                        Reemplaza la hora de entrada del turno ese día.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="overrideEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horario laboral fin (opcional)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <p className="text-[0.8rem] text-muted-foreground">
                        Reemplaza la hora de salida del turno ese día.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describa la novedad..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : editing ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la novedad del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && onDelete(deleteTarget.id)} className="bg-destructive">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
