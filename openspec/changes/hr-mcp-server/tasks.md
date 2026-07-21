# HR MCP Server — Task Plan

## Phase 1: Foundation & Auth

- [x] T-001 Extract raw token validation.
- [x] T-002 Add `packages/*` to pnpm workspace.
- [x] T-003 Create MCP package metadata and tsconfig.
- [x] T-004 Set up Vitest/test utilities.
- [x] T-005 Implement env token loader.
- [x] T-006 Implement raw token validator adapter.
- [x] T-007 Add read-scope helper.

## Phase 2: MCP Core

- [x] T-008 Error taxonomy.
- [x] T-009 Zod schemas for all tools and date/range constraints.
- [x] T-010 stdio MCP server and centralized registry.
- [x] T-011 Bind auth to every tool call.
- [x] T-012 Handler context with token company ID.
- [x] T-013 MCP integration tests for initialize/tools/list/tools/call.

## Phase 3: HR Tools

- [x] T-014 Implement 7 report tools using existing `src/lib/hr/` engine.
- [x] T-015 Implement 4 entity tools with strict company filters.
- [x] T-016 Cross-tenant resource validation.
- [x] T-017 Read-only static audit.
- [x] T-018 Invalid ranges and DB failure handling.
- [x] T-019 Functional tests for all tools.

## Phase 4: Verification & Docs

- [x] T-020 Performance benchmark for 90-day/500-employee scenario.
- [x] T-021 MCP Inspector verification instructions/results where executable.
- [x] T-022 Claude Desktop config example.
- [x] T-023 README and usage docs.
- [x] T-024 Root package scripts (`mcp:test`, `mcp:build`, `mcp:inspect`).
- [x] T-025 Final workspace/package typecheck and build.

## Phase 5: Remote HTTP + OAuth + ChatGPT (2026-07-20)

- [x] T-026 Streamable HTTP `:4101` + Next rewrites mismo origen.
- [x] T-027 OAuth 2.1 DCR/PKCE/consent adicional a Bearer `cuenti_`.
- [x] T-028 Persistencia OAuth en `.data/mcp-oauth-store.json` + heal de `client_id` ChatGPT.
- [x] T-029 Proxy Cloudflare / `MCP_PUBLIC_URL` / `MCP_ALLOWED_HOSTS`.
- [x] T-030 Schemas JSON compatibles ChatGPT (`toolJsonSchema`).
- [x] T-031 `getInternalAppOrigin` para Server Components detrás de túnel.
- [x] T-032 Tools detalle: `get_attendance_records`, `find_employee`, `get_present_now` (14 total).

## Review Workload Forecast

- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision: force-chained, feature-branch-chain
- Review budget: 800 lines per review unit
