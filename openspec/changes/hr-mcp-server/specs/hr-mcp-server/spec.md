# HR MCP Server Specification

## Purpose

Standalone MCP server exposing 11 read-only HR query tools for AI clients. Authenticated with existing API tokens, reusing the HR engine (`src/lib/hr/`) with strict multi-tenant isolation.

## Requirements

### Requirement: Bearer Token Authentication

The server MUST authenticate every tool invocation via `Authorization: Bearer cuenti_<secret>`. It SHALL reuse `validateApiToken()` from `src/lib/api-token-auth.ts`. Tools MUST require `read` scope minimum.

#### Scenario: Valid token grants access

- GIVEN a valid `cuenti_` token with `read` scope
- WHEN any tool is invoked with `Authorization: Bearer cuenti_<secret>`
- THEN the tool executes and returns data scoped to the token's `companyId`

#### Scenario: Missing or malformed token

- GIVEN no Authorization header, or a non-Bearer header, or a token without `cuenti_` prefix
- WHEN any tool is invoked
- THEN the server MUST return an MCP error with code `-32001` (unauthorized)

#### Scenario: Expired or inactive token

- GIVEN a token whose `active` field is `false` or that fails bcrypt comparison
- WHEN any tool is invoked
- THEN the server MUST return error `-32001` with message "Invalid or expired token"

#### Scenario: Token lacks read scope

- GIVEN a valid token with only `write` scope (no `read`)
- WHEN a read-level tool is invoked
- THEN the server MUST return error `-32003` (forbidden, insufficient scope)

### Requirement: HR Report Tools

The server MUST expose 7 HR tools mapping to `loadHrEvaluations`: `get_late_arrivals`, `get_absences`, `get_early_leaves`, `get_open_days`, `get_employee_summary`, `get_branch_summary`, `get_daily_snapshot`. Each tool SHALL accept `from`, `to` (ISO dates), and optional `branchId`, `employeeId`, `shiftId`.

#### Scenario: Query tardanzas for a branch

- GIVEN token for company with 3 employees in branch X, two with late arrivals this week
- WHEN `get_late_arrivals({ from: "2026-07-13", to: "2026-07-17", branchId: "X" })`
- THEN the response contains exactly 2 late-arrival records with `lateMinutes > 0`

#### Scenario: Employee summary aggregates KPIs

- GIVEN token for company with 50 employees over 30-day period
- WHEN `get_employee_summary({ from: "2026-06-01", to: "2026-06-30" })`
- THEN the response SHALL contain 50 employee summaries with `punctualityRate`, `absentDays`, `lateDays`

#### Scenario: Empty result for zero-tardanza period

- GIVEN token for a company with perfect punctuality in the range
- WHEN `get_late_arrivals({ from, to })`
- THEN the response SHALL return an empty data array with range metadata, no error

### Requirement: Entity Query Tools

The server MUST expose 4 Prisma-backed tools: `get_incidents`, `list_employees`, `list_branches`, `get_company_info`. All MUST filter by `companyId` from the token context.

#### Scenario: List active employees

- GIVEN token for company with 42 active and 3 inactive employees
- WHEN `list_employees({ status: "ACTIVE" })`
- THEN the response contains 42 employees; inactive employees MUST NOT appear

#### Scenario: Get company tolerances

- GIVEN token for company with `lateToleranceMinutes: 15`, `earlyLeaveToleranceMinutes: 5`, `subscriptionExpiresAt: 2026-12-01`
- WHEN `get_company_info({})`
- THEN the response includes `lateToleranceMinutes: 15`, `earlyLeaveToleranceMinutes: 5`, `subscriptionExpiresAt`

### Requirement: Multi-Tenant Data Isolation

Every tool SHALL scope queries to the token's `companyId`. Tools MUST NOT accept `companyId` as a parameter. Cross-tenant data leakage is PROHIBITED.

#### Scenario: Branch ID from another company returns 404

- GIVEN token for company A, requesting `branchId` belonging to company B
- WHEN any tool is invoked with that `branchId`
- THEN the server MUST return "Sucursal no encontrada" (404) — never data from company B

### Requirement: Performance

Each tool SHALL complete under 2 seconds for typical workloads: ≤90-day range, ≤500 employees.

#### Scenario: 90-day full-company query finishes fast

- GIVEN token for company with 300 employees across a 90-day window
- WHEN `get_daily_snapshot({ from, to })` is invoked
- THEN the server SHALL return the response in under 2000ms

### Requirement: Read-Only Constraint

The server MUST NOT expose any write operations. All 11 tools SHALL be read-only queries with no database mutations.

### Requirement: Error Resilience

The server MUST return structured MCP errors (code, message) for all failure modes. It SHALL NOT crash on missing data, empty branches, or invalid date ranges.

#### Scenario: Invalid date range

- GIVEN `from > to`
- WHEN any HR report tool is invoked
- THEN the server MUST return error code `-32602` (invalid params) with message "Rango de fechas inválido"

#### Scenario: Database unavailable

- GIVEN PostgreSQL is unreachable
- WHEN any tool is invoked
- THEN the server MUST return error code `-32603` (internal error) — it SHALL NOT crash
