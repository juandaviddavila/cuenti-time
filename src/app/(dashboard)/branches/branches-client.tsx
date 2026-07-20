"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, GitBranch, Users, Edit, ToggleLeft, ToggleRight, MapPin, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { UserRole, Status } from "@/types/user";
import { getBrowserLocation } from "@/lib/browser-location";
import type { BranchLocationValue } from "@/components/shared/branch-location-picker";

const BranchLocationPicker = dynamic(
  () =>
    import("@/components/shared/branch-location-picker").then(
      (mod) => mod.BranchLocationPicker
    ),
  {
    ssr: false,
    loading: () => <div className="h-[280px] rounded-lg bg-muted animate-pulse" />,
  }
);

interface BranchRow {
  id: string; companyId: string; companyName: string; name: string; code: string;
  address?: string | null; city?: string | null; phone?: string | null;
  status: Status; employeeCount: number;
  duplicateWindowMinutes: number;
  latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; radiusMeters: number;
  createdAt: string;
}
interface Company { id: string; name: string; }
interface Props { userRole: UserRole; companyId: string; companies: Company[]; branches: BranchRow[]; }

const branchSchema = z.object({
  name: z.string().min(2), code: z.string().min(1).max(20),
  companyId: z.string().min(1, "Seleccione empresa"),
  address: z.string().optional(), city: z.string().optional(), phone: z.string().optional(),
  duplicateWindowMinutes: z.number().min(0.1, "Mínimo 0.1 minutos").max(1440).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  googlePlaceId: z.string().max(255).optional(),
  radiusMeters: z.number().min(1).max(100000).optional(),
});
type BranchForm = z.infer<typeof branchSchema>;

function mapBranchResponse(
  saved: BranchRow & {
    company?: { name: string };
    _count?: { employees: number };
  },
  fallback: BranchRow,
  companyName: string
): BranchRow {
  return {
    ...fallback,
    ...saved,
    companyName: saved.company?.name ?? companyName,
    employeeCount: saved._count?.employees ?? fallback.employeeCount,
    createdAt: saved.createdAt ?? fallback.createdAt,
  };
}

export function BranchesClient({ userRole, companyId, companies, branches: initial }: Props) {
  const [branches, setBranches] = useState<BranchRow[]>(initial);
  const [search, setSearch]     = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]   = useState<BranchRow | null>(null);
  const [saving, setSaving]     = useState(false);

  const canEdit = userRole === "SAAS_SUPER_ADMIN" || userRole === "COMPANY_ADMIN";
  const isSuperAdmin = userRole === "SAAS_SUPER_ADMIN";

  const form = useForm<BranchForm>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "", code: "", companyId: companyId || companies[0]?.id || "",
      address: "", city: "", phone: "",
      duplicateWindowMinutes: 10,
      radiusMeters: 500,
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return branches.filter(b => !search || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || (b.city ?? "").toLowerCase().includes(q));
  }, [branches, search]);

  function openCreate() {
    setEditing(null);
    form.reset({
      name: "", code: "", companyId: companyId || companies[0]?.id || "",
      address: "", city: "", phone: "",
      duplicateWindowMinutes: 10,
      latitude: undefined,
      longitude: undefined,
      googlePlaceId: "",
      radiusMeters: 500,
    });
    setDialogOpen(true);
  }
  function openEdit(b: BranchRow) {
    setEditing(b);
    form.reset({
      name: b.name, code: b.code, companyId: b.companyId,
      address: b.address ?? "", city: b.city ?? "", phone: b.phone ?? "",
      duplicateWindowMinutes: b.duplicateWindowMinutes,
      latitude: b.latitude ?? undefined,
      longitude: b.longitude ?? undefined,
      googlePlaceId: b.googlePlaceId ?? "",
      radiusMeters: b.radiusMeters ?? 500,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: BranchForm) {
    setSaving(true);
    try {
      const url    = editing ? `/api/branches/${editing.id}` : "/api/branches";
      const method = editing ? "PUT" : "POST";
      const payload = {
        name: values.name,
        code: values.code,
        address: values.address || undefined,
        city: values.city || undefined,
        phone: values.phone || undefined,
        duplicateWindowMinutes: values.duplicateWindowMinutes ?? 10,
        latitude: values.latitude,
        longitude: values.longitude,
        googlePlaceId: values.googlePlaceId || null,
        radiusMeters: values.radiusMeters ?? 500,
        ...(editing ? {} : { companyId: values.companyId }),
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: Record<string, string[]>;
      } & BranchRow & { company?: { name: string }; _count?: { employees: number } };

      if (!res.ok) {
        const detailMsg = json.details
          ? Object.values(json.details).flat().join(", ")
          : "";
        throw new Error(detailMsg || json.error || "Error al guardar la sucursal");
      }

      const companyName = companies.find((c) => c.id === values.companyId)?.name ?? "";
      if (editing) {
        setBranches((prev) =>
          prev.map((b) =>
            b.id === editing.id ? mapBranchResponse(json, b, companyName) : b
          )
        );
        toast.success("Sucursal actualizada");
      } else {
        setBranches((prev) => [
          mapBranchResponse(
            json,
            {
              id: json.id,
              companyId: values.companyId,
              companyName,
              name: values.name,
              code: values.code,
              status: "ACTIVE",
              employeeCount: 0,
              duplicateWindowMinutes: values.duplicateWindowMinutes ?? 10,
              radiusMeters: values.radiusMeters ?? 500,
              createdAt: new Date().toISOString(),
            },
            companyName
          ),
          ...prev,
        ]);
        toast.success("Sucursal creada");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function onInvalid() {
    toast.error("Revisa los campos obligatorios antes de guardar");
  }

  async function toggleStatus(b: BranchRow) {
    const newStatus: Status = b.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/branches/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    if (res.ok) { setBranches(prev => prev.map(x => x.id === b.id ? { ...x, status: newStatus } : x)); toast.success("Estado actualizado"); }
    else toast.error("Error al cambiar estado");
  }

  async function useCurrentLocation() {
    const location = await getBrowserLocation();
    if (!location) {
      toast.error("No se pudo obtener la ubicación del navegador");
      return;
    }

    form.setValue("latitude", Number(location.latitude.toFixed(6)), { shouldDirty: true });
    form.setValue("longitude", Number(location.longitude.toFixed(6)), { shouldDirty: true });
    toast.success("Ubicación cargada");
  }

  const watchedLatitude = form.watch("latitude");
  const watchedLongitude = form.watch("longitude");
  const watchedRadius = form.watch("radiusMeters") ?? 500;

  const handleLocationChange = useCallback(
    (value: BranchLocationValue) => {
      if (value.latitude !== undefined) {
        form.setValue("latitude", value.latitude, { shouldDirty: true });
      }
      if (value.longitude !== undefined) {
        form.setValue("longitude", value.longitude, { shouldDirty: true });
      }
      if (value.address !== undefined) {
        form.setValue("address", value.address, { shouldDirty: true });
      }
      if (value.city !== undefined) {
        form.setValue("city", value.city, { shouldDirty: true });
      }
      if (value.googlePlaceId !== undefined) {
        form.setValue("googlePlaceId", value.googlePlaceId, { shouldDirty: true });
      } else if (value.latitude !== undefined || value.longitude !== undefined) {
        // Si mueven el punto en el mapa, el Place ID deja de coincidir.
        form.setValue("googlePlaceId", "", { shouldDirty: true });
      }
    },
    [form]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Sucursales" description={`${branches.length} sucursal${branches.length !== 1 ? "es" : ""}`}
        action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva sucursal</Button> : undefined} />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar sucursal..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={GitBranch} title="Sin sucursales" description="No se encontraron sucursales."
          action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva sucursal</Button> : undefined} />
      ) : (
        <>
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Código</TableHead>
                  {isSuperAdmin && <TableHead>Empresa</TableHead>}
                  <TableHead>Ciudad</TableHead>
                  <TableHead><Clock className="w-4 h-4" /></TableHead>
                  <TableHead><Users className="w-4 h-4" /></TableHead>
                  <TableHead>Estado</TableHead>
                  {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{b.name}</p>
                      {b.latitude !== null && b.latitude !== undefined && b.longitude !== null && b.longitude !== undefined && (
                        <p className="text-[11px] text-muted-foreground">Radio {b.radiusMeters} m</p>
                      )}
                    </TableCell>
                    <TableCell><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{b.code}</span></TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-sm text-muted-foreground">{b.companyName}</TableCell>
                    )}
                    <TableCell className="text-sm">
                      {b.city ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.city}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.duplicateWindowMinutes} min</TableCell>
                    <TableCell className="text-sm">{b.employeeCount}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleStatus(b)}>
                            {b.status === "ACTIVE" ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden space-y-3">
            {filtered.map(b => (
              <Card key={b.id}><CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isSuperAdmin ? `${b.companyName} · ` : ""}
                      <span className="font-mono">{b.code}</span>
                    </p>
                    {b.city && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{b.city}</p>}
                    {b.latitude !== null && b.latitude !== undefined && b.longitude !== null && b.longitude !== undefined && (
                      <p className="text-xs text-muted-foreground mt-0.5">Radio permitido: {b.radiusMeters} m</p>
                    )}
                    <div className="flex gap-2 mt-2 items-center">
                      <StatusBadge status={b.status} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{b.duplicateWindowMinutes} min</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{b.employeeCount}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Edit className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>
              </CardContent></Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem><FormLabel>Código</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              {userRole === "SAAS_SUPER_ADMIN" && (
                <FormField control={form.control} name="companyId" render={({ field }) => (
                  <FormItem><FormLabel>Empresa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              )}
              <div className="grid grid-cols-2 gap-3">
                {(["city", "phone"] as const).map(f => (
                  <FormField key={f} control={form.control} name={f} render={({ field }) => (
                    <FormItem><FormLabel>{f === "city" ? "Ciudad" : "Teléfono"}</FormLabel>
                      <FormControl><Input {...field} /></FormControl><FormMessage />
                    </FormItem>
                  )} />
                ))}
              </div>
              <FormField control={form.control} name="duplicateWindowMinutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ventana anti-doble tap (minutos)</FormLabel>
                  <FormDescription>
                    Tiempo mínimo entre marcaciones del mismo empleado. Acepta decimales (ej. 0.5 = 30 segundos, 1.5 = 90 segundos).
                  </FormDescription>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0.1}
                      max={1440}
                      step={0.1}
                      value={field.value}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          field.onChange(10);
                          return;
                        }
                        const n = Number(raw);
                        field.onChange(Number.isFinite(n) ? n : field.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Geolocalización</p>
                    <p className="text-xs text-muted-foreground">Si configuras coordenadas, las marcaciones faciales deben estar dentro del radio.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
                    <MapPin className="w-4 h-4 mr-2" />Usar mi ubicación
                  </Button>
                </div>

                <BranchLocationPicker
                  latitude={watchedLatitude}
                  longitude={watchedLongitude}
                  radiusMeters={watchedRadius}
                  onChange={handleLocationChange}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField control={form.control} name="latitude" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitud</FormLabel>
                      <FormControl>
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={field.value ?? ""}
                          placeholder="Selecciona en el mapa"
                          className="bg-muted/50 cursor-default"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="longitude" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitud</FormLabel>
                      <FormControl>
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={field.value ?? ""}
                          placeholder="Selecciona en el mapa"
                          className="bg-muted/50 cursor-default"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="radiusMeters" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Radio (m)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={100000}
                          value={field.value ?? 500}
                          onChange={(e) => field.onChange(e.target.value === "" ? 500 : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando..." : editing ? "Actualizar" : "Crear sucursal"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
