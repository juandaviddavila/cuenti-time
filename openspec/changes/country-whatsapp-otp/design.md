# Design: País en sucursales + login WhatsApp OTP

## Technical Approach

Dos entregas coordinadas en el mismo ciclo: (1) país en sucursal + filtro Places; (2) celular E.164 + OTP WhatsApp en login, reutilizando la WABA de Sign Cuenti.

## Architecture Decisions

### Decision: `countryCode` ISO alpha-2 en `Branch`, default CO

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Texto libre de país | Fácil, inconsistente para Places | ❌ |
| ISO alpha-2 + catálogo `src/lib/countries.ts` | Combobox con bandera; Places usa `includedRegionCodes` | ✅ |

### Decision: Autocomplete solo con `includedRegionCodes`

Places Autocomplete (New) rechaza `locationBias.circle.radius` > 50_000 m (HTTP 400). Un radio de país (~1_200 km) rompe la búsqueda. El filtro de país es `includedRegionCodes: [iso2.lower]`. El mapa sí puede recentrarse con `getCountryMapCenter`.

### Decision: Celular en `User.phoneE164` unique opcional

Una cuenta = una empresa. El login WhatsApp busca por `phoneE164` normalizado (`+` + dígitos). Si el número no existe, la API responde igual que si existiera (anti-enumeración) y no envía nada.

### Decision: Misma WABA y plantilla `sign_cuenti_otp`

No crear plantilla nueva. Payload AUTHENTICATION: body + button URL con el código (igual que Sign Cuenti `MetaWhatsAppCloudAdapter.sendAuthenticationOtp`). Vars: `WHATSAPP_ENABLED`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`.

### Decision: Fallo de Meta es 503 visible

No devolver 200 con `devCode` cuando WhatsApp está mal configurado o Meta falla. Next no recarga Prisma ni `.env` en caliente de forma fiable: tras schema o token hay que reiniciar `pnpm dev` / PM2.

### Decision: MCP PM2 en `fork`, no `cluster`

El binario ESM (`http.js` + `--env-file=.env`) muere en `cluster_mode` sin logs. `restart` de un proceso cluster errored se cuelga; hay que `pm2 delete` + `pm2 start ecosystem.config.cjs --only cuenti-time-mcp`.

## Data Flow

### Sucursal + Places

```
CountryCombobox → countryCode
AddressSearchInput → AutocompleteSuggestion.fetchAutocompleteSuggestions({
  input, includedRegionCodes: [region], region, language: "es", sessionToken
})
→ Place → address, city, lat/lng, googlePlaceId (rechazar si el país del place ≠ countryCode)
```

### Login WhatsApp

```
POST /api/auth/login { method: "whatsapp", phoneE164 }
  → findUnique({ phoneE164 })
  → issueLoginOtp(channel: "whatsapp")
  → sendWhatsAppLoginOtp (Graph v26 / {phoneNumberId}/messages)
POST /api/auth/login/verify { phoneE164, code }
POST /api/auth/login/resend { phoneE164, channel: "whatsapp" }
```

## Deploy

```
cd cuenti-time   # cwd absoluto; el workspace mixto a veces queda en sing-cuenti
bash scripts/pack-deploy.sh
scp -i laboratorios_ip/tem/chatti.chat.pem deploy.tar.gz \
  ubuntu@32.186.145.119:/home/ubuntu/app/cuenti-time_compilado/deploy.tar.gz
ssh … 'cd /home/ubuntu/app/cuenti-time_compilado && bash scripts/server-update.sh'
# WHATSAPP_* viven solo en .env del server (no van en el tar)
```

Público: `https://app-time.cuenti.co` | `https://time.cuenti.co` | `https://mcp-time.cuenti.co/mcp`  
PM2: `cuenti-time` :7578 | `cuenti-time-marketing` :3008 | `cuenti-time-mcp` :4101 (fork)
