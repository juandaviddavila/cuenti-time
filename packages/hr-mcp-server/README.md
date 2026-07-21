# Cuenti HR MCP Server

Servidor MCP de RRHH para cuenti time. **Remoto** (Streamable HTTP detrás de Cloudflare) + stdio local opcional para desarrollo.

## Cliente (empresa)

Pensado para **Claude** y **ChatGPT** (conectores remotos vía Cloudflare).

| Dato | Valor |
|---|---|
| URL MCP | `NEXT_PUBLIC_MCP_URL` (ej. `https://mcp-time.cuenti.co/mcp`) |
| Auth | Token API `Authorization: Bearer cuenti_…` (scope `read`) |

**No** se configura `DATABASE_URL` ni rutas locales en el cliente.

### Claude (recomendado)

- **Claude.ai**: Settings → Connectors → Add custom connector → URL + Bearer.
- **Claude Desktop**: `type: "http"` + `url` + header `Authorization`.

### ChatGPT

Settings → Apps & Connectors → Developer mode → Create connector → MCP Server URL.
Authentication: **OAuth**. En el consentimiento pegas tu token API `cuenti_…`.

El servidor implementa OAuth 2.1 **además** del Bearer directo:
- Discovery: `/.well-known/oauth-authorization-server` + `oauth-protected-resource`
- DCR: `POST /register`
- PKCE S256: `/authorize` + `/token`
- Access tokens `mcp_at_…` (Bearer en `/mcp`)

Claude Desktop puede seguir con solo `Authorization: Bearer cuenti_…` (sin OAuth).

### Cursor / otros (dev)

`npx mcp-remote <url> --header "Authorization: Bearer …"` (más estable detrás de Cloudflare).

## Servidor (infra)

```bash
# Env del proceso (solo en el host / contenedor)
DATABASE_URL=postgresql://…
MCP_HTTP_PORT=4101
MCP_HTTP_HOST=0.0.0.0
MCP_ALLOWED_HOSTS=mcp-time.cuenti.co,localhost
MCP_JSON_RESPONSE=true

pnpm mcp:build
pnpm mcp:start:http
# Dev: pnpm mcp:dev:http
```

- `POST /mcp` — Streamable HTTP (JSON por defecto)
- `GET /health` — healthcheck
- Auth por petición: `Authorization: Bearer cuenti_…` → `companyId` del token

Cloudflare / nginx apunta el hostname público a este origen (`:4101`).

## Tools (14, read-only)

| Tool | Description |
|------|-------------|
| `get_late_arrivals` | Tardanzas del período |
| `get_absences` | Días sin entrada |
| `get_early_leaves` | Salidas anticipadas |
| `get_open_days` | Entradas sin salida |
| `get_employee_summary` | KPIs por empleado |
| `get_branch_summary` | KPIs por sucursal |
| `get_daily_snapshot` | Snapshot por día |
| `get_attendance_records` | Marcaciones CHECK_IN/CHECK_OUT en detalle |
| `find_employee` | Buscar empleado por nombre, documento, código o email |
| `get_present_now` | Empleados cuya última marca del día es CHECK_IN |
| `get_incidents` | Novedades |
| `list_employees` | Empleados |
| `list_branches` | Sucursales |
| `get_company_info` | Empresa / tolerancias |

## Stdio local (solo dev)

```bash
CUENTI_MCP_TOKEN=cuenti_xxxxxxxx pnpm --filter @cuenti/hr-mcp-server dev
```

## Tests

```bash
pnpm mcp:test
```

## Architecture

- `src/http.ts` — entry remoto (Cloudflare)
- `src/index.ts` — entry stdio (dev)
- `src/server.ts` — factory MCP + tools
- `src/auth.ts` — valida token `cuenti_`
- `src/tools.ts` — 11 handlers (motor HR / Prisma en servidor)

Multi-tenant: `companyId` solo del token; nunca como argumento de tool.
