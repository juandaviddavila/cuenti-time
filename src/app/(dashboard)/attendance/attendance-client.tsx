"use client";

import { useMemo, useState } from "react";
import {
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  Clock,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getInitials, formatDateTime } from "@/lib/utils";
import type { AttendanceType, ValidationResult } from "@/types/attendance";
import type { UserRole } from "@/types/user";

interface AttendanceRow {
  id: string;
  employeeName: string;
  employeePhoto?: string;
  position?: string;
  branchName: string;
  type: AttendanceType;
  recordedAt: string;
  validationStatus: ValidationResult;
  confidenceScore?: number;
  isManual: boolean;
  notes?: string;
}

interface AttendanceStats {
  checkInsToday: number;
  checkOutsToday: number;
  successRate: number;
  facialFails: number;
}

interface Props {
  records: AttendanceRow[];
  stats: AttendanceStats;
  userRole: UserRole;
}

const PAGE_SIZE = 20;

const VALIDATION_LABELS: Record<ValidationResult, { label: string; color: string }> = {
  SUCCESS: { label: "Exitoso", color: "bg-green-500/10 text-green-600 border-green-200" },
  FAILED: { label: "Fallido", color: "bg-red-500/10 text-red-600 border-red-200" },
  LOW_CONFIDENCE: { label: "Baja confianza", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
  LIVENESS_FAILED: { label: "Vida no detectada", color: "bg-red-500/10 text-red-600 border-red-200" },
  SPOOFING_DETECTED: { label: "Fraude detectado", color: "bg-red-500/10 text-red-600 border-red-200" },
  FACE_NOT_FOUND: { label: "Sin rostro", color: "bg-slate-500/10 text-slate-600 border-slate-200" },
  MULTIPLE_FACES: { label: "Múltiples rostros", color: "bg-orange-500/10 text-orange-600 border-orange-200" },
};

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AttendanceClient({ records: initialRecords, stats, userRole }: Props) {
  const [records, setRecords] = useState(initialRecords);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AttendanceType>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<AttendanceRow | null>(null);
  const [editDatetime, setEditDatetime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRow | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage =
    userRole === "SAAS_SUPER_ADMIN" ||
    userRole === "COMPANY_ADMIN" ||
    userRole === "BRANCH_SUPERVISOR";

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch = !search || r.employeeName.toLowerCase().includes(q);
      const matchesType = typeFilter === "all" || r.type === typeFilter;
      const matchesDate = !dateFilter || r.recordedAt.startsWith(dateFilter);
      return matchesSearch && matchesType && matchesDate;
    });
  }, [records, search, typeFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilterChange() {
    setPage(1);
  }

  function openEdit(row: AttendanceRow) {
    setEditTarget(row);
    setEditDatetime(toDatetimeLocalValue(row.recordedAt));
    setEditNotes(row.notes ?? "");
  }

  async function saveEdit() {
    if (!editTarget || !editDatetime) {
      toast.error("Indica fecha y hora");
      return;
    }
    setSaving(true);
    try {
      const recordedAt = new Date(editDatetime).toISOString();
      const res = await fetch(`/api/attendance/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordedAt,
          notes: editNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? "No se pudo actualizar");
      }
      setRecords((prev) =>
        prev.map((r) =>
          r.id === editTarget.id
            ? { ...r, recordedAt, notes: editNotes.trim() || undefined, isManual: true }
            : r
        )
      );
      toast.success(
        editTarget.type === "CHECK_IN"
          ? "Hora de entrada actualizada"
          : "Hora de salida actualizada"
      );
      setEditTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? "No se pudo eliminar");
      }
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("Asistencia eliminada");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  function ActionButtons({ row }: { row: AttendanceRow }) {
    if (!canManage) return null;
    return (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Editar hora">
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDeleteTarget(row)}
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historial de Asistencia"
        description="Últimas 50 marcaciones registradas"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <LogIn className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Entradas hoy</span>
            </div>
            <p className="text-2xl font-bold">{stats.checkInsToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <LogOut className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Salidas hoy</span>
            </div>
            <p className="text-2xl font-bold">{stats.checkOutsToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Tasa éxito</span>
            </div>
            <p className="text-2xl font-bold">{stats.successRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Fallos faciales</span>
            </div>
            <p className="text-2xl font-bold">{stats.facialFails}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            handleFilterChange();
          }}
          className="w-full sm:w-44"
        />
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v as "all" | AttendanceType);
            handleFilterChange();
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="CHECK_IN">Entradas</SelectItem>
            <SelectItem value="CHECK_OUT">Salidas</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empleado..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleFilterChange();
            }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha / Hora</TableHead>
              <TableHead>Validación</TableHead>
              <TableHead>Confianza</TableHead>
              <TableHead>Manual</TableHead>
              {canManage && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 8 : 7}
                  className="text-center py-12 text-muted-foreground"
                >
                  No hay registros con los filtros actuales
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(r.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{r.employeeName}</p>
                        {r.position && (
                          <p className="text-xs text-muted-foreground">{r.position}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.branchName}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.type} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(r.recordedAt)}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const cfg = VALIDATION_LABELS[r.validationStatus];
                      return (
                        <Badge variant="outline" className={`${cfg.color} text-xs`}>
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="w-28">
                    {r.confidenceScore !== undefined ? (
                      <div className="space-y-1">
                        <Progress value={r.confidenceScore * 100} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
                          {Math.round(r.confidenceScore * 100)}%
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.isManual && (
                      <Badge
                        variant="outline"
                        className="bg-purple-500/10 text-purple-600 border-purple-200 text-xs"
                      >
                        Manual
                      </Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <ActionButtons row={r} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {paginated.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No hay registros con los filtros actuales
          </p>
        ) : (
          paginated.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {getInitials(r.employeeName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{r.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{r.branchName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(r.recordedAt)}
                        </p>
                      </div>
                      <ActionButtons row={r} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <StatusBadge status={r.type} />
                      {(() => {
                        const cfg = VALIDATION_LABELS[r.validationStatus];
                        return (
                          <Badge variant="outline" className={`${cfg.color} text-xs`}>
                            {cfg.label}
                          </Badge>
                        );
                      })()}
                      {r.isManual && (
                        <Badge
                          variant="outline"
                          className="bg-purple-500/10 text-purple-600 border-purple-200 text-xs"
                        >
                          Manual
                        </Badge>
                      )}
                    </div>
                    {r.confidenceScore !== undefined && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Confianza</span>
                          <span>{Math.round(r.confidenceScore * 100)}%</span>
                        </div>
                        <Progress value={r.confidenceScore * 100} className="h-1.5" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} · {filtered.length} registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget?.type === "CHECK_IN" ? "Editar hora de entrada" : "Editar hora de salida"}
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {editTarget.employeeName} · {editTarget.branchName}
              </p>
              <div className="space-y-2">
                <Label htmlFor="attendance-datetime">Fecha y hora</Label>
                <Input
                  id="attendance-datetime"
                  type="datetime-local"
                  value={editDatetime}
                  onChange={(e) => setEditDatetime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-notes">Motivo / nota (opcional)</Label>
                <Textarea
                  id="attendance-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ej. Corrección por error de marcación"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveEdit} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta marcación?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Se eliminará la ${deleteTarget.type === "CHECK_IN" ? "entrada" : "salida"} de ${deleteTarget.employeeName} (${formatDateTime(deleteTarget.recordedAt)}). Esta acción no se puede deshacer.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
