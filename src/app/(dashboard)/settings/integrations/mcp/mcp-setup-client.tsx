"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Check, Copy, Key, Cloud, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MCP_TOOLS = [
  { tool: "get_late_arrivals", body: "Tardanzas del período con minutos de atraso." },
  { tool: "get_absences", body: "Días laborales sin entrada." },
  { tool: "get_early_leaves", body: "Salidas anticipadas antes del fin de turno." },
  { tool: "get_open_days", body: "Entradas sin salida." },
  { tool: "get_employee_summary", body: "KPIs por empleado (puntualidad, ausencias, etc.)." },
  { tool: "get_branch_summary", body: "KPIs agregados por sucursal." },
  { tool: "get_daily_snapshot", body: "Snapshot operativo por día." },
  { tool: "get_incidents", body: "Novedades / incidentes del tenant." },
  { tool: "list_employees", body: "Listar empleados de la empresa." },
  { tool: "list_branches", body: "Listar sucursales de la empresa." },
  { tool: "get_company_info", body: "Datos y tolerancias de la empresa." },
  { tool: "get_attendance_records", body: "Marcaciones CHECK_IN/CHECK_OUT detalladas." },
  { tool: "find_employee", body: "Buscar empleado por nombre, documento, código o email." },
  { tool: "get_present_now", body: "Empleados presentes ahora (última marca = entrada)." },
] as const;

const EXAMPLE_PROMPT = `Consulta las tardanzas y ausencias de esta semana en mi empresa.
Resume por sucursal y señala los empleados con más minutos de atraso.`;

function CodeBlock({
  title,
  code,
}: {
  title: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copiado");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
          {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
          Copiar
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">{code}</pre>
    </div>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <code className="block truncate text-xs">{value}</code>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast.success("Copiado");
          } catch {
            toast.error("No se pudo copiar");
          }
        }}
      >
        <Copy className="mr-1 h-3.5 w-3.5" />
        Copiar
      </Button>
    </div>
  );
}

export function McpSetupClient({ mcpUrl }: { mcpUrl: string }) {
  const tokenPlaceholder = "cuenti_xxxxxxxx";

  const claudeDesktop = useMemo(
    () => `{
  "mcpServers": {
    "cuenti-hr": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${tokenPlaceholder}"
      }
    }
  }
}`,
    [mcpUrl]
  );

  const cursorDev = useMemo(
    () => `{
  "mcpServers": {
    "cuenti-hr": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${mcpUrl}",
        "--header",
        "Authorization: Bearer ${tokenPlaceholder}"
      ]
    }
  }
}`,
    [mcpUrl]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            MCP de RRHH para Claude y ChatGPT
          </CardTitle>
          <CardDescription>
            Pensado para que tu equipo consulte asistencia y novedades desde{" "}
            <strong className="font-medium text-foreground">Claude</strong> o{" "}
            <strong className="font-medium text-foreground">ChatGPT</strong>{" "}
            contra el servidor remoto (Cloudflare). Solo hace falta un token API
            de la empresa; sin instalar binarios ni exponer la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Crea un token con alcance{" "}
              <Badge variant="secondary" className="align-middle">
                read
              </Badge>{" "}
              en{" "}
              <Link
                href="/settings/integrations/api-tokens"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Tokens API
              </Link>
              .
            </li>
            <li>Conéctalo en Claude o ChatGPT con la URL y el token (pasos abajo).</li>
            <li>Pide al asistente que use las herramientas de cuenti time.</li>
          </ol>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Key className="h-3.5 w-3.5" />
              Auth: Bearer cuenti_…
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Cloud className="h-3.5 w-3.5" />
              {mcpUrl}
            </span>
          </div>
          <CopyValue label="URL del MCP" value={mcpUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Claude (recomendado)</CardTitle>
          <CardDescription>
            Claude.ai (conectores) o Claude Desktop. Auth con header Bearer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Claude.ai (web)</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Settings → Connectors → Add custom connector.</li>
              <li>
                Pega la URL del MCP: <code className="text-xs">{mcpUrl}</code>
              </li>
              <li>
                Autoriza con tu token API (<code className="text-xs">Bearer cuenti_…</code>).
              </li>
              <li>Activa el conector en el chat y prueba el prompt de ejemplo.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Claude Desktop</p>
            <p>
              En <code className="text-xs">claude_desktop_config.json</code>, añade:
            </p>
            <CodeBlock title="Claude Desktop" code={claudeDesktop} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. ChatGPT — manual paso a paso</CardTitle>
          <CardDescription>
            Conector remoto (Developer mode) autenticado con OAuth. Requiere una
            URL HTTPS pública (Cloudflare) apuntando al MCP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Requisitos previos</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li>
                Cuenta ChatGPT con acceso a conectores (Plus / Team / Enterprise).
              </li>
              <li>
                Un token API con alcance{" "}
                <Badge variant="secondary" className="align-middle">
                  read
                </Badge>{" "}
                creado en{" "}
                <Link
                  href="/settings/integrations/api-tokens"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Tokens API
                </Link>
                .
              </li>
              <li>
                URL pública del MCP:{" "}
                <code className="text-xs">{mcpUrl}</code> (debe responder por HTTPS).
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Paso 1 · Activar Developer mode</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                En ChatGPT abre{" "}
                <strong className="font-medium text-foreground">Settings</strong> →{" "}
                <strong className="font-medium text-foreground">Apps &amp; Connectors</strong>.
              </li>
              <li>
                Entra en <strong className="font-medium text-foreground">Advanced</strong> y
                activa{" "}
                <strong className="font-medium text-foreground">Developer mode</strong>{" "}
                (necesario para conectores MCP personalizados).
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Paso 2 · Crear el conector</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Vuelve a <strong className="font-medium text-foreground">Apps &amp; Connectors</strong>{" "}
                y pulsa <strong className="font-medium text-foreground">Create</strong>.
              </li>
              <li>
                Name: <code className="text-xs">cuenti time RRHH</code>
              </li>
              <li>
                MCP Server URL: <code className="text-xs">{mcpUrl}</code>
              </li>
              <li>
                Authentication:{" "}
                <strong className="font-medium text-foreground">OAuth</strong>.
              </li>
              <li>
                Marca la casilla que acepta el riesgo del conector personalizado y
                pulsa <strong className="font-medium text-foreground">Create</strong>.
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Paso 3 · Autorizar (OAuth)</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                ChatGPT abrirá la página de consentimiento de cuenti time.
              </li>
              <li>
                Pega tu token <code className="text-xs">cuenti_…</code> y confirma la
                autorización.
              </li>
              <li>
                Al volver a ChatGPT el conector queda <em>Connected</em>.
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Paso 4 · Usarlo en el chat</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Abre un chat nuevo y activa el conector{" "}
                <code className="text-xs">cuenti time RRHH</code> (icono de
                herramientas / +).
              </li>
              <li>
                Escribe el prompt de ejemplo de más abajo y deja que ChatGPT invoque
                las herramientas.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            <p className="font-semibold">Solución de problemas</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <strong>No aparecen las herramientas:</strong> abre el conector y pulsa{" "}
                <strong>Refresh</strong>; ChatGPT sólo lista las tools tras refrescar.
              </li>
              <li>
                <strong>“Does not implement OAuth” / error de autorización:</strong> la
                URL debe ser pública por HTTPS. Si usas un túnel Cloudflare{" "}
                <code>trycloudflare</code>, la URL cambia al reiniciarlo: actualízala en
                el conector y en la variable de entorno del servidor.
              </li>
              <li>
                <strong>invalid_client:</strong> reintenta la conexión desde cero; se
                registrará de nuevo el cliente OAuth.
              </li>
            </ul>
          </div>

          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-950 dark:text-emerald-100">
            OAuth 2.1 (PKCE + Dynamic Client Registration) está habilitado en el
            endpoint MCP <strong>además</strong> del Bearer directo. Claude Desktop
            puede seguir usando solo <code className="text-xs">Authorization: Bearer cuenti_…</code>.
          </p>
          <a
            href="https://platform.openai.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
          >
            Docs OpenAI / conectores
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Herramientas disponibles</CardTitle>
          <CardDescription>
            14 consultas read-only. El asistente solo ve datos de la empresa del token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {MCP_TOOLS.map((item) => (
              <li
                key={item.tool}
                className="rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <code className="text-xs font-semibold">{item.tool}</code>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt de ejemplo</CardTitle>
          <CardDescription>
            Úsalo en Claude o ChatGPT con el conector MCP activo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock title="Prompt" code={EXAMPLE_PROMPT} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Otros clientes (opcional)</CardTitle>
          <CardDescription>
            Para desarrollo interno (Cursor, etc.). El cliente final típico es
            Claude o ChatGPT.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock title="Cursor (mcp-remote)" code={cursorDev} />
        </CardContent>
      </Card>
    </div>
  );
}
