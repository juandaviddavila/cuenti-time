# Session Persistence Specification

## Purpose

Refresh tokens MUST remain valid indefinitely — no JWT expiration claim. Browser cookie `maxAge` is extended to 10 years. Sessions end only via explicit logout, user deactivation, or unverified email. Access tokens stay at 15 minutes with sliding-window renewal.

## Requirements

| ID | Requirement | Strength |
|----|------------|----------|
| R-001 | Refresh token JWTs MUST NOT include an expiration (`exp`) claim | MUST |
| R-002 | The `refresh-token` cookie `maxAge` MUST be 10 years (315,360,000 s) | MUST |
| R-003 | Access token signing MUST retain `setExpirationTime("15m")` and cookie `maxAge: 900` | MUST |
| R-004 | Sliding-window renewal MUST continue via middleware and `POST /api/auth/refresh` | MUST |
| R-005 | `POST /api/auth/logout` MUST clear both cookies (`maxAge: 0`) | MUST |
| R-006 | Login MUST preserve cookie names, `httpOnly`, `secure`, and `sameSite` flags | MUST |
| R-007 | `/api/auth/refresh` MUST reject when user `status !== "ACTIVE"` or `emailVerifiedAt` is null | MUST |

## Scenarios

### S-001: Token valid beyond 7 days

- GIVEN a user logged in 8+ days ago with daily activity
- WHEN middleware or `/api/auth/refresh` validates the refresh token
- THEN the token is accepted and a new access token is issued

### S-002: Session survives browser restart

- GIVEN an authenticated user closes the browser for days
- WHEN they reopen and navigate to the dashboard
- THEN the `refresh-token` cookie is present, middleware renews access, and session resumes

### S-003: Explicit logout clears cookies

- GIVEN an authenticated user
- WHEN `POST /api/auth/logout` is called
- THEN both `access-token` and `refresh-token` cookies are cleared (`maxAge: 0`)
- AND protected routes redirect to `/login`

### S-004: Access token expires at 15 min

- GIVEN an access token older than 15 minutes
- WHEN the user requests a protected route
- THEN middleware detects expiry, validates the refresh token, and issues new tokens

### S-005: Deactivated user blocked

- GIVEN a user with a valid refresh token
- WHEN an admin sets `status` to INACTIVE
- THEN `/api/auth/refresh` returns 401 and clears cookies

### S-006: Unverified email blocked

- GIVEN a user with `emailVerifiedAt: null` and a valid refresh token
- WHEN `/api/auth/refresh` is called
- THEN the refresh is rejected with 401

### S-007: Login cookie structure unchanged (edge case)

- GIVEN `POST /api/auth/login` succeeds
- WHEN cookies are set
- THEN `access-token` uses `maxAge: 900`; `refresh-token` uses `maxAge: 315360000`
- AND both retain `httpOnly: true`, `sameSite: "lax"`, path `/`

### S-008: Legacy token with exp claim still accepted (migration)

- GIVEN a refresh token with a 7-day `exp` issued before this change
- WHEN presented within its original 7-day window
- THEN it validates normally and the NEW token issued has no expiration
