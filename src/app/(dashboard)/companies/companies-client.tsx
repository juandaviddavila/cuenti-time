"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Building2, GitBranch, Users, Edit, ToggleLeft, ToggleRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getInitials } from "@/lib/utils";
import type { UserRole, Status } from "@/types/user";

interface CompanyRow {
  id: string;
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country: string;
  logo?: string | null;
  status: Status;
  subscriptionExpiresAt?: string | null;
  maxEmployees?: number;
  _count?: { branches: number; employees: number };
  createdAt: string;
  updatedAt: string;
}

interface Props {
  companies: CompanyRow[];
  userRole: UserRole;
}

const companySchema = z.object({
  name:         z.string().min(2, "Mínimo 2 caracteres"),
  legalName:    z.string().min(2, "Mínimo 2 caracteres"),
  taxId:        z.string().min(5, "Mínimo 5 caracteres"),
  email:        z.string().email("Email inválido"),
  phone:        z.string().optional(),
  address:      z.string().optional(),
  city:         z.string().optional(),
});
type CompanyFormValues = z.infer<typeof companySchema>;

export function CompaniesClient({ companies: initial, userRole }: Props) {
  const [companies, setCompanies] = useState<CompanyRow[]>(initial);
  const [search, setSearch]       = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]     = useState<CompanyRow | null>(null);
  const [saving, setSaving]       = useState(false);

  const isSuperAdmin = userRole === "SAAS_SUPER_ADMIN";

  const form = useForm<CompanyFormValues>({ resolver: zodResolver(companySchema) });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return companies.filter(c =>
      !search ||
      c.name.toLowerCase().includes(q) ||
      c.legalName.toLowerCase().includes(q) ||
      c.taxId.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [companies, search]);

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", legalName: "", taxId: "", email: "", phone: "", address: "", city: "" });
    setDialogOpen(true);
  }

  function openEdit(c: CompanyRow) {
    setEditing(c);
    form.reset({
      name: c.name, legalName: c.legalName, taxId: c.taxId, email: c.email,
      phone: c.phone ?? "", address: c.address ?? "", city: c.city ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: CompanyFormValues) {
    setSaving(true);
    try {
      const url    = editing ? `/api/companies/${editing.id}` : "/api/companies";
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { error?: string }; throw new Error(e.error ?? "Error al guardar"); }
      const saved  = await res.json() as CompanyRow;
      if (editing) {
        setCompanies(prev => prev.map(c => c.id === editing.id ? { ...c, ...saved } : c));
        toast.success("Empresa actualizada");
      } else {
        setCompanies(prev => [saved, ...prev]);
        toast.success("Empresa creada");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(c: CompanyRow) {
    const newStatus: Status = c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/companies/${c.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setCompanies(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x));
      toast.success(`Empresa ${newStatus === "ACTIVE" ? "activada" : "desactivada"}`);
    } catch {
      toast.error("Error al cambiar estado");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description={`${companies.length} empresa${companies.length !== 1 ? "s" : ""} registrada${companies.length !== 1 ? "s" : ""}`}
        action={isSuperAdmin ? (
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva empresa</Button>
        ) : undefined}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Sin empresas" description="No se encontraron empresas."
          action={isSuperAdmin ? <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva empresa</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Card key={c.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {getInitials(c.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.legalName}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.taxId}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="space-y-1 text-xs text-muted-foreground mb-4">
                  <p className="truncate">{c.email}</p>
                  {c.phone && <p>{c.phone}</p>}
                  {c.city && <p>{c.city}{c.address ? ` · ${c.address}` : ""}</p>}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  {c._count && (
                    <>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="w-3 h-3" />{c._count.branches}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />{c._count.employees}/{c.maxEmployees ?? 10}
                      </span>
                    </>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="flex gap-2 pt-3 border-t border-border">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(c)}>
                      <Edit className="w-3 h-3 mr-1" />Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(c)}>
                      {c.status === "ACTIVE"
                        ? <ToggleRight className="w-4 h-4 text-green-500" />
                        : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar empresa" : "Nueva empresa"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {(["name","legalName","taxId","email"] as const).map(field => (
                <FormField key={field} control={form.control} name={field} render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>{
                      field === "name" ? "Nombre comercial" :
                      field === "legalName" ? "Razón social" :
                      field === "taxId" ? "NIT / ID fiscal" : "Correo electrónico"
                    }</FormLabel>
                    <FormControl><Input {...f} type={field === "email" ? "email" : "text"} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}
              <div className="grid grid-cols-2 gap-3">
                {(["phone","city"] as const).map(field => (
                  <FormField key={field} control={form.control} name={field} render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>{field === "phone" ? "Teléfono" : "Ciudad"}</FormLabel>
                      <FormControl><Input {...f} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
              </div>
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Dirección</FormLabel>
                  <FormControl><Input {...field} /></FormControl><FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando..." : editing ? "Actualizar" : "Crear empresa"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
