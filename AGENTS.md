# FaceAccess SaaS — AGENTS.md

> Archivo de contexto para sesiones OpenCode. Cada línea responde: "¿lo perdería un agente sin ayuda?"

## Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js (App Router) | 14 | Framework principal |
| TypeScript | 5 | Tipado estricto (strict: true, no `any`) |
| Tailwind CSS | 3 | Estilos utilitarios, mobile-first |
| shadcn/ui | latest | Componentes UI (Radix primitives) |
| Prisma | 5 | ORM para PostgreSQL |
| PostgreSQL + pgvector | 16+ | Base de datos y búsqueda vectorial facial (`root` / `1234` / `localhost:5432`) |
| Zustand | 4 | Estado global liviano |
| React Hook Form | 7 | Formularios |
| Zod | 3 | Validación de esquemas |
| Recharts | 2 | Gráficas interactivas |
| bcryptjs | 2 | Hash de contraseñas |
| jsonwebtoken | 9 | JWT para auth |
| next-pwa | latest | Service worker + PWA |
| next-themes | latest | Modo claro/oscuro |
| Lucide React | latest | Iconografía |
| Sonner | latest | Toast notifications |

## Comandos esenciales

```bash
# IMPORTANTE: activar Node v24 antes de cualquier comando
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v24.13.1

# Dev
pnpm dev
pnpm marketing:dev # landing + blog en :3008

# Instalar dependencias
pnpm install

# MCP RRHH (remoto Streamable HTTP; DATABASE_URL solo en el origen)
pnpm mcp:build
pnpm mcp:dev:http      # :4101 /mcp — auth Bearer cuenti_…
pnpm mcp:start:http
pnpm mcp:test

# Prisma (ORDEN IMPORTANTE: generate → db push → seed)
# Tras cambiar schema: generate + db push + REINICIAR next (si no, Unknown field en runtime)
pnpm db:generate   # = prisma generate
pnpm db:push       # = prisma db push
pnpm db:seed       # = prisma db seed
pnpm db:studio     # = prisma studio (UI gráfica)

# Build / Lint
pnpm build
pnpm lint
pnpm marketing:build
pnpm marketing:lint
```

## Gestor de paquetes
- **pnpm 11.9.0** (NO npm, NO yarn)
- Configuración en `pnpm-workspace.yaml` — `allowBuilds` para Prisma y unrs-resolver
- `.npmrc` con `shamefully-hoist=true` (requerido por Next.js SWC y Radix UI)
- `packageManager: "pnpm@11.9.0"` declarado en `package.json`
- Para nuevas dependencias: `pnpm add <pkg>` / `pnpm add -D <pkg>` — versiones **exactas** (sin `^`/`~`); `.npmrc` tiene `save-exact=true`

## Arquitectura

### Aplicaciones del monorepo
| Aplicación | Ruta | Puerto | Responsabilidad |
|---|---|---:|---|
| SaaS | raíz | 7578 | Producto autenticado, API y pagos |
| Marketing | `packages/marketing` | 3008 | Landing pública, recursos y SEO/IA |
| MCP RRHH | `packages/hr-mcp-server` | 4101 | Servidor de herramientas MCP |

La app de marketing no importa Prisma, JWT ni componentes internos del dashboard. Sus CTA apuntan a `NEXT_PUBLIC_APP_URL`.

### Estructura de rutas (App Router)
```
src/app/
├── (auth)/                  # Grupo sin sidebar: login, register, forgot-password, verify-email, pricing, subscription-expired
├── (dashboard)/             # Grupo con sidebar + header
│   ├── layout.tsx           # Sidebar (md:) + Bottom Nav (móvil) + Header
│   ├── dashboard/
│   ├── companies/
│   ├── branches/
│   ├── employees/
│   ├── positions/
│   ├── facial-registration/
│   ├── attendance/
│   ├── attendance-history/
│   ├── reports/
│   ├── settings/
│   │   ├── integrations/    # Tabs: Tokens API | MCP | Webhooks
│   │   │   ├── api-tokens/
│   │   │   ├── mcp/         # Guía Claude/ChatGPT remoto
│   │   │   └── webhooks/
│   │   └── …
│   ├── users/
│   ├── plans/               # Redirige a /pricing
│   ├── audit/
│   └── profile/
├── kiosk/                   # Pantalla kiosco (sin sidebar, pantalla completa)
├── api/                     # API Routes de Next.js
└── layout.tsx               # Root: ThemeProvider, Toaster, Providers
```

### Modelo cuenta ↔ empresa (regla de negocio)
- **Una cuenta de usuario = una empresa.** No existe “varias empresas en la misma cuenta”.
- Si el cliente necesita otra empresa, debe **registrarse de nuevo** (`/register` crea `Company` + `User` COMPANY_ADMIN en una transacción).
- **Una empresa tiene muchas sucursales** (`Branch[]`). Los empleados pertenecen a una sucursal de esa empresa.
- La plataforma es **multi-tenant** (muchas empresas en el mismo SaaS), pero cada tenant se accede con su propia cuenta.
- `SAAS_SUPER_ADMIN` es el operador de plataforma: ve todas las empresas en `/super-admin`, pero los clientes (`COMPANY_ADMIN`, etc.) gestionan **solo su empresa**.
- La elevación `SAAS_SUPER_ADMIN` depende exclusivamente de la allowlist `SUPER_ADMIN_EMAILS` (emails separados por coma), no del rol persistido en DB. El usuario sí debe existir en DB para autenticarse.
- El JWT contiene `{ userId, companyId, role, email, name }`; `payloadToSession()` recalcula el rol efectivo contra la allowlist en cada request.
- Separación estricta de datos entre empresas en todas las queries.

### Roles (menor a mayor permisos)
1. `REPORT_VIEWER` — Solo informes
2. `FACE_REGISTRAR` — Registro facial + kiosco
3. `BRANCH_SUPERVISOR` — Sucursal asignada
4. `COMPANY_ADMIN` — Toda la empresa
5. `SAAS_SUPER_ADMIN` — Plataforma completa; asignado por `SUPER_ADMIN_EMAILS`
6. `DEVELOPER` — API tokens, webhooks, MCP, docs y ejemplos técnicos

## Base de datos — Modelos Prisma

Relaciones principales:
```
Company → Branch[] → Employee[] → AttendanceRecord[]
                               → FaceValidationLog[]
Company → User[]
User → Role
Company → Payment[] / WebhookSubscription[] / LateReportLog[]
AuditLog (registra todos los cambios)
```

- IDs: `cuid()` en todos los modelos
- Soft-delete: campo `status` (ACTIVE/INACTIVE) o `active: Boolean`
- Schema en: `prisma/schema.prisma`
- Seed en: `prisma/seed.ts`
- Embeddings faciales: `Employee.faceEmbedding Unsupported("vector(128)")` con índice `ivfflat`; crear extensión/índice con `prisma/pgvector.sql`
- `Plan` y `PlanType` fueron eliminados. El modelo SaaS actual usa `Company.subscriptionExpiresAt`, `Company.maxEmployees`, `Payment` y futura integración Wompi.
- `Company.maxEmployees` limita únicamente nuevos registros faciales, no la creación de empleados básicos.
- `Company.faceMatchThreshold` (Float, default `0.6`): distancia euclidiana máxima para match facial (menor = más estricto). Editable en `/settings`; usado en `face/search`, `face/descriptors`, kiosk y registro facial.
- `Branch.latitude`, `Branch.longitude`, `Branch.googlePlaceId`, `Branch.radiusMeters` controlan geofence para marcaciones faciales.

## Capa de IA Facial (Mock → Producción)

```
src/lib/ai/
├── types.ts                 # FaceValidationResult, LivenessResult, FaceEmbedding
├── face-service.ts          # Interfaz IFaceService (abstracción)
└── mock-face-service.ts     # Implementación mock (delays aleatorios, scores simulados)
```

**Métodos del servicio:**
- `validateFace(imageData)` → FaceValidationResult
- `detectLiveness(imageData)` → LivenessResult
- `compareFace(embedding1, embedding2)` → confidenceScore
- `registerFaceEmbedding(imageData)` → FaceEmbedding
- `getValidationScore(imageData)` → number

Para conectar proveedor real (Azure Face API recomendado): crear `azure-face-service.ts` implementando `IFaceService` y cambiar el import en el provider.

## Convenciones de código

- **Archivos:** kebab-case (`company-table.tsx`, `use-camera.ts`)
- **Componentes:** PascalCase
- **Tipos/interfaces:** `src/types/` — usar `interface` para objetos, `type` para uniones
- **Mock data:** `src/lib/mock/` con tipos fuertes (no `any`)
- **Formularios:** React Hook Form + shadcn/ui `<FormField>` + Zod schema en `src/lib/schemas/`
- **Tablas:** shadcn/ui `<Table>` + paginación manual sobre mock data
- **Modo oscuro:** `next-themes` con `attribute="class"`, clases `dark:` en Tailwind
- **Responsive:** Mobile-first, breakpoints `sm:` / `md:` / `lg:`
- **No `any`.** Strict TypeScript en todo el proyecto.

## Layout responsivo

| Pantalla | Navegación |
|---|---|
| Móvil (`< md`) | Bottom Navigation bar |
| Tablet (`md`) | Sidebar colapsable |
| Escritorio (`lg+`) | Sidebar expandido |

## PWA

- `public/manifest.json` — nombre, íconos, theme_color, background_color
- Service worker generado por `next-pwa` en `next.config.js`
- Íconos PWA en `public/icons/` (192x192, 512x512)
- Cache básico para assets estáticos

## API Routes (Next.js)

```
src/app/api/
├── auth/
│   ├── login/route.ts
│   ├── register/route.ts
│   ├── refresh/route.ts
│   └── logout/route.ts
├── audit/
│   └── search/route.ts        # Búsqueda paginada y filtrada de logs
├── companies/route.ts
├── companies/[id]/route.ts
├── branches/route.ts
├── branches/[id]/route.ts
├── employees/route.ts
├── employees/[id]/route.ts
├── users/route.ts
├── users/[id]/route.ts
├── positions/route.ts
├── positions/[id]/route.ts
├── shifts/route.ts
├── shifts/[id]/route.ts
├── employee-shifts/route.ts
├── employee-shifts/[id]/route.ts
├── incident-types/route.ts
├── incident-types/[id]/route.ts
├── incidents/route.ts
├── incidents/[id]/route.ts
├── attendance/route.ts
├── reports/route.ts
├── reports/detailed/route.ts  # Reporte detallado con ausencias
├── api-tokens/route.ts
├── api-tokens/[id]/route.ts
├── face/
│   ├── descriptors/route.ts
│   ├── search/route.ts        # Búsqueda por similitud vectorial (pgvector)
│   ├── register/route.ts
│   └── validate/route.ts
└── v1/                        # API pública con Bearer tokens
    ├── employees/route.ts
    ├── employees/[id]/route.ts
    ├── attendance/route.ts
    ├── branches/route.ts
    └── reports/daily/route.ts
```

## Seguridad

- Contraseñas: `bcryptjs` con salt rounds = 12
- JWT: access token (15min) + refresh token (7d) en httpOnly cookie
- Protección de rutas: `src/middleware.ts` valida JWT en cada request a `(dashboard)`
- Datos biométricos: solo se guarda el embedding (vector numérico), nunca la imagen original en producción
- Consentimiento biométrico: `Employee.biometricConsentAt` (timestamp de aceptación)
- Nuevos registros requieren verificación de email con **código de 6 dígitos** (vence en 15 min). `POST /api/auth/register` envía el código por correo; el usuario lo ingresa en `/verify-email` vía `POST /api/auth/verify-email`. Reenvío: `POST /api/auth/resend-verification`. Trial de 7 días con 10 empleados incluidos.
- Usuarios con `emailVerifiedAt = null` no pueden iniciar sesión.
- `/api/auth/refresh` renueva access token usando cookie `refresh-token`; middleware también renueva access token para navegación de páginas cuando aplica.

## Skills registrados

- `.opencode/skills/update-agents/SKILL.md` — Se activa automáticamente al hacer cambios significativos para mantener este archivo actualizado.

---

## Dependencias instaladas (extra)
- `jose` — JWT en middleware de Next.js (edge runtime; usar `jose` en middleware, `jsonwebtoken` en API Routes)
- `@ducanh2912/next-pwa` v10 — usar en vez de `next-pwa` (mejor compatibilidad con Next.js 14)
- Prisma 5.22 con PostgreSQL; `pgvector` se maneja con `Unsupported("vector(128)")` y SQL crudo para leer/escribir/buscar embeddings
- `xlsx` — exportación a Excel en cliente
- `jspdf` + `jspdf-autotable` — exportación a PDF en cliente
- `react-day-picker` v8 — calendario usado por el componente `Calendar` de shadcn/ui

## Notas operativas
- Siempre ejecutar `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v24.13.1` antes de cualquier comando npm/node (la versión activa es v18 por defecto)
- Usar `bcryptjs` (no `bcrypt` nativo) — no requiere compilación C++
- El middleware usa `jose` (edge-compatible), las API routes usan `jsonwebtoken`
- En middleware y `server-auth`, preferir imports subpath de `jose` (`jose/jwt/sign`, `jose/jwt/verify`) para no arrastrar módulos JWE incompatibles con Edge.
- shadcn/ui instalado con `npx shadcn@latest add <component>` (no `shadcn-ui`)
- PostgreSQL local actual: `DATABASE_URL="postgresql://root:1234@localhost:5432/cuenti_time"`

## Credenciales de seed (DB cuenti_time)
- Super Admin: `superadmin@cuenti.com` / `Admin2024!`
- Admin Empresa 1 (Distribuidora Andina): `admin.distribuidora@cuenti.com` / `Admin2024!`
- Admin Empresa 2 (Textiles del Norte): `admin.textiles@cuenti.com` / `Admin2024!`

## Seguridad — patrones obligatorios

- **JWT secrets:** Usar `getJwtSecret()` y `getJwtRefreshSecret()` de `src/lib/server-auth.ts`. Nunca hardcodear ni usar `|| "fallback"`. Si falta la env var, el servidor falla en startup.
- **Refresh token:** Firmado con `JWT_REFRESH_SECRET` separado del `JWT_SECRET`.
- **httpOnly cookies:** El token vive en cookie `access-token` httpOnly. El Zustand store NUNCA persiste el token (solo `user` e `isAuthenticated`).
- **Bootstrap de sesión:** `AuthSessionProvider` llama `GET /api/auth/me` al montar; si falla con 401 intenta `POST /api/auth/refresh` y rehidrata el perfil. Así la sesión sobrevive reinicios del servidor Next.js (mismos JWT secrets).
- **Refresh deslizante:** `/api/auth/refresh` y el middleware renuevan access + refresh (ventana de 7 días mientras haya uso).
- **Logout:** Siempre llamar `POST /api/auth/logout` antes de limpiar el store — borra las cookies del servidor.
- **Rate limiting:** Usar `rateLimit()` de `src/lib/rate-limit.ts` en todos los endpoints de auth. 10 req/min para login, 5 req/15min para register.
- **Validación server-side:** Todo API route valida con Zod antes de tocar la DB.

## Multi-tenant — reglas críticas

- Todo Server Component que consulte datos DEBE llamar `getServerSession()` y filtrar con `getCompanyFilter(session)` de `src/lib/server-auth.ts`.
- `getCompanyFilter()` devuelve `{}` para `SAAS_SUPER_ADMIN` (ve todo) y `{ companyId }` para todos los demás.
- Para proteger `/super-admin` y sus APIs usar `isSuperAdmin(session)` de `src/lib/super-admin.ts`; no basta con leer el rol de Prisma.
- Al buscar recursos por ID (employee, branch, etc.) siempre verificar que `resource.companyId === session.companyId` antes de devolver datos.
- **Nunca** hacer `prisma.xxx.findMany()` sin filtro en producción — fuga multi-tenant.

## Motor de asistencia — reglas

- Prevención de doble marcación: `POST /api/attendance` verifica la última marcación del día en transacción antes de crear.
  - No se puede `CHECK_IN` si el último registro del día es `CHECK_IN`.
  - No se puede `CHECK_OUT` sin `CHECK_IN` previo.
- `Branch.duplicateWindowMinutes` controla la ventana anti-doble tap; el formulario de sucursales ya la edita (con FormDescription explicativa).
- Si una sucursal tiene `latitude` y `longitude`, el geofence **solo se exige en clientes móviles** (`deviceClass: "mobile"` vía body o User-Agent). En desktop no se requiere GPS.
- `distanceFromBranch` se guarda en metros usando Haversine (`src/lib/geo.ts`) cuando hay coordenadas.
- `/facial-registration` y `/kiosk` usan `getBrowserLocationIfMobile()` + `getClientDeviceClass()` de `src/lib/browser-location.ts`.
- `presentToday` = empleados cuyo ÚLTIMO registro hoy es `CHECK_IN` (no simplemente quienes entraron).
- `lateArrivals` = calculado contra `branch.workSchedule[dayOfWeek].start` con gracia de 10 min.
- `lateArrivals` NO puede ser un porcentaje estimado.
- Flujos faciales (kiosco y registro facial automático) leen la última marcación del día y usan `branch.duplicateWindowMinutes` para decidir `CHECK_IN`/`CHECK_OUT` antes de llamar al backend, mostrando mensajes amigables como "Entrada reciente, espere X minutos".
- Al crear cuenta (`POST /api/auth/register`) o empresa (`POST /api/companies`) se crea automáticamente el cargo `Position` con `name: "general"`.

## Marca y UI
- Nombre de producto: **cuenti time** (`NEXT_PUBLIC_APP_NAME` / `src/lib/brand.ts`).
- Logos: `https://app-work.cuenti.co/brand/logo-dark.svg` y `logo-simbolo.svg`.
- Login/auth: UI minimalista neutra (panel oscuro + formulario claro); sin degradados azul/naranja.
- Shell: sidebar oscuro, header **sin** buscador global (se quitó; no hacía nada), tokens CSS neutros en `globals.css`.
- Header muestra `companyName` del usuario en el menú de perfil.

## Geolocalización de sucursales
- `/branches` permite editar `latitude`, `longitude`, `radiusMeters` y `googlePlaceId`.
- El botón "Usar mi ubicación" usa geolocalización del navegador y redondea coordenadas a 6 decimales.
- Si la sucursal no tiene coordenadas configuradas, asistencia no exige GPS.
- Si la sucursal tiene coordenadas **y** el cliente es móvil, la asistencia sin GPS responde 422 con "No se recibió ubicación GPS para validar la sucursal".
- En desktop, aunque la sucursal tenga geofence, no se bloquea por falta de GPS.

## Suscripción y límites
- Empresas nuevas reciben `subscriptionExpiresAt = now + 7 días` y `maxEmployees = 10`.
- `src/lib/subscription.ts` centraliza validación de suscripción vencida y límite facial.
- `src/app/(dashboard)/layout.tsx` redirige empresas vencidas a `/subscription-expired`; `SAAS_SUPER_ADMIN` no se bloquea.
- `/pricing` existe como página pública básica; `/plans` redirige a `/pricing`.
- `PUT /api/employees/[id]` bloquea nuevos registros faciales cuando `faceRegistered` pasa de `false` a `true` o se agrega `faceEmbedding` y ya se alcanzó `maxEmployees`.
- Re-registro facial de empleados que ya tenían rostro sí está permitido aunque el cupo esté lleno.

## Reportes
- Pestaña **Detallado** en `/reports`: rango de fechas, filtros por empleado/sucursal, opción "Mostrar solo ausencias", exportación a Excel/PDF.

## API pública (v1)
- Autenticación con Bearer tokens (`ApiToken`): hash bcrypt + `tokenPrefix` para lookup. Helper `requireApiToken` / `hasScope` en `src/lib/api-token-auth.ts`.
- **Aislamiento multi-tenant estricto:** el `companyId` sale solo del token. Nunca aceptar `companyId` en query/body. Toda query usa `where: { companyId: auth.companyId }` (o relación equivalente). Por ID: `findFirst({ id, companyId })` → 404 si es otra empresa. Token sin empresa → 403. Crear/listar tokens solo con `session.companyId` (sin bypass).
- Scopes: `read` (lectura); `write` implica también lectura. POST asistencia exige `write`.
- Rutas: `companies/me`, empleados, cargos, turnos, employee-shifts, sucursales, tipos/novedades, asistencia (GET/POST), `reports/daily`, `reports/hr`.
- Documentación Swagger UI en `/api/v1/docs` (`public/openapi.yml` v1.1.0).
- `/api/v1/*` en `PUBLIC_PATHS` del middleware: Bearer NO es JWT; valida `validateApiToken()`.

## Quirks de TypeScript

- Usar `Array.from(map.values())` — NO `[...map.values()]`. El target TS no soporta spread de iteradores Map/Set.
- Mismo para `Map.entries()`: usar `Array.from(store.entries()).forEach(...)`.

## Middleware — reglas de seguridad

- `pathname.includes(".")` es un bypass de seguridad. Usar `STATIC_EXTENSIONS` regex explícita.
- La lista `PUBLIC_PATHS` usa match exacto o `startsWith(p + "/")` — nunca `startsWith(p)` solo (bypaseable con `/login.hack`).

## Módulos completados
- [x] Scaffolding + config
- [x] Prisma 5 schema + PostgreSQL/pgvector + seed
- [x] Layout raíz + ThemeProvider + Sonner
- [x] Auth: login, register, forgot-password, JWT (secrets separados), middleware, rate limiting, Zod validation
- [x] Layout dashboard: Sidebar (hidratación segura, logout correcto), BottomNav, Header
- [x] Dashboard: stats cards, gráficas, actividad reciente — con filtro multi-tenant
- [x] API: /api/attendance (prevención doble marcación, multi-tenant, paginación)
- [x] QA: 16 issues corregidos (4 críticos, 5 high, 7 medium)

- [x] CRUD Empresas, Sucursales, Empleados, Cargos, Turnos, Asignación de turnos, Tipos de novedad, Novedades (tabla + cards + modales + API routes)
- [x] Registro facial `/facial-registration` (cámara + guía visual + IA mock)
- [x] Kiosco `/kiosk` (flujo completo entrada/salida fullscreen)
- [x] Historial asistencia `/attendance`
- [x] Informes `/reports` con pestaña detallada y exportación Excel/PDF
- [x] Usuarios `/users` + Planes `/plans`
- [x] Auditoría `/audit` con filtros avanzados, paginación y diff de cambios
- [x] Configuración `/settings` + Integraciones (Tokens | MCP | Webhooks) + Perfil `/profile`
- [x] API pública v1 con autenticación Bearer y Swagger UI en `/api/v1/docs`
- [x] Todas las API routes: companies, branches, employees, positions, shifts, employee-shifts, incident-types, incidents, users, attendance, reports, api-tokens, face, audit/search, v1, webhooks
- [x] Email verification en registro, trial 7 días y login bloqueado para email no verificado
- [x] Refresh token 7 días + access token 15 minutos + endpoint `/api/auth/refresh`
- [x] Suscripción vencida con `/subscription-expired` y `/pricing` pública básica
- [x] Límite `maxEmployees` aplicado solo a nuevos registros faciales
- [x] Geofence de sucursales con lat/lng/radio; GPS obligatorio solo en móvil (`deviceClass`)
- [x] SDD OpenSpec: `branch-form-cleanup` archivado; main spec en `openspec/specs/branch-management/spec.md`
- [x] Marca cuenti time + logos app-work; login minimalista; AuthSessionProvider + refresh deslizante
- [x] Cargo por defecto `general` al crear cuenta/empresa
- [x] `Company.faceMatchThreshold` + deps exactas (`save-exact`) + header sin buscador vacío
- [x] MCP RRHH remoto + webhooks con reintentos/logs (ver secciones abajo)
## Webhooks outbound
- Catálogo: `src/lib/webhooks/events.ts` (empleados, asistencia, novedades, sucursales).
- Motor: `src/lib/webhooks/dispatch.ts` — enqueue `WebhookDelivery`, firma HMAC `X-Cuenti-Signature`, **1 intento inmediato + hasta 3 reintentos cada 10 min** (máx. 4 envíos; `WEBHOOK_MAX_RETRIES=3`) → `FAILED`.
- Reintentos: timer in-process (`scheduleInProcessRetry`) + respaldo `POST /api/webhooks/retry` (`CRON_SECRET`).
- Logs estructurados en consola con prefijo `[webhook]` (éxito, fallo, reintento, worker).
- Multi-tenant: solo suscripciones de `companyId` del emisor; crear/listar exige `session.companyId`.
- Callers: attendance (dashboard + v1), employees create/update/deactivate/face, incidents CRUD, branches create/update.
- UI: `/settings/integrations/webhooks`.

## MCP RRHH (`packages/hr-mcp-server`)
- Servidor MCP **remoto** Streamable HTTP (`src/http.ts`, puerto default **4101**, path `/mcp`). Stdio (`src/index.ts`) solo para dev.
- Auth **dual** por petición:
  1. `Authorization: Bearer cuenti_…` — token API directo (Claude / Cursor)
  2. `Authorization: Bearer mcp_at_…` — access token OAuth 2.1 (ChatGPT connectors)
- OAuth 2.1 **adicional** (no reemplaza Bearer): PKCE S256, DCR `POST /register`, consent `/authorize` (pegar token API), `/.well-known/oauth-*`, refresh `mcp_rt_…`. Provider: `src/oauth-provider.ts`.
- **Cliente (empresa):** `NEXT_PUBLIC_MCP_URL` + token (header Bearer o consent OAuth). **Nunca** `DATABASE_URL` ni ruta absoluta al binario.
- **Origen (infra):** proceso `hr-mcp-server` en `:4101`. Next hace **rewrite/proxy** de `/mcp`, `/.well-known/*`, `/authorize`, `/token`, `/register`, `/revoke` → `MCP_UPSTREAM_URL` (mismo origen que la app/túnel). Vars: `DATABASE_URL`, `MCP_PUBLIC_URL` (issuer HTTPS público), `MCP_UPSTREAM_URL`, `MCP_ALLOWED_HOSTS`.
- Consumo: **Claude** (Bearer) y **ChatGPT** (OAuth). Cursor opcional con `mcp-remote`.
- 14 tools read-only. Incluye reportes RRHH, marcaciones en detalle (`get_attendance_records`), búsqueda de empleados (`find_employee`) y presentes actuales (`get_present_now`). Motor `src/lib/hr/`.
- UI: `/settings/integrations/mcp`. Scripts: `pnpm mcp:dev:http` / `mcp:start:http` / `mcp:build` / `mcp:test`.

## Integraciones (UI)
- `/settings/integrations` → tabs: **Tokens API** | **MCP** | **Webhooks** (`integrations-nav.tsx`).
- Tokens: inactivar/reactivar/eliminar hard; reveal con `tokenCipher` AES-GCM.
- Permiso: `canManageIntegrations` (roles DEVELOPER / COMPANY_ADMIN / etc. según `user-permissions`).

## Pendientes SaaS grandes
- [x] Consola `/super-admin` para métricas, edición de suscripción/cupo e impersonación con banner/auditoría; acceso por `SUPER_ADMIN_EMAILS`
- [ ] Wompi: pagos manuales mensual/anual, confirmación y webhook
- [x] Webhooks outbound: catálogo, HMAC, deliveries, 1+3 reintentos/10min, logs `[webhook]`
- [x] MCP RRHH remoto (HTTP :4101) + tab Integraciones (Claude/ChatGPT first)
- [x] OAuth 2.1 en endpoint MCP (DCR/PKCE/consent) **además** de Bearer `cuenti_`
- [ ] Persistencia OAuth en DB si hay multi-instancia (hoy persiste en archivo local `.data/mcp-oauth-store.json`)
- [ ] Deploy MCP detrás de Cloudflare (`NEXT_PUBLIC_MCP_URL` / `MCP_PUBLIC_URL` HTTPS)
- [ ] Reporte diario por email de tardanzas/ausencias agrupado por turno y sucursal
- [ ] Novedades colectivas por `shiftId` en UI/reportes
- [ ] `/pricing` final conectada a pagos y cálculo de empleados extra

## Quirks Next.js
- `useSearchParams()` debe estar dentro de un componente envuelto en `<Suspense>` (ver `facial-registration/page.tsx`)
- `getCompanyFilter()` retorna `{ companyId }` — NO usar en consultas a `prisma.company` (que filtra por `id`). Usar `{ id: session.companyId }` directamente para Company.
- `z.preprocess()` causa conflicto de tipos con React Hook Form resolver. Usar `.optional().refine()` en su lugar.
- Tras cambiar `schema.prisma`: `pnpm db:generate && pnpm db:push` y **reiniciar** el proceso `next` (el client no hot-reloadea).

*Última actualización: 2026-07-20 (tarde). MCP OAuth 2.1 adicional + Bearer; webhooks 1+3×10min; Integraciones Tokens|MCP|Webhooks; deps exactas; faceMatchThreshold; header sin buscador. Dev: `http://localhost:7578`, MCP `:4101`.*