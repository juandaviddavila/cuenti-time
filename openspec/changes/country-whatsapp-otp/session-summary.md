# Session summary — 2026-08-13/14

Trabajo hecho en cuenti-time y publicado en `https://app-time.cuenti.co`.

## Hecho

1. País en sucursales (`Branch.countryCode`, default CO) y búsqueda Places acotada al país.
2. Login por WhatsApp OTP (`User.phoneE164`, plantilla `sign_cuenti_otp`).
3. Fixes: Places 400 (`locationBias` > 50 km); Prisma “Unknown field” (generate + restart); WhatsApp no enviaba (Next sin `WHATSAPP_*`).
4. Deploy pack + scp + `server-update.sh`. Login prod con pestaña WhatsApp.
5. `cuenti-time-mcp` en error: era `cluster_mode`; ahora `fork` y health OK.

## Engram (topic_key)

- `branch-country-places`
- `whatsapp-login-otp`
- `places-autocomplete-country-filter`
- `deploy-app-time`
- `cuenti-time-mcp-pm2`

## Specs

- Change: `openspec/changes/country-whatsapp-otp/`
- Main: `openspec/specs/branch-management/spec.md` (R-012, R-013)
- Main: `openspec/specs/whatsapp-login-otp/spec.md`
