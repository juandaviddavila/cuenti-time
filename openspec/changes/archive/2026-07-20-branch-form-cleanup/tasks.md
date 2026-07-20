# Tasks: branch-form-cleanup

## Phase 1: Type Cleanup

- [x] **T-001**: Remove `managerName` from `src/types/branch.ts` (Branch and CreateBranchRequest interfaces)
- [x] **T-002**: Remove `managerName` from `src/app/(dashboard)/branches/page.tsx` (server→client mapping)

## Phase 2: UI Form and Table

- [x] **T-003**: Remove `managerName` column from branch table in `src/app/(dashboard)/branches/branches-client.tsx`
- [x] **T-004**: Remove `managerName` and manual `address` from form in `branches-client.tsx` (form grid, schema, defaults, payload). Keep `handleLocationChange` auto-filling `address`.

## Phase 3: API Routes

- [x] **T-005**: Remove `managerName` from `createBranchSchema` in `src/app/api/branches/route.ts`
- [x] **T-006**: Remove `managerName` from `updateBranchSchema` in `src/app/api/branches/[id]/route.ts`
- [x] **T-007**: Remove `managerName: true` from Prisma select in `src/app/api/v1/branches/route.ts`

## Phase 4: Seed

- [x] **T-008**: Remove `managerName` assignments from `prisma/seed.ts`

## Phase 5: Verification

- [x] **T-009**: Run `pnpm build` and `pnpm lint`
- [x] **T-010**: Manual UI verification (document steps)
- [x] **T-011**: Manual API verification (document steps)
