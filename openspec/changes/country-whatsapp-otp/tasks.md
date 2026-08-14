# Tasks — País + WhatsApp OTP

## Sucursales / Places

- [x] T-001 `Branch.countryCode` en Prisma + seed/backfill CO
- [x] T-002 Catálogo y combobox de país
- [x] T-003 Formulario/tabla sucursales + APIs dashboard/v1/MCP
- [x] T-004 Autocomplete con `includedRegionCodes` (sin locationBias de país)
- [x] T-005 `db:generate` + `db:push` + reiniciar Next

## Login WhatsApp

- [x] T-006 `User.phoneE164` unique + índice
- [x] T-007 Catálogo E.164 + `PhoneInput`
- [x] T-008 Cliente Meta `src/lib/whatsapp.ts` + `issueLoginOtp`
- [x] T-009 APIs login / verify / resend + users + register
- [x] T-010 UI login (3 pestañas), usuarios y registro
- [x] T-011 503 visible si Meta/env fallan (no 200 falso)

## Ops

- [x] T-012 Pack + scp + `server-update.sh` a app-time.cuenti.co
- [x] T-013 Fusionar `WHATSAPP_*` en `.env` del server
- [x] T-014 `cuenti-time-mcp` en `exec_mode: fork` + health `:4101/health`
