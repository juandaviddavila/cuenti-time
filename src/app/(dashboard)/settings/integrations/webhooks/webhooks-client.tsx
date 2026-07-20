"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDateTime } from "@/lib/utils";

export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEventMeta {
  id: string;
  label: string;
  description: string;
  category: string;
}

const createSchema = z.object({
  url: z.string().url("URL inválida"),
  events: z.array(z.string()).min(1, "Selecciona al menos un evento"),
  timeoutMs: z.number().int().min(500).max(30000),
});

type CreateForm = z.infer<typeof createSchema>;

interface Props {
  initialWebhooks: WebhookRow[];
  availableEvents: string[];
  eventCatalog?: WebhookEventMeta[];
}

export function WebhooksClient({
  initialWebhooks,
  availableEvents,
  eventCatalog = [],
}: Props) {
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const catalogById = useMemo(() => {
    const map = new Map<string, WebhookEventMeta>();
    for (const item of eventCatalog) map.set(item.id, item);
    return map;
  }, [eventCatalog]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, WebhookEventMeta[]>();
    const source =
      eventCatalog.length > 0
        ? eventCatalog
        : availableEvents.map((id) => ({
            id,
            label: id,
            description: "",
            category: "Eventos",
          }));
    for (const item of source) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries());
  }, [availableEvents, eventCatalog]);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { url: "", events: [], timeoutMs: 2000 },
  });

  async function onCreate(values: CreateForm) {
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = (await res.json()) as WebhookRow & { secret?: string; error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Error al crear webhook");
      return;
    }
    const { secret, ...created } = json;
    setWebhooks((prev) => [created, ...prev]);
    setDialogOpen(false);
    form.reset();
    if (secret) setRevealedSecret(secret);
    toast.success("Webhook creado");
  }

  async function toggleActive(webhook: WebhookRow) {
    setProcessingId(webhook.id);
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !webhook.active }),
      });
      const json = (await res.json()) as WebhookRow & { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Error al actualizar");
        return;
      }
      setWebhooks((prev) => prev.map((w) => (w.id === json.id ? json : w)));
    } finally {
      setProcessingId(null);
    }
  }

  async function deleteWebhook(id: string) {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Error al eliminar webhook");
        return;
      }
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success("Webhook desactivado");
    } finally {
      setProcessingId(null);
    }
  }

  function eventLabel(eventId: string): string {
    return catalogById.get(eventId)?.label ?? eventId;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Webhooks registrados</CardTitle>
          </div>
          <CardDescription>
            Notificaciones HTTP firmadas (HMAC-SHA256) solo con datos de tu
            empresa. Si falla: hasta 3 reintentos, uno cada 10 minutos; luego
            FAILED.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay webhooks configurados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="max-w-[240px] truncate font-mono text-xs">
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="secondary" className="text-[10px]">
                            {eventLabel(event)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={webhook.active}
                        disabled={processingId === webhook.id}
                        onCheckedChange={() => toggleActive(webhook)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(webhook.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={processingId === webhook.id}
                        onClick={() => deleteWebhook(webhook.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos estratégicos</CardTitle>
          <CardDescription>
            El payload incluye{" "}
            <code className="text-xs">companyId</code> de tu tenant. Verifica la
            firma con el secret del webhook (
            <code className="text-xs">X-Cuenti-Signature</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {groupedEvents.map(([category, items]) => (
            <div key={category}>
              <p className="font-medium mb-2">{category}</p>
              <ul className="space-y-1.5 text-muted-foreground">
                {items.map((item) => (
                  <li key={item.id}>
                    <code className="text-foreground text-xs">{item.id}</code>
                    {" — "}
                    {item.description || item.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo webhook</DialogTitle>
            <DialogDescription>
              El secret HMAC se muestra una sola vez tras crear.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de destino</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://tu-servidor.com/webhooks/cuenti"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="events"
                render={() => (
                  <FormItem>
                    <FormLabel>Eventos</FormLabel>
                    <div className="space-y-4 max-h-64 overflow-y-auto rounded-md border p-3">
                      {groupedEvents.map(([category, items]) => (
                        <div key={category} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {category}
                          </p>
                          {items.map((item) => (
                            <FormField
                              key={item.id}
                              control={form.control}
                              name="events"
                              render={({ field }) => (
                                <FormItem className="flex items-start gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.id)}
                                      onCheckedChange={(checked) => {
                                        const next = checked
                                          ? [...(field.value ?? []), item.id]
                                          : (field.value ?? []).filter(
                                              (e) => e !== item.id
                                            );
                                        field.onChange(next);
                                      }}
                                    />
                                  </FormControl>
                                  <div className="space-y-0.5">
                                    <FormLabel className="font-normal text-sm leading-none">
                                      {item.label}
                                    </FormLabel>
                                    <p className="text-xs text-muted-foreground font-mono">
                                      {item.id}
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Crear</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(revealedSecret)}
        onOpenChange={(open) => {
          if (!open) setRevealedSecret(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Secret del webhook</DialogTitle>
            <DialogDescription>
              Guárdalo ahora. Se usa para validar{" "}
              <code className="text-xs">X-Cuenti-Signature</code>.
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={revealedSecret ?? ""} className="font-mono text-xs" />
          <DialogFooter>
            <Button
              type="button"
              onClick={async () => {
                if (revealedSecret) {
                  await navigator.clipboard.writeText(revealedSecret);
                  toast.success("Secret copiado");
                }
                setRevealedSecret(null);
              }}
            >
              Copiar y cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
