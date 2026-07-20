"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Camera, Edit, ToggleLeft, ToggleRight, Users, ImageIcon,
  Clock, Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { PhotoCaptureModal } from "@/components/shared/photo-capture-modal";
import { getInitials } from "@/lib/utils";
import type { Position } from "@/types/position";
import type { DocumentType } from "@/types/employee";
import type { UserRole, Status } from "@/types/user";

interface Branch { id: string; name: string; }
interface EmployeeRow {
  id: string; companyId: string; branchId: string; branchName: string;
  fullName: string; documentType: DocumentType; documentNumber: string;
  positionId?: string; positionName?: string; email?: string; phone?: string; photo?: string;
  status: Status; faceRegistered: boolean; faceRegisteredAt?: string;
  hireDate?: string; internalCode?: string; createdAt: string; updatedAt: string;
}
interface Props {
  companyId: string;
  userRole: UserRole;
  employees: EmployeeRow[];
  branches: Branch[];
  positions: Position[];
}

interface Shift {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeShift {
  id: string;
  employeeId: string;
  shiftId: string;
  startDate: string;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  employee: { id: string; fullName: string };
  shift: { id: string; name: string };
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "PASSPORT", label: "Pasaporte" },
  { value: "NIT", label: "NIT" },
  { value: "OTHER", label: "Otro" },
];

const employeeSchema = z.object({
  fullName:       z.string().min(2, "Mínimo 2 caracteres"),
  documentType:   z.enum(["CC", "CE", "PASSPORT", "NIT", "OTHER"] as const),
  documentNumber: z.string().min(4, "Mínimo 4 caracteres"),
  positionId:     z.string().optional(),
  email:          z.string().optional().refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email inválido"),
  phone:          z.string().optional(),
  branchId:       z.string().cuid("Seleccione una sucursal válida"),
  hireDate:       z.string().optional(),
  internalCode:   z.string().optional(),
});
type EmployeeFormValues = z.infer<typeof employeeSchema>;

export function EmployeesClient({ companyId, userRole, employees: initialEmployees, branches, positions }: Props) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [faceFilter, setFaceFilter] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [shiftEmployeeId, setShiftEmployeeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Photo state — managed outside the RHF schema to avoid base64 in Zod
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const canEdit = userRole === "SAAS_SUPER_ADMIN" || userRole === "COMPANY_ADMIN" || userRole === "FACE_REGISTRAR";

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { fullName: "", documentType: "CC", documentNumber: "", positionId: "", email: "", phone: "", branchId: branches[0]?.id ?? "", hireDate: "", internalCode: "" },
  });

  const filtered = useMemo(() => employees.filter(emp => {
    const q = search.toLowerCase();
    return (
      (!search || emp.fullName.toLowerCase().includes(q) || emp.documentNumber.toLowerCase().includes(q)) &&
      (branchFilter === "all" || emp.branchId === branchFilter) &&
      (statusFilter === "all" || emp.status === statusFilter) &&
      (!faceFilter || emp.faceRegistered)
    );
  }), [employees, search, branchFilter, statusFilter, faceFilter]);

  function openCreate() {
    setEditingEmployee(null);
    setShiftEmployeeId(null);
    setPhotoPreview(null);
    form.reset({ fullName: "", documentType: "CC", documentNumber: "", positionId: "", email: "", phone: "", branchId: branches[0]?.id ?? "", hireDate: "", internalCode: "" });
    setDialogOpen(true);
  }

  function openEdit(emp: EmployeeRow) {
    setEditingEmployee(emp);
    setShiftEmployeeId(emp.id);
    setPhotoPreview(emp.photo ?? null);
    form.reset({
      fullName: emp.fullName, documentType: emp.documentType, documentNumber: emp.documentNumber,
      positionId: emp.positionId ?? "", email: emp.email ?? "", phone: emp.phone ?? "",
      branchId: emp.branchId, hireDate: emp.hireDate ? emp.hireDate.split("T")[0] : "", internalCode: emp.internalCode ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: EmployeeFormValues) {
    setIsSubmitting(true);
    try {
      const hireDateISO = values.hireDate ? new Date(values.hireDate).toISOString() : undefined;
      const payload = {
        fullName: values.fullName,
        documentType: values.documentType,
        documentNumber: values.documentNumber,
        branchId: values.branchId,
        positionId: values.positionId?.trim() || undefined,
        email: values.email?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        internalCode: values.internalCode?.trim() || undefined,
        hireDate: hireDateISO,
        photo: photoPreview ?? (editingEmployee ? null : undefined),
      };

      if (editingEmployee) {
        const res = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({})) as { error?: string; details?: Record<string, string[]> };
          const detail = e.details ? Object.entries(e.details).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ") : "";
          throw new Error(detail ? `${e.error ?? "Error"} (${detail})` : (e.error ?? "Error al actualizar"));
        }
        setEmployees(prev => prev.map(e => e.id === editingEmployee.id
          ? {
              ...e,
              ...values,
              positionId: values.positionId?.trim() || undefined,
              positionName: values.positionId?.trim()
                ? positions.find(p => p.id === values.positionId)?.name
                : undefined,
              photo: photoPreview ?? undefined,
              branchName: branches.find(b => b.id === values.branchId)?.name ?? e.branchName,
              hireDate: hireDateISO,
              updatedAt: new Date().toISOString(),
            }
          : e));
        toast.success("Empleado actualizado");
        setDialogOpen(false);
      } else {
        const res = await fetch("/api/employees", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, companyId }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({})) as { error?: string; details?: Record<string, string[]> };
          const detail = e.details ? Object.entries(e.details).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ") : "";
          throw new Error(detail ? `${e.error ?? "Error"} (${detail})` : (e.error ?? "Error al crear"));
        }
        const created = await res.json() as EmployeeRow & { branch?: { name: string }; position?: { name: string } };
        const createdRow: EmployeeRow = {
          ...created,
          branchName: created.branch?.name ?? branches.find(b => b.id === values.branchId)?.name ?? "",
          positionName: created.position?.name ?? positions.find(p => p.id === values.positionId)?.name,
          createdAt: created.createdAt ?? new Date().toISOString(),
          updatedAt: created.updatedAt ?? new Date().toISOString(),
        };
        setEmployees(prev => [createdRow, ...prev]);
        setEditingEmployee(createdRow);
        setShiftEmployeeId(createdRow.id);
        toast.success("Empleado creado exitosamente. Ahora puedes asignar turnos.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleStatus(emp: EmployeeRow) {
    const newStatus: Status = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/employees/${emp.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    if (res.ok) { setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e)); toast.success(`Empleado ${newStatus === "ACTIVE" ? "activado" : "desactivado"}`); }
    else toast.error("Error al cambiar estado del empleado");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empleados"
        description={`${employees.length} empleado${employees.length !== 1 ? "s" : ""} registrado${employees.length !== 1 ? "s" : ""}`}
        action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nuevo empleado</Button> : undefined}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o documento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Sucursal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sucursales</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ACTIVE">Activos</SelectItem>
            <SelectItem value="INACTIVE">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={faceFilter ? "default" : "outline"} onClick={() => setFaceFilter(p => !p)} className="shrink-0">
          <Camera className="w-4 h-4 mr-2" />{faceFilter ? "Con rostro" : "Todos"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No hay empleados" description="No se encontraron empleados con los filtros actuales."
          action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nuevo empleado</Button> : undefined} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rostro</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          {emp.photo && <AvatarImage src={emp.photo} alt={emp.fullName} />}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {getInitials(emp.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{emp.fullName}</p>
                          {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm"><span className="text-muted-foreground text-xs mr-1">{emp.documentType}</span>{emp.documentNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.positionName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{emp.branchName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={emp.faceRegistered ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" : "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800"}>
                        {emp.faceRegistered ? "Registrado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={emp.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/facial-registration?employeeId=${emp.id}`)} title="Registrar rostro facial">
                          <Camera className="w-4 h-4" />
                        </Button>
                        {canEdit && <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(emp)} title="Editar"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleStatus(emp)} title={emp.status === "ACTIVE" ? "Desactivar" : "Activar"}>
                            {emp.status === "ACTIVE" ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                        </>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(emp => (
              <Card key={emp.id}><CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12 shrink-0">
                    {emp.photo && <AvatarImage src={emp.photo} alt={emp.fullName} />}
                    <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">{getInitials(emp.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{emp.fullName}</p>
                    <p className="text-xs text-muted-foreground">{emp.documentType} {emp.documentNumber}</p>
                    {emp.positionName && <p className="text-xs text-muted-foreground mt-0.5">{emp.positionName}</p>}
                    <p className="text-xs text-muted-foreground">{emp.branchName}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <StatusBadge status={emp.status} />
                      <Badge variant="outline" className={emp.faceRegistered ? "bg-green-500/10 text-green-600 border-green-200 text-xs" : "bg-yellow-500/10 text-yellow-600 border-yellow-200 text-xs"}>
                        {emp.faceRegistered ? "Rostro OK" : "Sin rostro"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/facial-registration?employeeId=${emp.id}`)}>
                      <Camera className="w-4 h-4" />
                    </Button>
                    {canEdit && <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}><Edit className="w-4 h-4" /></Button>}
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        </>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* ── Photo upload + camera capture ─────────────────────── */}
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20 cursor-pointer" onClick={() => setPhotoModalOpen(true)}>
                  {photoPreview && <AvatarImage src={photoPreview} alt="Foto" className="object-cover" />}
                  <AvatarFallback className="bg-muted text-muted-foreground text-xl">
                    {form.watch("fullName") ? getInitials(form.watch("fullName")) : <ImageIcon className="w-8 h-8" />}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Foto del empleado</p>
                  <p className="text-xs text-muted-foreground">Sube una foto o tómala con la cámara</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPhotoModalOpen(true)}>
                      <Camera className="w-3 h-3 mr-1" />Tomar / Subir foto
                    </Button>
                    {photoPreview && (
                      <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setPhotoPreview(null)}>
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <PhotoCaptureModal
                open={photoModalOpen}
                onClose={() => setPhotoModalOpen(false)}
                onCapture={(dataUrl) => setPhotoPreview(dataUrl)}
                employeeName={form.watch("fullName")}
              />

              <Separator />

              {/* ── Form fields ───────────────────────────────────────── */}
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem><FormLabel>Nombre completo</FormLabel><FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="documentType" render={({ field }) => (
                  <FormItem><FormLabel>Tipo documento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{DOCUMENT_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="documentNumber" render={({ field }) => (
                  <FormItem><FormLabel>Número</FormLabel><FormControl><Input placeholder="1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="positionId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo</FormLabel>
                  {positions.length === 0 ? (
                    <div className="text-sm text-muted-foreground rounded-md border p-3">
                      No hay cargos registrados.{" "}
                      <Link href="/positions" className="text-primary underline hover:text-primary/80">
                        Crea un cargo primero
                      </Link>
                    </div>
                  ) : (
                    <Select
                      onValueChange={v => field.onChange(v === "none" ? "" : v)}
                      value={field.value ? field.value : "none"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar cargo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {/* Radix Select no admite value="" — provoca error de runtime */}
                        <SelectItem value="none">Sin cargo</SelectItem>
                        {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="branchId" render={({ field }) => (
                <FormItem><FormLabel>Sucursal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger></FormControl>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="juan@empresa.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input placeholder="300 123 4567" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="hireDate" render={({ field }) => (
                  <FormItem><FormLabel>Fecha ingreso</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="internalCode" render={({ field }) => (
                  <FormItem><FormLabel>Código interno</FormLabel><FormControl><Input placeholder="EMP-001" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {shiftEmployeeId && (
                <ShiftAssignmentSection employeeId={shiftEmployeeId} canEdit={canEdit} />
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Guardando..." : editingEmployee ? "Actualizar" : "Crear empleado"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShiftAssignmentSection({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<EmployeeShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [shiftsRes, assignmentsRes] = await Promise.all([
          fetch("/api/shifts?active=true"),
          fetch(`/api/employee-shifts?employeeId=${encodeURIComponent(employeeId)}`),
        ]);
        const shiftsJson = (await shiftsRes.json()) as { data?: Shift[] };
        const assignmentsJson = (await assignmentsRes.json()) as { data?: EmployeeShift[] };
        if (!cancelled) {
          setShifts(shiftsJson.data ?? []);
          setAssignments(assignmentsJson.data ?? []);
        }
      } catch (err) {
        console.error("Error loading shift data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [employeeId, refreshKey]);

  async function handleAssign() {
    if (!selectedShiftId || !startDate) {
      toast.error("Selecciona un turno y una fecha de inicio");
      return;
    }
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    if (end && end <= start) {
      toast.error("La fecha final debe ser posterior a la inicial");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch("/api/employee-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          shiftId: selectedShiftId,
          startDate: start.toISOString(),
          endDate: end ? end.toISOString() : null,
        }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? "Error al asignar turno");
      }
      toast.success("Turno asignado correctamente");
      setSelectedShiftId("");
      setStartDate("");
      setEndDate("");
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setAssigning(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Deseas eliminar esta asignación de turno?")) return;
    try {
      const res = await fetch(`/api/employee-shifts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? "Error al eliminar asignación");
      }
      toast.success("Asignación eliminada");
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Asignación de turnos</h4>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando turnos...</p>
      ) : shifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay turnos registrados.{" "}
          <Link href="/shifts" className="text-primary underline hover:text-primary/80">
            Crea un turno primero
          </Link>
        </p>
      ) : (
        <>
          {canEdit && (
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Turno</label>
                <Select
                  value={selectedShiftId || undefined}
                  onValueChange={setSelectedShiftId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Fecha inicio</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Fecha fin (opcional)</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <Button type="button" onClick={handleAssign} disabled={assigning} className="w-full">
                {assigning ? "Asignando..." : "Asignar turno"}
              </Button>
            </div>
          )}

          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay turnos asignados a este empleado.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Turnos asignados</p>
              <div className="divide-y rounded-md border">
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium">{a.shift.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.startDate).toLocaleDateString("es-CO")}
                        {a.endDate ? ` → ${new Date(a.endDate).toLocaleDateString("es-CO")}` : " (sin fecha de fin)"}
                      </p>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} title="Eliminar asignación">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
