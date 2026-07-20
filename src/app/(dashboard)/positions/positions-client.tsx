"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Briefcase, Edit, Trash2 } from "lucide-react";
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
import type { Position } from "@/types/position";
import type { UserRole } from "@/types/user";

interface PositionsClientProps {
  userRole: UserRole;
  companyId: string;
  initialPositions: Position[];
}

const positionSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "Máximo 100 caracteres"),
  active: z.boolean(),
});

type PositionFormValues = z.infer<typeof positionSchema>;

export function PositionsClient({
  userRole,
  companyId,
  initialPositions,
}: PositionsClientProps) {
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit =
    userRole === "SAAS_SUPER_ADMIN" || userRole === "COMPANY_ADMIN";

  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionSchema),
    defaultValues: { name: "", active: true },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return positions.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [positions, search]);

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", active: true });
    setDialogOpen(true);
  }

  function openEdit(position: Position) {
    setEditing(position);
    form.reset({ name: position.name, active: position.active });
    setDialogOpen(true);
  }

  async function onSubmit(values: PositionFormValues) {
    setIsSubmitting(true);
    try {
      const url = editing ? `/api/positions/${editing.id}` : "/api/positions";
      const method = editing ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        name: values.name,
        active: values.active,
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
        throw new Error(err.error ?? "Error al guardar el cargo");
      }

      const saved = (await res.json()) as Position;

      if (editing) {
        setPositions((prev) =>
          prev.map((p) =>
            p.id === editing.id
              ? {
                  ...saved,
                  companyId: saved.companyId || p.companyId,
                }
              : p
          )
        );
        toast.success("Cargo actualizado");
      } else {
        setPositions((prev) =>
          [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
        );
        toast.success("Cargo creado");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(position: Position) {
    if (!confirm(`¿Deseas eliminar el cargo "${position.name}"?`)) return;

    try {
      const res = await fetch(`/api/positions/${position.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "Error al eliminar el cargo");
      }
      setPositions((prev) =>
        prev.map((p) => (p.id === position.id ? { ...p, active: false } : p))
      );
      toast.success("Cargo eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cargos"
        description={`${positions.length} cargo${
          positions.length !== 1 ? "s" : ""
        } registrado${positions.length !== 1 ? "s" : ""}`}
        action={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo cargo
            </Button>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cargo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Sin cargos"
          description="No se encontraron cargos con los filtros actuales."
          action={
            canEdit ? (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo cargo
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
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium text-sm">
                      {position.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={position.active ? "ACTIVE" : "INACTIVE"}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(position)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(position)}
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
            {filtered.map((position) => (
              <Card key={position.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{position.name}</p>
                      <div className="mt-2">
                        <StatusBadge
                          status={position.active ? "ACTIVE" : "INACTIVE"}
                        />
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(position)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(position)}
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
              {editing ? "Editar cargo" : "Nuevo cargo"}
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
                    <FormLabel>Nombre del cargo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. Gerente de ventas"
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
                          ? "El cargo está disponible"
                          : "El cargo está inactivo"}
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
                      : "Crear cargo"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
