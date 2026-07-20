# Proposal: permanent-session

## Problem

User sessions expire after 7 days because refresh JWTs include `exp: 7d` and the `refresh-token` cookie `maxAge` is 7 days. Users who return after that window must log in again, even with normal daily use interrupted by weekends/travel.

## Goal

Make the authenticated session effectively permanent: refresh tokens MUST NOT expire via JWT `exp`, and the browser cookie MUST live for 10 years. Sessions end only via explicit logout, user deactivation, or unverified email. Access tokens remain short-lived (15 minutes) with sliding-window renewal.

## Scope

**In**
- Refresh JWT signing (remove `exp`)
- `refresh-token` cookie `maxAge` → 10 years (315,360,000 s)
- Middleware + `/api/auth/refresh` sliding renewal behavior (preserve)
- Login/logout cookie flags unchanged except refresh maxAge

**Out**
- Changing access token TTL (stays 15m)
- Server-side session store / Redis
- Remember-me UI toggle (always-on permanence)

## Risks / Rollback

- Stolen refresh cookies remain valid indefinitely until logout/deactivation → mitigated by httpOnly + secure + logout/status checks.
- Rollback: restore `setExpirationTime("7d")` and cookie `maxAge: 60*60*24*7`.

## Success criteria

- Spec R-001..R-007 satisfied
- Existing active users keep working; new refresh tokens have no `exp`
- Explicit logout still clears both cookies
