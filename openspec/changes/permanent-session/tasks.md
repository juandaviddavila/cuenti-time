# Tasks: permanent-session

## Phase 1: Token + cookie issuance

- [ ] **T-001**: Remove refresh JWT `exp` in `signRefreshToken` (`src/lib/session-tokens.ts`)
- [ ] **T-002**: Set refresh cookie `maxAge` to 10 years in `setAuthCookies`
- [ ] **T-003**: Align middleware renew signing: no refresh `exp`; refresh cookie maxAge 10 years
- [ ] **T-004**: Audit login/verify/register paths — all refresh cookies go through shared helper or same constants

## Phase 2: Guards (unchanged behavior, verify)

- [ ] **T-005**: Confirm `/api/auth/refresh` rejects inactive users and clears cookies
- [ ] **T-006**: Confirm `/api/auth/refresh` rejects unverified email and clears cookies
- [ ] **T-007**: Confirm logout clears both cookies

## Phase 3: Docs / AGENTS

- [ ] **T-008**: Update `AGENTS.md` refresh TTL note from 7d → permanent (no exp / 10y cookie)
- [ ] **T-009**: Update `openspec/config.yaml` auth_pattern line accordingly

## Phase 4: Verify

- [ ] **T-010**: Manual smoke: login → wait/force access expiry → refresh works
- [ ] **T-011**: Decode new refresh JWT and confirm no `exp` claim
