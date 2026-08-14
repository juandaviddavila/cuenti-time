# WhatsApp Login OTP

## Purpose

Company users can sign in with a 6-digit OTP sent over WhatsApp Cloud API (WABA Cuenti Notificaciones, template `sign_cuenti_otp`). Phone is stored as `User.phoneE164`.

## Requirements

| ID | Requirement | Strength |
|----|------------|----------|
| R-001 | `User.phoneE164` optional, unique, indexed | MUST |
| R-002 | Persist phones as E.164; UI is dial + national number | MUST |
| R-003 | Login methods: password, email code, WhatsApp | MUST |
| R-004 | WhatsApp login looks up only by normalized `phoneE164` from the session request | MUST |
| R-005 | Unknown/inactive phone: generic 200, no Meta call | MUST |
| R-006 | Known user: store hashed OTP, send AUTHENTICATION template | MUST |
| R-007 | Disabled WhatsApp or Meta error: HTTP 503, visible message | MUST |
| R-008 | Verify and resend accept `phoneE164` | MUST |
| R-009 | Never log OTP, tokens, or the Cloud API access token | MUST |
| R-010 | After Prisma field add: `db:generate` + `db:push` + restart Next | MUST |
| R-011 | Server `.env` holds `WHATSAPP_*`; not included in `deploy.tar.gz` | MUST |

## Env (server)

```
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=…
WHATSAPP_PHONE_NUMBER_ID=1027844720412230
WHATSAPP_BUSINESS_ACCOUNT_ID=947104564514869
WHATSAPP_TEMPLATE_NAME=sign_cuenti_otp
WHATSAPP_TEMPLATE_LANGUAGE=es
```

## Related files

- `src/lib/whatsapp.ts`, `src/lib/login-otp.ts`, `src/lib/phone/`
- `src/app/api/auth/login/route.ts`, `verify/route.ts`, `resend/route.ts`
- `src/app/(auth)/login/page.tsx`
- `ecosystem.config.cjs` — `cuenti-time-mcp` MUST use `exec_mode: fork`
