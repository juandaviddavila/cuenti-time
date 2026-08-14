# WhatsApp Login OTP — Spec

## Purpose

Allow company users to sign in with a 6-digit OTP delivered by WhatsApp Cloud API, using the same WABA as Sign Cuenti.

## Requirements

| ID | Requirement | Strength |
|----|------------|----------|
| R-001 | `User.phoneE164` is optional, unique, indexed | MUST |
| R-002 | Phone UI uses dial combobox + national number; persist E.164 (`+` + digits) | MUST |
| R-003 | Login offers Password, Email code, and WhatsApp | MUST |
| R-004 | `POST /api/auth/login` with `method: "whatsapp"` looks up by normalized `phoneE164` | MUST |
| R-005 | Unknown or inactive phone returns a generic success message and MUST NOT send WhatsApp (anti-enumeration) | MUST |
| R-006 | Known active user: hash OTP, send AUTHENTICATION template `sign_cuenti_otp` | MUST |
| R-007 | If WhatsApp is disabled or Meta fails, API MUST return 503 with a visible error (no fake 200) | MUST |
| R-008 | Verify/resend accept `phoneE164` for the WhatsApp channel | MUST |
| R-009 | Never log OTP, tokens, or WhatsApp access token | MUST |
| R-010 | After adding `phoneE164` to Prisma, run `pnpm db:generate` + `db:push` and restart Next | MUST |
| R-011 | Production `.env` on the server holds `WHATSAPP_*`; they are not packed in `deploy.tar.gz` | MUST |

## Scenarios

### S-001: Send OTP to a registered phone

- GIVEN a user with `phoneE164` saved and `WHATSAPP_ENABLED=true` plus a valid token
- WHEN they submit the WhatsApp login tab
- THEN Meta receives a template message and the API returns 200 with a WhatsApp-sent message

### S-002: Unknown phone does not reveal existence

- GIVEN a phone that is not in `User.phoneE164`
- WHEN they submit WhatsApp login
- THEN the response is 200 with a generic “if registered, we sent a code” message
- AND Meta is not called

### S-003: Meta or env failure is visible

- GIVEN WhatsApp is not configured or Graph returns an error
- WHEN they submit WhatsApp login for a known phone
- THEN the API returns 503
- AND the UI shows the error (including Meta’s message when present)

### S-004: Prisma client must know `phoneE164`

- GIVEN the schema has `phoneE164` but Next was not restarted after `prisma generate`
- WHEN `/users` or login queries `select: { phoneE164: true }`
- THEN Prisma throws “Unknown field” until generate + Next restart
