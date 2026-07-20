# Design: Branch Form Cleanup

## Technical Approach

Remove `managerName` from all UI surfaces (form, table, mobile cards), TypeScript types, Zod validation schemas, API response payloads, and seed data. Remove the manual `address` text input from the form while preserving `address` in schemas/types so `BranchLocationPicker` can continue auto-populating it via `form.setValue("address", ...)`. DB columns are untouched — no migration, no Prisma schema change.

The approach is a **pure surface removal**: delete references across 7 files in a single coordinated pass. No new abstractions, no new files.

## Architecture Decisions

### Decision: Keep `address` in Zod schemas and form state

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Remove `address` entirely | Simpler, but breaks `BranchLocationPicker` auto-fill and geofence address storage | ❌ |
| Keep `address` in schemas/types, remove only the manual `<Input>` | `BranchLocationPicker` still writes to form state; payload still carries address | ✅ |

**Rationale**: `address` is programmatically set by `handleLocationChange` (line 238 of `branches-client.tsx`). Removing it from the schema would cause `form.setValue("address", ...)` to silently fail or throw. The field must remain in the Zod schema and form defaults.

### Decision: Zod schemas use permissive parsing (no `.strict()`)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Add `.strict()` to reject unknown fields | Cleaner validation, but breaks forward-compat with old clients sending `managerName` | ❌ |
| Keep default Zod behavior (strip unknown) | Old clients sending `managerName` get 200 OK, field silently dropped | ✅ |

**Rationale**: Spec S-010 requires the API to accept `managerName` without failing. Zod's default `.safeParse()` strips fields not in the schema — exactly the behavior we want.

### Decision: Remove `managerName` from `BranchRow` interface and `Branch` type

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Keep `managerName` as optional in types | Defensive, but creates dead code and confusion | ❌ |
| Remove from all TypeScript interfaces | Clean break; Prisma still returns it from DB but it's unused | ✅ |

**Rationale**: The Prisma `branch` model still has the column, so `prisma.branch.findMany()` will return `managerName` in the raw result. However, the server component (`page.tsx`) explicitly maps fields to `BranchRow` — we simply stop mapping `managerName`. The TypeScript type no longer exposes it.

## Data Flow

### Before (current)

```
Form Input ──→ managerName field ──→ Zod schema ──→ API payload ──→ Prisma create/update ──→ DB
Table    ←── managerName column ←── API response ←── Prisma findMany ←── DB
```

### After (target)

```
Form Input ──→ (no managerName field) ──→ Zod schema (no managerName) ──→ API payload ──→ Prisma ──→ DB
                                                                                              (column preserved, never written by new code)
Table    ←── (no managerName mapped) ←── API response (no managerName in v1) ←── Prisma ←── DB
                                                                                              (existing values remain, never displayed)
```

Address flow (unchanged):

```
BranchLocationPicker ──→ handleLocationChange ──→ form.setValue("address", ...) ──→ payload ──→ Prisma ──→ DB
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(dashboard)/branches/branches-client.tsx` | Modify | Remove `managerName` from `BranchRow` interface, `branchSchema`, form defaults, `openCreate`/`openEdit` resets, `onSubmit` payload, field array (`["city","phone"]`), and table "Encargado" column + cell |
| `src/app/(dashboard)/branches/page.tsx` | Modify | Remove `managerName: b.managerName` from the server→client branch mapping |
| `src/types/branch.ts` | Modify | Remove `managerName?: string` from `Branch` and `CreateBranchRequest` interfaces |
| `src/app/api/branches/route.ts` | Modify | Remove `managerName` line from `createBranchSchema` |
| `src/app/api/branches/[id]/route.ts` | Modify | Remove `managerName` line from `updateBranchSchema` |
| `src/app/api/v1/branches/route.ts` | Modify | Remove `managerName: true` from Prisma `select` clause |
| `prisma/seed.ts` | Modify | Remove `managerName` assignments from 3 branch upserts (lines 76, 94, 112) |

## Interfaces / Contracts

### BranchRow (branches-client.tsx) — after

```typescript
interface BranchRow {
  id: string; companyId: string; companyName: string; name: string; code: string;
  address?: string | null; city?: string | null; phone?: string | null;
  status: Status; employeeCount: number;
  duplicateWindowMinutes: number;
  latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; radiusMeters: number;
  createdAt: string;
}
```

### Form field array — after

```typescript
{(["city", "phone"] as const).map(f => (
  // ...renders only city and phone inputs
))}
```

### v1 API select — after

```typescript
select: {
  id: true, name: true, code: true, address: true, city: true,
  phone: true, status: true, duplicateWindowMinutes: true,
},
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | No TypeScript errors after removals | `pnpm build` must pass clean |
| Manual UI | Form renders without "Encargado" and "Dirección" inputs | Open create/edit dialog, verify fields |
| Manual UI | Table has no "Encargado" column | Check desktop table and mobile cards |
| Manual UI | Location picker still fills address | Select a place, verify address in network payload |
| Manual API | POST/PUT without `managerName` succeeds | Use browser devtools or curl |
| Manual API | POST with `managerName` accepted, field ignored | Send extra field, verify 201/200 |
| Manual API | v1 GET response has no `managerName` | `curl -H "Authorization: Bearer ..."` |
| Seed | `pnpm db:seed` runs without errors | Run seed, check no failures |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

**No migration required.** DB columns (`managerName`, `address`) are preserved. Existing data remains intact.

**Rollback**: Revert the commit. All changes are UI/schema removals — reverting restores the fields. No data was destroyed.

## Open Questions

None.
