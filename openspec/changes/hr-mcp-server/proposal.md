# HR MCP Server — Proposal

## Intent

Enable AI assistants (Claude Desktop, MCP Inspector, custom clients) to query HR data from cuenti-time via the Model Context Protocol (MCP). This provides a standardized, secure interface for AI clients to access attendance reports, employee data, and company information without exposing the full API or database.

## Scope

Standalone MCP server package (`@cuenti/hr-mcp-server`) exposing **14** read-only HR tools:

**7 HR Report Tools** (reuse existing `src/lib/hr/` engine):
- `get_late_arrivals` — tardanzas con minutos de atraso
- `get_absences` — días laborales sin entrada
- `get_early_leaves` — salidas anticipadas
- `get_open_days` — entradas sin salida
- `get_employee_summary` — KPIs por empleado
- `get_branch_summary` — KPIs por sucursal
- `get_daily_snapshot` — snapshot operativo por día (conteos: present/late/absent/open/earlyLeave)

**4 Entity Query Tools** (Prisma-backed):
- `get_incidents` — novedades/incidentes del tenant
- `list_employees` — empleados del tenant
- `list_branches` — sucursales del tenant
- `get_company_info` — información de la empresa

**3 Detail / Live Tools** (2026-07-20):
- `get_attendance_records` — marcaciones CHECK_IN/CHECK_OUT en crudo (hora, sucursal, geo, validación)
- `find_employee` — búsqueda por nombre, documento, código interno o email → resuelve `employeeId`
- `get_present_now` — presentes: última marcación del día = CHECK_IN (`date?`, `branchId?`)

**Constraints**:
- Read-only: every tool is a `SELECT` query, zero mutations
- Multi-tenant: each tool scoped to `companyId` from token context
- Auth dual: Bearer `cuenti_…` **o** OAuth access `mcp_at_…` (ChatGPT)
- Transport: Streamable HTTP remoto (`:4101` /mcp) + stdio solo dev
- Performance: <2s for 90-day × 500-employee queries

## Approach

**Package structure**: pnpm workspace package under `packages/hr-mcp-server/`, importing framework-agnostic code from root app (`src/lib/api-token-core`, `src/lib/tenant`, `src/lib/hr/*`, `src/lib/prisma`).

**Build**: TypeScript → Node ESM via `tsc` + `tsc-alias` (resolves path aliases for runtime).

**Auth flow**:
1. Token loaded from environment (`CUENTI_MCP_TOKEN` or `CUENTI_MCP_TOKEN_FILE`) at startup
2. Each tool call extracts `Authorization: Bearer cuenti_<secret>` from MCP request
3. Validates token via `validateApiToken()` (bcrypt comparison, checks `active` flag)
4. Extracts `companyId` from token context → passed to all queries
5. Token never accepted as tool argument; `companyId` never accepted as parameter

**Tool registry**: Centralized handlers (14 tools), each with Zod → JSON Schema (`io: "input"`, sin `$schema` 2020-12) for ChatGPT compatibility. Errors mapped to MCP error codes (`-32001` unauthorized, `-32003` forbidden, `-32602` invalid params, `-32603` internal).

**Testing**: Vitest (~29 tests) covering auth, schemas, OAuth heal/persist, server lifecycle, tool handlers, and multi-tenant isolation.

**Documentation**: README with usage, Claude Desktop config example, MCP Inspector instructions, security notes.

## Outcomes

- **AI assistant integration**: Claude Desktop, Cursor, and other MCP clients can query HR data securely
- **Standardized protocol**: MCP is emerging standard for AI-tool integration; positions cuenti-time for future AI ecosystem
- **Zero additional auth surface**: Reuses existing `ApiToken` model, no new credentials to manage
- **Strict isolation**: Multi-tenant guarantees inherited from existing API v1 patterns
- **Developer experience**: Local development via `pnpm mcp:dev`, testing via `pnpm mcp:test`, debugging via `pnpm mcp:inspect`

## Artifacts

- Spec: `openspec/changes/hr-mcp-server/specs/hr-mcp-server/spec.md`
- Tasks: `openspec/changes/hr-mcp-server/tasks.md`
- Implementation: `packages/hr-mcp-server/`
- Tests: `packages/hr-mcp-server/src/__tests__/` (22 tests, all passing)
- Benchmarks: `packages/hr-mcp-server/src/__benchmarks__/`
- Docs: `packages/hr-mcp-server/README.md`, `claude-desktop-config.example.json`
