# HR MCP Server — Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Client (Claude, etc.)                  │
└────────────────────┬────────────────────────────────────────┘
                     │ stdio (MCP protocol)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              packages/hr-mcp-server/                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │  index.ts — stdio entry point                      │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │  server.ts — McpServer factory, tool registry      │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │  auth.ts — authenticateMcpToken()                  │    │
│  │    - Extracts Bearer token from MCP request        │    │
│  │    - Calls validateApiToken() from root app        │    │
│  │    - Returns { companyId, scopes }                 │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │  tools.ts — 11 tool handlers                       │    │
│  │    - Zod schema validation                         │    │
│  │    - companyId from auth context                   │    │
│  │    - Calls HR engine or Prisma                     │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │  env.ts — loadTokenFromEnv()                       │    │
│  │    - CUENTI_MCP_TOKEN or CUENTI_MCP_TOKEN_FILE     │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────────┘
                     │ imports framework-agnostic code
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Root App (src/lib/)                       │
│  - api-token-core.ts — validateApiToken()                   │
│  - tenant.ts — getCompanyFilter()                           │
│  - hr/day-evaluation.ts — evaluatePeriod()                  │
│  - hr/load-hr-evaluations.ts — loadHrEvaluations()          │
│  - prisma.ts — Prisma client singleton                      │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Standalone Package vs. Inline Route

**Decision**: Separate `packages/hr-mcp-server/` package, not an API route.

**Rationale**:
- MCP servers run as long-lived processes with stdio transport, different from HTTP request/response
- Isolates MCP SDK dependency (`@modelcontextprotocol/sdk`) from main app
- Enables independent build/test/deploy cycle
- Can be distributed as standalone binary if needed

**Tradeoff**: Requires path alias resolution (`tsc-alias`) to import from root app.

### 2. Token Loading: Environment vs. Tool Argument

**Decision**: Token loaded from environment at startup, never from tool arguments.

**Rationale**:
- Security: token never appears in MCP message logs or client memory
- Simplicity: one token per server instance, matches `ApiToken` model (one token = one company)
- MCP best practice: credentials in environment, not tool parameters

**Tradeoff**: Cannot switch companies mid-session; requires server restart.

### 3. Auth Validation: Per-Tool Call vs. Startup

**Decision**: Validate token on every tool call, not just at startup.

**Rationale**:
- Tokens can be deactivated mid-session (`active: false`)
- Matches API v1 behavior (validate on every request)
- Prevents stale access if token is revoked

**Tradeoff**: Slight performance overhead (bcrypt comparison per call). Acceptable for read-only queries.

### 4. Multi-Tenant Isolation: Token Context vs. Parameter

**Decision**: `companyId` derived from token context, never accepted as tool parameter.

**Rationale**:
- Prevents cross-tenant data leakage by design
- Matches API v1 pattern (companyId from token, never from body)
- Simplifies tool schemas (no `companyId` field to validate)

**Tradeoff**: One server instance = one company. Multi-company clients need multiple server instances.

### 5. HR Engine Reuse vs. Direct Prisma

**Decision**: Reuse existing `src/lib/hr/` engine for report tools, direct Prisma for entity tools.

**Rationale**:
- HR engine already implements complex logic (late arrivals, absences, KPIs)
- Avoids duplicating business rules
- Entity tools (list_employees, list_branches) are simple CRUD, no need for HR engine

**Tradeoff**: HR engine is O(employees × days), can be slow for large ranges. Mitigated by performance requirement (<2s for 90d × 500 emp).

## Component Breakdown

### `src/index.ts` — Entry Point

- Creates stdio transport (`process.stdin` / `process.stdout`)
- Loads token from environment via `loadTokenFromEnv()`
- Creates MCP server via `createMcpServer(token)`
- Logs diagnostics to stderr (keeps stdout clean for MCP)

### `src/server.ts` — MCP Server Factory

- `createMcpServer(envToken: string)` returns configured `McpServer`
- Registers 11 tools with Zod schemas
- Binds `authenticateMcpToken` to every tool call
- Passes `envToken` to auth handler for comparison

### `src/auth.ts` — Token Validation

- `authenticateMcpToken(request, envToken)`:
  1. Extracts `Authorization: Bearer cuenti_<secret>` from request
  2. Validates format (must start with `cuenti_`)
  3. Calls `validateApiToken(rawToken)` from root app
  4. Checks `scopes.includes("read")` (or `"write"`, which implies read)
  5. Returns `{ companyId, scopes }` or throws MCP error

**Error mapping**:
- Missing/malformed header → `-32001` (unauthorized)
- Invalid/expired token → `-32001` (unauthorized)
- Insufficient scope → `-32003` (forbidden)

### `src/tools.ts` — Tool Registry

- 11 tool handlers, each with:
  - Zod schema for input validation
  - Auth context (`companyId`) from `authenticateMcpToken`
  - Business logic (HR engine or Prisma query)
  - Structured response (data + metadata)

**HR Report Tools** (7):
- Accept `from`, `to` (ISO dates), optional `branchId`, `employeeId`, `shiftId`
- Validate date range (`from <= to`)
- Call `loadHrEvaluations({ companyId, from, to, filters })`
- Return evaluated data (late arrivals, absences, etc.)

**Entity Tools** (4):
- `get_incidents`: Prisma `incident.findMany({ where: { companyId } })`
- `list_employees`: Prisma `employee.findMany({ where: { companyId, status: "ACTIVE" } })`
- `list_branches`: Prisma `branch.findMany({ where: { companyId } })`
- `get_company_info`: Prisma `company.findUnique({ where: { id: companyId } })`

**Cross-tenant validation**: When tool accepts `branchId`, `employeeId`, or `shiftId`, validate that resource belongs to `companyId` before use. Return 404 if not found.

### `src/schemas.ts` — Zod Schemas

- Date range validation: `from` and `to` must be valid ISO dates, `from <= to`
- Optional filters: `branchId`, `employeeId`, `shiftId` (all strings)
- Status enum: `"ACTIVE" | "INACTIVE"` for `list_employees`

### `src/errors.ts` — Error Taxonomy

- `McpError` class with `code` and `message`
- Standard codes:
  - `-32001`: Unauthorized (missing/invalid token)
  - `-32003`: Forbidden (insufficient scope)
  - `-32602`: Invalid params (bad date range, malformed input)
  - `-32603`: Internal error (database unavailable, unexpected error)

### `src/env.ts` — Token Loader

- `loadTokenFromEnv()`:
  1. Check `CUENTI_MCP_TOKEN` environment variable
  2. If not set, check `CUENTI_MCP_TOKEN_FILE` (read file contents)
  3. Validate format (must start with `cuenti_`)
  4. Return token or throw error

**Security**: Token never logged; only masked prefix printed to stderr.

## Multi-Tenant Isolation Strategy

**Layer 1: Auth context**
- `companyId` extracted from token, never from parameters
- All queries scoped to `where: { companyId }`

**Layer 2: Resource validation**
- When tool accepts `branchId`, `employeeId`, or `shiftId`:
  - Fetch resource with `where: { id, companyId }`
  - Return 404 if not found (never data from another company)

**Layer 3: HR engine**
- `loadHrEvaluations` receives `companyId` in context
- All internal queries scoped to company

## Performance Considerations

**HR engine**: `evaluatePeriod` is O(employees × days). For 90d × 500 emp = 45,000 evaluations.

**Optimization**: 
- Single Prisma query fetches all attendance records for the range
- In-memory evaluation (no N+1 queries)
- Benchmarks show <2s on typical hardware

**Future optimization** (out of scope):
- Cache evaluation results for repeated queries
- Paginate large result sets
- Background job for very large ranges (>180 days)

## Testing Strategy

**Unit tests** (no database):
- Token validation (valid, invalid, expired, insufficient scope)
- Zod schema validation (date ranges, required fields)
- Error mapping (MCP error codes)

**Integration tests** (require `DATABASE_URL`):
- Tool handlers with real Prisma queries
- Multi-tenant isolation (branch from another company → 404)
- HR engine end-to-end (late arrivals, absences, KPIs)

**Benchmarks**:
- 90-day × 500-employee scenario
- Measure `get_daily_snapshot` latency (target <2s)

## Security Considerations

1. **Token storage**: Environment variable or file, never in code or logs
2. **Token transmission**: Bearer header in MCP request, encrypted via stdio
3. **Token validation**: bcrypt comparison (12 rounds), checks `active` flag
4. **Scope enforcement**: `read` scope minimum; `write` implies `read`
5. **Multi-tenant**: `companyId` from token, never from parameters
6. **Resource validation**: Cross-tenant resource access returns 404
7. **Logging**: Diagnostics to stderr, no raw tokens logged
8. **Read-only**: Zero mutations, all tools are `SELECT` queries

## Deployment

**Local development**:
```bash
pnpm mcp:dev  # runs via tsx (no build)
```

**Production**:
```bash
pnpm mcp:build  # tsc + tsc-alias
node packages/hr-mcp-server/dist/packages/hr-mcp-server/src/index.js
```

**Claude Desktop**:
- Add to `claude_desktop_config.json` with absolute path to built server
- Set `CUENTI_MCP_TOKEN` and `DATABASE_URL` in `env`

**Docker** (future):
- Build image with `node:20-alpine`
- Copy built server + `node_modules`
- Entrypoint: `node dist/packages/hr-mcp-server/src/index.js`

## Out of Scope

- Write operations (attendance marking, employee updates)
- Multi-company support in one server instance
- Token rotation or refresh (static token per instance)
- Webhook subscriptions or real-time updates
- Caching layer (future optimization)
- Pagination for large result sets (future enhancement)
