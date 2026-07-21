"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Search,
  GitBranch,
  Users,
  ScanFace,
  Calendar,
  LogIn,
  Settings2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import type { Status } from "@/types/user";

interface CompanyRow {
  id: string;
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  status: Status;
  subscriptionExpiresAt: string | null;
  maxEmployees: number;
  branchCount: number;
  employeeCount: number;
  registeredFaces: number;
  subscriptionExpired: boolean;
  createdAt: string;
}

interface Props {
  companies: CompanyRow[];
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function endOfDayIso(dateValue: string): string {
  const date = new Date(`${dateValue}T23:59:59.999`);
  return date.toISOString();
}

export function SuperAdminClient({ companies: initial }: Props) {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [companies, setCompanies] = useState(initial);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxEmployees, setMaxEmployees] = useState(10);
  const [saving, setSaving] = useState(false);
  const [enteringId, setEnteringId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.legalName.toLowerCase().includes(q) ||
        c.taxId.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [companies, search]);

  function openSubscriptionDialog(company: CompanyRow) {
    setEditing(company);
    setExpiresAt(toDateInputValue(company.subscriptionExpiresAt));
    setMaxEmployees(company.maxEmployees);
  }

  async function saveSubscription() {
    if (!editing) return;
    if (!expiresAt) {
      toast.error("Indica la fecha de vencimiento");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/companies/${editing.id}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionExpiresAt: endOfDayIso(expiresAt),
          maxEmployees,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");

      setCompanies((prev) =>
        prev.map((c) =>
          c.id === editing.id
            ? {
                ...c,
                subscriptionExpiresAt: data.subscriptionExpiresAt,
                maxEmployees: data.maxEmployees,
                registeredFaces: data.quota?.registeredFaces ?? c.registeredFaces,
                subscriptionExpired: data.subscriptionExpiresAt
                  ? new Date(data.subscriptionExpiresAt).getTime() <= Date.now()
                  : false,
              }
            : c
        )
      );
      toast.success("Suscripción actualizada y auditada");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function enterAccount(company: CompanyRow) {
    setEnteringId(company.id);
    try {
      const res = await fetch("/api/super-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo entrar a la cuenta");

      setUser(data.user, data.accessToken);
      toast.success(`Entraste a ${company.name}`);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al impersonar");
    } finally {
      setEnteringId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consola administrativa"
        description={`${companies.length} empresa${companies.length !== 1 ? "s" : ""} en la plataforma`}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Sucursales</TableHead>
              <TableHead>Empleados</TableHead>
              <TableHead>Rostros</TableHead>
              <TableHead>Cupo</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((company) => {
              const overQuota = company.registeredFaces > company.maxEmployees;
              return (
                <TableRow key={company.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">{company.taxId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <GitBranch className="h-3.5 w-3.5" />
                      {company.branchCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Users className="h-3.5 w-3.5" />
                      {company.employeeCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <ScanFace className="h-3.5 w-3.5" />
                      {company.registeredFaces}
                      {overQuota && (
                        <Badge variant="destructive" className="text-[10px] ml-1">
                          +{company.registeredFaces - company.maxEmployees}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{company.maxEmployees}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {company.subscriptionExpiresAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(company.subscriptionExpiresAt).toLocaleDateString("es-CO")}
                        </span>
                      ) : (
                        "—"
                      )}
                      {company.subscriptionExpired && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">
                          Vencida
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={company.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSubscriptionDialog(company)}
                      >
                        <Settings2 className="h-4 w-4 mr-1" />
                        Suscripción
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => enterAccount(company)}
                        disabled={enteringId === company.id}
                      >
                        <LogIn className="h-4 w-4 mr-1" />
                        {enteringId === company.id ? "Entrando..." : "Entrar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suscripción — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Activo hasta</Label>
              <Input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxEmployees">Cupo de empleados con rostro</Label>
              <Input
                id="maxEmployees"
                type="number"
                min={1}
                value={maxEmployees}
                onChange={(e) => setMaxEmployees(Number(e.target.value))}
              />
              {editing && editing.registeredFaces > maxEmployees && (
                <p className="text-xs text-amber-600">
                  Hay {editing.registeredFaces} rostros activos. El cliente no podrá registrar
                  nuevos hasta inactivar {editing.registeredFaces - maxEmployees}.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveSubscription} disabled={saving}>
              {saving ? "Guardando..." : "Guardar y auditar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
