"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  ExternalLink,
  Key,
  Plus,
  Power,
  RotateCcw,
  Shield,
  Trash2,
} from "lucide-react";

import { useAuthStore } from "@/store/auth-store";
import { formatDateTime } from "@/lib/utils";
import { canManageIntegrations } from "@/lib/user-permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export interface ApiToken {
  id: string;
  name: string;
  scopes: "read" | "read,write";
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  /** true si hay copia cifrada y se puede volver a mostrar el secreto */
  recoverable?: boolean;
}

const createSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "Máximo 100 caracteres"),
  scopes: z.enum(["read", "read,write"]),
});

type CreateForm = z.infer<typeof createSchema>;

interface ApiTokensClientProps {
  initialTokens: ApiToken[];
  embedded?: boolean;
}

function canManage(user: { role: import("@/types/user").UserRole; canManageIntegrations?: boolean } | null) {
  return user ? canManageIntegrations(user) : false;
}

function scopeLabel(scope: ApiToken["scopes"]): string {
  return scope === "read" ? "Solo lectura" : "Lectura y escritura";
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error desconocido";
}

export default function ApiTokensClient({
  initialTokens,
  embedded = false,
}: ApiTokensClientProps) {
  const { user } = useAuthStore();
  const canEdit = canManage(user);

  const [tokens, setTokens] = useState<ApiToken[]>(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<{
    raw: string;
    name: string;
    regenerated?: boolean;
    message?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", scopes: "read" },
  });

  async function onCreate(values: CreateForm) {
    try {
      const res = await fetch("/api/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = (await res.json()) as ApiToken & {
        token?: string;
        error?: string;
      };

      if (!res.ok) {
        toast.error(json.error ?? "Error al crear el token");
        return;
      }

      if (!json.token) {
        toast.error("El token no fue devuelto por el servidor");
        return;
      }

      const { token: rawToken, ...created } = json;
      setTokens((prev) => [{ ...created, recoverable: true }, ...prev]);
      setCreateOpen(false);
      form.reset();
      setRevealedToken({ raw: rawToken, name: created.name, regenerated: false });
      toast.success("Token creado exitosamente");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function revealToken(token: ApiToken) {
    setProcessingId(token.id);
    try {
      const res = await fetch(`/api/api-tokens/${token.id}/reveal`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        token?: string;
        name?: string;
        regenerated?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.token) {
        toast.error(json.error ?? "No se pudo recuperar el token");
        return;
      }
      if (json.regenerated) {
        setTokens((prev) =>
          prev.map((t) =>
            t.id === token.id ? { ...t, recoverable: true } : t
          )
        );
      }
      setRevealedToken({
        raw: json.token,
        name: json.name ?? token.name,
        regenerated: json.regenerated,
        message: json.message,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  }

  async function setTokenActive(token: ApiToken, active: boolean) {
    setProcessingId(token.id);
    try {
      const res = await fetch(`/api/api-tokens/${token.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });

      const json = (await res.json()) as ApiToken & { error?: string };

      if (!res.ok) {
        toast.error(json.error ?? "Error al actualizar el token");
        return;
      }

      setTokens((prev) =>
        prev.map((t) =>
          t.id === json.id
            ? {
                ...t,
                name: json.name,
                scopes: json.scopes,
                active: json.active,
                lastUsedAt: json.lastUsedAt,
                createdAt: json.createdAt,
              }
            : t
        )
      );
      toast.success(
        json.active
          ? "Token reactivado. Vuelve a funcionar con el mismo valor secreto."
          : "Token inactivado. Puedes reactivarlo cuando quieras."
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  }

  async function deleteToken(id: string) {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok) {
        toast.error(json.error ?? "Error al eliminar el token");
        return;
      }

      setTokens((prev) => prev.filter((t) => t.id !== id));
      toast.success("Token eliminado definitivamente");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  }

  async function copyToken(raw: string) {
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    toast.success("Token copiado al portapapeles");
    window.setTimeout(() => setCopied(false), 2000);
  }

  function closeReveal() {
    setRevealedToken(null);
    setCopied(false);
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Tokens de API"
          description="Gestiona los tokens de acceso programático a la API de FaceAccess."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link
                  href="/api/v1/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver docs
                </Link>
              </Button>
              {canEdit && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo token
                </Button>
              )}
            </div>
          }
        />
      )}
      {embedded && canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo token
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Tokens registrados</CardTitle>
          </div>
          <CardDescription>
            Usa <strong>Ver secreto</strong> para recuperar el valor{" "}
            <code className="text-xs">cuenti_…</code>.{" "}
            <strong>Inactivar</strong> pausa el acceso;{" "}
            <strong>Eliminar</strong> es definitivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No hay tokens registrados.</p>
              {canEdit && (
                <p className="text-sm mt-1">
                  Haz clic en <strong>Nuevo token</strong> para crear uno.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Alcances</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último uso</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow
                      key={token.id}
                      className={!token.active ? "opacity-60" : undefined}
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span>{token.name}</span>
                          {!token.active && (
                            <Badge variant="outline" className="w-fit text-[10px]">
                              Inactivo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            token.scopes === "read,write"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {scopeLabel(token.scopes)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={token.active}
                          onCheckedChange={(checked) =>
                            setTokenActive(token, checked)
                          }
                          disabled={!canEdit || processingId === token.id}
                          aria-label={
                            token.active ? "Inactivar token" : "Reactivar token"
                          }
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {token.lastUsedAt
                          ? formatDateTime(token.lastUsedAt)
                          : "Nunca"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(token.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canEdit && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => revealToken(token)}
                              disabled={processingId === token.id}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              {token.recoverable === false
                                ? "Recuperar (nuevo)"
                                : "Ver secreto"}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setTokenActive(token, !token.active)
                            }
                            disabled={!canEdit || processingId === token.id}
                          >
                            {token.active ? (
                              <>
                                <Power className="w-4 h-4 mr-2" />
                                Inactivar
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reactivar
                              </>
                            )}
                          </Button>
                          {canEdit && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={processingId === token.id}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Eliminar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    ¿Eliminar token definitivamente?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se borrará <strong>{token.name}</strong> y
                                    no podrá reactivarse. Si solo quieres
                                    pausarlo, usa <strong>Inactivar</strong>.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteToken(token.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar definitivo
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servicios estratégicos (API v1)</CardTitle>
          <CardDescription>
            El token solo ve datos de <strong>tu empresa</strong>. No hay parámetro
            para consultar otra compañía. Docs interactivas en{" "}
            <Link
              href="/api/v1/docs"
              target="_blank"
              className="underline underline-offset-2"
            >
              /api/v1/docs
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <code className="text-foreground">GET /api/v1/companies/me</code> — empresa del token
            </li>
            <li>
              <code className="text-foreground">GET /api/v1/employees</code> ·{" "}
              <code className="text-foreground">/positions</code> ·{" "}
              <code className="text-foreground">/branches</code> ·{" "}
              <code className="text-foreground">/shifts</code>
            </li>
            <li>
              <code className="text-foreground">GET /api/v1/employee-shifts</code> — asignaciones de turno
            </li>
            <li>
              <code className="text-foreground">GET /api/v1/incidents</code> ·{" "}
              <code className="text-foreground">/incident-types</code> — novedades
            </li>
            <li>
              <code className="text-foreground">GET|POST /api/v1/attendance</code> — historial y marcación (write)
            </li>
            <li>
              <code className="text-foreground">GET /api/v1/reports/daily</code> ·{" "}
              <code className="text-foreground">/reports/hr</code> — informes RR.HH.
            </li>
          </ul>
          <pre className="rounded-md border bg-muted/40 p-3 overflow-x-auto text-xs font-mono whitespace-pre-wrap">{`curl -H "Authorization: Bearer cuenti_…" \\
  "${(process.env.NEXT_PUBLIC_APP_URL ?? "http://192.168.1.230:7578").replace(/\/$/, "")}/api/v1/reports/hr?report=lates&from=2026-07-01&to=2026-07-20"`}</pre>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear token de API</DialogTitle>
            <DialogDescription>
              Asigna un nombre descriptivo y el alcance de permisos.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onCreate)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. Integración contable"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scopes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alcances</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un alcance" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="read">Solo lectura</SelectItem>
                        <SelectItem value="read,write">
                          Lectura y escritura
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting
                    ? "Creando..."
                    : "Crear token"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealedToken !== null}
        onOpenChange={(open) => {
          if (!open) closeReveal();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <DialogTitle>
                {revealedToken?.regenerated
                  ? "Secreto regenerado"
                  : "Secreto del token"}
              </DialogTitle>
            </div>
            <DialogDescription>
              {revealedToken?.message ??
                "Copia el valor y guárdalo en un lugar seguro. Puedes volver a verlo con Ver secreto."}
            </DialogDescription>
          </DialogHeader>
          {revealedToken && (
            <div className="space-y-4">
              <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="text-sm font-medium mb-2">
                  {revealedToken.name}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={revealedToken.raw}
                    className="font-mono text-sm bg-background"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => copyToken(revealedToken.raw)}
                    aria-label="Copiar token"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              {revealedToken.regenerated && (
                <p className="text-xs text-muted-foreground">
                  El valor anterior ya no funciona. Actualiza tus integraciones
                  con este nuevo secreto.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={closeReveal}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
