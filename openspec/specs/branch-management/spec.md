# Branch Management — Form Fields Specification

## Purpose

Defines the branch form and table field set after removing the redundant `managerName` field from UI/API surfaces and the manual `address` text input from the form. The `address` field remains in schemas/types and is still populated programmatically by `BranchLocationPicker`. DB columns are preserved (no migration).

## Requirements

| ID | Requirement | Strength |
|----|------------|----------|
| R-001 | Branch create/edit form MUST NOT display a `managerName` ("Encargado") text input | MUST |
| R-002 | Branch table (desktop and mobile cards) MUST NOT display `managerName` column or value | MUST |
| R-003 | Branch create/edit form MUST NOT display a manual `address` ("Dirección") text input | MUST |
| R-004 | `BranchLocationPicker` MUST still auto-fill `address` into form state and submit payload | MUST |
| R-005 | Dashboard API routes MUST NOT accept `managerName` in Zod validation schemas | MUST |
| R-006 | Public v1 API branch response MUST NOT include `managerName` property | MUST |
| R-007 | Branch create/edit operations MUST succeed without `managerName` in request body | MUST |
| R-008 | `Branch.managerName` DB column SHALL be preserved (no migration); existing values remain stored | SHALL |
| R-009 | `address` SHALL remain in Zod schemas, TypeScript types, API response schemas, and form state | SHALL |
| R-010 | Seed data MUST NOT set `managerName` on branch records | MUST |
| R-011 | Field `duplicateWindowMinutes` MUST show a FormDescription explaining anti-double-tap behavior | MUST |

## Scenarios

### S-001: Form excludes managerName and manual address

- GIVEN a user opens the "Nueva sucursal" or "Editar sucursal" dialog
- WHEN the form renders
- THEN no "Encargado" input and no "Dirección" manual text input are visible
- AND all remaining fields (name, code, city, phone, etc.) render normally

### S-002: Table excludes managerName column

- GIVEN the branch list is displayed (desktop table or mobile cards)
- WHEN the UI renders
- THEN no "Encargado" column header, cell value, or mobile card label appears

### S-003: Location picker auto-fills address

- GIVEN a user selects a location via `BranchLocationPicker`
- WHEN the location is confirmed
- THEN `form.setValue("address", ...)` is called with the Google Places formatted address
- AND the address is included in the submit payload

### S-004: Create branch succeeds without managerName

- GIVEN a POST to `/api/branches` omits `managerName` from the body
- WHEN the API processes the request
- THEN the branch is created and returns 201
- AND the response does not depend on `managerName`

### S-005: Update branch succeeds without managerName

- GIVEN a PUT to `/api/branches/[id]` omits `managerName` from the body
- WHEN the API processes the request
- THEN the branch is updated and returns 200

### S-006: v1 API excludes managerName

- GIVEN an authenticated v1 API client calls `GET /api/v1/branches`
- WHEN the response is returned
- THEN no `managerName` property exists in any branch object

### S-007: Seed runs without managerName

- GIVEN the database is seeded via `pnpm db:seed`
- WHEN the seed completes
- THEN all branch records are created/upserted without `managerName`
- AND no errors occur

### S-008: Existing DB data preserved (edge case)

- GIVEN branches exist with `managerName` values in the database
- WHEN the branch page loads and the API returns branch data
- THEN no errors occur; the DB column remains untouched
- AND the UI never renders the stored value

### S-009: Build passes after removals (edge case)

- GIVEN `managerName` is removed from all TypeScript types, Zod schemas, and API validation
- WHEN `pnpm build` runs
- THEN the build completes without type errors related to this change
- AND no unused imports or unreferenced properties remain in the changed files

### S-010: Forward-compatible API accepts managerName (edge case)

- GIVEN a client sends `managerName` in the request body to the create or update API
- WHEN the API processes the request
- THEN the field is accepted by Zod (no strict mode rejection)
- BUT the field is NOT persisted (Prisma spread drops it since validation doesn't forward it)

### S-011: Anti-double-tap field is explained

- GIVEN a user opens the branch create/edit form
- WHEN the `duplicateWindowMinutes` field is visible
- THEN a FormDescription explains it is the minimum time between same-employee marks to avoid accidental duplicates
