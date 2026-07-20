# Design: permanent-session

## Technical Approach

Centralize token + cookie issuance in `src/lib/session-tokens.ts` and mirror the same rules in `src/middleware.ts` refresh path (Edge uses `jose` directly).

### Changes

1. **`signRefreshToken`**: remove `.setExpirationTime("7d")` so JWT has `iat` but no `exp`.
2. **`setAuthCookies`**: set `refresh-token` `maxAge` to `315360000` (10 years). Keep access at `900`.
3. **Middleware renew path**: when issuing `nextRefreshToken`, do not set expiration; cookie maxAge matches 10 years (`REFRESH_COOKIE`).
4. **`/api/auth/refresh`**: keep rejecting inactive/unverified users; clear cookies on rejection.
5. **Logout**: unchanged — clear both cookies (`maxAge: 0` / delete).

### Sequence (sliding window)

```text
Request → access missing/expired
       → verify refresh (no exp required; reject if inactive/unverified)
       → issue access (15m) + new refresh (no exp)
       → set cookies → continue
```

### Migration

Legacy refresh tokens with `exp: 7d` remain valid until their original expiry (S-008). The next successful renew issues a non-expiring token.

### Files

- `src/lib/session-tokens.ts`
- `src/middleware.ts` (cookie constants + renew signing)
- Possibly login/verify routes if they set cookies outside `setAuthCookies`

## Status note (2026-07-20)

Implementation **not applied yet** in codebase: both `session-tokens.ts` and `middleware.ts` still use `setExpirationTime("7d")` and 7-day cookie maxAge. Spec + planning artifacts exist; apply pending.
