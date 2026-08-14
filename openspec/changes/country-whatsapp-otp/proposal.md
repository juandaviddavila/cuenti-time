# País en sucursales + login WhatsApp OTP — Proposal

## Intent

Acotar sucursales y búsqueda de dirección a un país (ISO alpha-2) y permitir iniciar sesión con un código OTP enviado por WhatsApp (misma WABA de Cuenti Notificaciones que Sign Cuenti). Publicar en `https://app-time.cuenti.co`.

## Scope

**Sucursales**
- Campo `Branch.countryCode` (ISO alpha-2, default `CO`)
- Combobox de país con bandera
- Autocomplete de Places acotado con `includedRegionCodes` (sin `locationBias` de radio de país)

**Login WhatsApp**
- `User.phoneE164` único opcional
- Login: Contraseña | Correo | WhatsApp
- OTP vía Meta Cloud API, plantilla AUTHENTICATION `sign_cuenti_otp`
- Celular en crear/editar usuario y registro opcional

**Ops**
- Deploy pack + scp + `server-update.sh` (no pisa `.env` del server)
- `cuenti-time-mcp` en PM2 debe usar `exec_mode: fork`

## Out of scope

- Plantilla WhatsApp propia de cuenti time (se reutiliza `sign_cuenti_otp`)
- Persistencia OAuth MCP en DB (sigue archivo local)
- Arreglar otros procesos PM2 ajenos a cuenti-time

## Status

Implementado y publicado el 2026-08-14 en `app-time.cuenti.co`.
