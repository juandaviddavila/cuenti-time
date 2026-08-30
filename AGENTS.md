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
| Zod | 4 | Validación de esquemas |
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

# Motor facial (modelo ONNX + runtime WASM en public/)
pnpm face:setup # descarga w600k_mbf.onnx y copia los binarios de onnxruntime-web

# Reset destructivo (solo cuando se autorice borrar todos los datos)
pnpm db:generate && pnpm exec prisma db push --force-reset && pnpm db:seed

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

- IDs: `BigInt @id @default(autoincrement())` en todos los modelos; las FK también son `BigInt`
- Frontera de serialización: Prisma usa `bigint`; JWT, JSON, frontend, webhooks y MCP usan IDs como strings decimales
- Conversión centralizada en `src/lib/bigint.ts` (`stringToBigint`, `bigintToString`, `serializeRecord`, `bigintReplacer`)
- Nunca pasar valores `bigint` directamente a `NextResponse.json()` o `JSON.stringify()` fuera de la serialización centralizada
- Los parámetros `[id]` de Next.js llegan como strings y deben validarse como decimal y convertirse a `bigint` antes de consultar Prisma
- Soft-delete: campo `status` (ACTIVE/INACTIVE) o `active: Boolean`
- Schema en: `prisma/schema.prisma`
- Seed en: `prisma/seed.ts`
- Embeddings faciales: `Employee.faceEmbedding Unsupported("vector(512)")` con índice `ivfflat` y `vector_cosine_ops`; crear extensión/índice con `prisma/pgvector.sql`. Prisma **no** diffea columnas `Unsupported`: cambios de tipo van en SQL explícito
- Multi-template facial: `FaceTemplate` (1-N por empleado, `embedding vector(512)`, label frontal/left/right). `/api/face/search` matchea por MÍNIMA distancia entre plantillas. Backfill desde `faceEmbedding` en `prisma/backfill-face-templates.sql`. El enrolamiento captura frontal (3 muestras) + giros izq/der (2 c/u) con gates de calidad (`src/lib/ai/face-quality.ts`: nitidez Laplaciano, luminancia, roll/yaw) y anti-duplicados (`findDuplicateEnrollment` con `excludeEmployeeId`).
- `Plan` y `PlanType` fueron eliminados. El modelo SaaS actual usa `Company.plan` (`free`/`paid`), `Company.subscriptionStatus`, `Company.subscriptionExpiresAt`, `Company.maxEmployees` y los modelos de facturación `BillingConfig` + `BillingInvoice` (integración **Cuenti Pay**). Wompi quedó deprecado.
- `Company.maxEmployees` limita únicamente nuevos registros faciales, no la creación de empleados básicos.
- `BillingConfig`: precios y credenciales Cuenti Pay leídos desde DB (`freeEmployeeLimit`, `priceCopPerEmployeeMonthly`, `priceUsdPerEmployeeMonthly`, `tipoDocumento`, `idProductoCop`, etc.). Nunca quemar precios/límites en UI.
- `BillingInvoice`: factura por empresa (`codigoUnico`, `status`, `kind`, `currency`, `totalAmount`, `paymentUrl`, `cuentiTransactionId`).
- `Company.faceMatchThreshold` (Float, default `0.5`): distancia **coseno** máxima para match facial (menor = más estricto), rango 0.2–1.0. Editable en `/settings`; usado en `face/search`, `face/descriptors`, kiosk y registro facial. Calibrar con `/settings/face-diagnostics`.
- `Branch.latitude`, `Branch.longitude`, `Branch.googlePlaceId`, `Branch.radiusMeters` controlan geofence para marcaciones faciales.

### BigInt y límites de la aplicación
- Los payloads públicos mantienen compatibilidad usando strings decimales, por ejemplo `{ "id": "42" }`.
- Los claims JWT `userId`, `companyId` y `tokenId` son strings; convertirlos con `stringToBigint()` únicamente al construir filtros Prisma.
- `AuditLog.entityId` continúa siendo string porque es una referencia polimórfica y debe soportar entidades distintas.
- Tras cambiar el schema, ejecutar `pnpm db:generate`; si se reinicia la base, usar el comando destructivo anterior y volver a sembrar.

## Capa de IA Facial (ArcFace 512-D en el navegador)

```
src/lib/ai/
├── mediapipe-face.ts        # Detección + landmarks (MediaPipe Face Landmarker)
├── face-detection-loop.ts   # rAF con candado; presencia cada ~200ms
├── face-api-service.ts      # Presencia TinyFace; detectFace / detectFaceConsensus (mismo frame)
├── face-align.ts            # 5 puntos (MediaPipe o 68 legacy) → similitud → canvas 112x112
├── face-quality.ts          # Gates de enrolamiento: nitidez, luminancia, roll/yaw
├── arcface-service.ts       # onnxruntime-web: w600k_mbf.onnx → embedding 512-D
├── arcface-server.ts        # onnxruntime-node: mismo modelo en servidor (Fase 2)
├── pgvector.ts              # Serialización del vector (FACE_EMBEDDING_DIMENSIONS = 512)
├── openrouter-liveness.ts   # Anti-spoofing (servidor)
└── openrouter-service.ts    # Cliente de liveness (timeout 4s)
```

**Pipeline:** TinyFaceDetector + landmark 68 (presencia ~200 ms) → 2 frames estables →
`detectFaceConsensus` (espera 2 embeddings seguidos parecidos; no promedia frames movidos) →
alineación 112×112 → ArcFace 512-D → `POST /api/face/search` (pgvector `<=>`).
MediaPipe no bloquea la carga. No correr ArcFace en cada tick.
**Embed dual (Fase 2):** `embedDetectedFace` prefiere ArcFace WASM local; si no está
disponible o falla, envía el crop 112×112 (RGBA base64) a `POST /api/face/embed` y el
servidor corre `onnxruntime-node`. `loadModels()` solo exige el detector; ArcFace local
carga en background.

- **Solo identidad facial.** ArcFace responde *quién es*; no sirve para comparar prendas
  ni cuerpo entero. Se entrena para que la misma persona quede cerca *aunque cambie de
  ropa*; el pipeline además recorta a cara 112×112 y descarta el torso. Reutilizar
  `faceEmbedding` / `faceMatchThreshold` para alertas de outfit generaría falsos
  negativos sistemáticos. Fase futura (pipeline aparte): `docs/clothing-checkout-alert.md`.
- **La alineación no es opcional.** ArcFace se entrenó sobre recortes deformados a la
  plantilla canónica de InsightFace; sin ese paso la precisión cae de forma notable.
- `detectFacePresence()` es barato (solo TinyFace). `detectFace()` / `detectFaceConsensus()`
  corren ArcFace sobre el mismo fotograma. Si hay cara pero no 5 puntos, `descriptor`
  es null y el UI dice “rostro visible, no se pudo alinear”, no “buscando rostro”.
- `POST /api/face/search`: `empty_gallery` si no hay embeddings; `no_match` si la
  distancia ≥ umbral (incluye `distance` y `candidates`). Umbral default 0.5.
- Loop de cámara: `startFacePresenceLoop` (rAF + candado). No `setInterval` async.
- Kiosco/registro **no** re-embeben fotos al abrir; solo usan `faceEmbedding` ya guardados.
- **Escala de distancias:** coseno, no euclidiana. Los umbrales de la etapa face-api
  (128-D) no son comparables. Centralizados en `src/lib/face-match-threshold.ts`.
- **Assets:** `public/models/w600k_mbf.onnx`, `public/models/face_landmarker.task`,
  `public/mediapipe/wasm/*`, `public/ort/*.wasm`. Regenerar con `pnpm face:setup`.
  Excluidos del precache del SW; cache `face-engine` en runtime.
- **Importar `onnxruntime-web/wasm`, nunca el paquete raíz.** El entry raíz expone una
  condición `node` que Next resuelve en la compilación de servidor y Terser falla al
  minificar ese archivo (`'import' cannot be used outside of module code`).
- **Sin WebGPU:** ese build registra solo `cpu` y `wasm`. MobileFaceNet resuelve en
  decenas de ms en CPU, muy por debajo del intervalo de detección del kiosco. Activarlo
  exigiría importar `onnxruntime-web/webgpu` y servir el binario `*.jsep.wasm` (26 MB
  frente a 13).
- **Licencia pendiente (bloqueante para producción):** los pesos de InsightFace
  (`w600k_mbf`) son *non-commercial research only*. El código del proyecto es MIT, los
  pesos no. El modelo es intercambiable: un archivo `.onnx` y la constante de dimensión.

  **Decisión (2026-08-21):** negociar la licencia comercial de `buffalo_s` con InsightFace
  en vez de cambiar de modelo, porque no toca nada de lo implementado. Borrador del correo
  y plan B en `docs/licencia-modelo-facial.md`.

  Alternativas evaluadas:

  | Opción | Licencia de los pesos | Dim | Tamaño | Navegador |
  |---|---|---:|---:|---|
  | `w600k_mbf` (actual) | No comercial | 512 | 13 MB | Sí |
  | Licencia comercial de InsightFace | Pagada, a negociar | 512 | 13 MB | Sí |
  | [AuraFace-v1](https://huggingface.co/fal/AuraFace-v1) `glintr100` | Apache 2.0, dataset comercial propio | 512 | 261 MB | No, exige mover el embedding al servidor |
  | [FaceX](https://github.com/facex-engine/facex) `xs` | Apache 2.0 declarado | 512 | 8.4 MB | Sí |
  | SFace (OpenCV Zoo) | Apache 2.0 | 128 | ~37 MB | Sí, pero vuelve a 128-D y otra alineación |

  AuraFace es la única con procedencia de datos limpia y declarada, pero es ResNet100:
  no cabe en el navegador y obligaría a un endpoint de embedding con `onnxruntime-node`.
  FaceX es un drop-in exacto por tamaño y dimensión, pero está entrenado sobre
  MS1M-RefineV2, la misma procedencia cuestionada de InsightFace, así que su Apache 2.0
  cubre el código pero no despeja el riesgo del dataset.

**Migración desde face-api 128-D:** `prisma/migrate-arcface-512.sql` (Prisma no diffea
columnas `Unsupported`, el `ALTER TYPE` va ahí). Los vectores viejos no son convertibles;
`/settings/face-migration` los reconstruye desde `Employee.photo` y
`/settings/face-diagnostics` mide distancias reales para calibrar el umbral.

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
│   ├── search/route.ts        # Búsqueda por similitud coseno (pgvector `<=>`)
│   ├── embed/route.ts         # ArcFace server-side (onnxruntime-node, Fase 2)
│   ├── backfill-candidates/route.ts  # Empleados con foto y sin embedding 512-D
│   └── liveness/route.ts      # Anti-spoofing vía OpenRouter
└── v1/                        # API pública con Bearer tokens
    ├── employees/route.ts
    ├── employees/[id]/route.ts
    ├── attendance/route.ts
    ├── branches/route.ts
    └── reports/daily/route.ts
```

## Seguridad

- Contraseñas: `bcryptjs` con salt rounds = 12
- JWT: access token (15min) + refresh token sin `exp` (sesión permanente) en httpOnly cookie (maxAge 10 años)
- Protección de rutas: `src/middleware.ts` valida JWT en cada request a `(dashboard)`
- Datos biométricos: solo se guarda el embedding (vector numérico), nunca la imagen original en producción
- Consentimiento biométrico: `Employee.biometricConsentAt` (timestamp de aceptación)
- Nuevos registros requieren verificación de email con **código de 6 dígitos** (vence en 15 min). `POST /api/auth/register` envía el código por correo; el usuario lo ingresa en `/verify-email` vía `POST /api/auth/verify-email`. Reenvío: `POST /api/auth/resend-verification`. Las cuentas nuevas inician en **plan gratis** (hasta `BillingConfig.freeEmployeeLimit`, default 3 empleados; sin API/MCP), no trial de 7 días.
- Usuarios con `emailVerifiedAt = null` no pueden iniciar sesión.
- `/api/auth/refresh` renueva access token usando cookie `refresh-token`; middleware también renueva access token para navegación de páginas cuando aplica.

## Skills registrados

- `.opencode/skills/update-agents/SKILL.md` — Se activa automáticamente al hacer cambios significativos para mantener este archivo actualizado.

---

## Dependencias instaladas (extra)
- `jose` — JWT en middleware de Next.js (edge runtime; usar `jose` en middleware, `jsonwebtoken` en API Routes)
- `@ducanh2912/next-pwa` v10 — usar en vez de `next-pwa` (mejor compatibilidad con Next.js 14)
- Prisma 5.22 con PostgreSQL; `pgvector` se maneja con `Unsupported("vector(128)")` y SQL crudo para leer/escribir/buscar embeddings
- `onnxruntime-web` — inferencia de ArcFace (512-D) en el navegador; binarios WASM servidos desde `public/ort/`
- `onnxruntime-node` — inferencia de ArcFace en el servidor (`/api/face/embed`, Fase 2); declarado en `experimental.serverComponentsExternalPackages`
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
- **Refresh deslizante:** `/api/auth/refresh` y el middleware renuevan access + refresh. El refresh no vence por tiempo (sin `exp`); la sesión solo termina por logout, desactivación o email sin verificar.
- **Logout:** Siempre llamar `POST /api/auth/logout` antes de limpiar el store — borra las cookies del servidor.
- **Rate limiting:** Usar `rateLimit()` de `src/lib/rate-limit.ts` en todos los endpoints de auth. 10 req/min para login, 5 req/15min para register.
- **Validación server-side:** Todo API route valida con Zod antes de tocar la DB.

## Multi-tenant — reglas críticas

- Todo Server Component que consulte datos DEBE llamar `getServerSession()` y filtrar con `getCompanyFilter(session)` de `src/lib/server-auth.ts`.
- `getCompanyFilter()` devuelve `{}` para `SAAS_SUPER_ADMIN` (ve todo) y `{ companyId }` para todos los demás.
- `getCompanyFilter()` usa `bigint` internamente para Prisma; no exponer ese valor sin serializarlo en respuestas o tokens.
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
- Empresas nuevas inician en **plan gratis**: `plan = "free"`, `subscriptionStatus = "none"`, `subscriptionExpiresAt = null` y `maxEmployees = BillingConfig.freeEmployeeLimit` (default 3). Sin trial de 7 días.
- `src/lib/subscription.ts` centraliza validación de suscripción, cupo de empleados y límite facial; `requirePaidActivePlan` restringe API/MCP a planes pagos activos.
- `src/app/(dashboard)/layout.tsx` redirige empresas vencidas a `/subscription-expired`; `SAAS_SUPER_ADMIN` no se bloquea.
- `/pricing` existe como página pública básica; `/plans` redirige a `/pricing`.
- `PUT /api/employees/[id]` bloquea nuevos registros faciales cuando `faceRegistered` pasa de `false` a `true` o se agrega `faceEmbedding` y ya se alcanzó `maxEmployees`.
- Re-registro facial de empleados que ya tenían rostro sí está permitido aunque el cupo esté lleno.

## Facturación — Cuenti Pay
- **Modelo:** plan gratis (hasta `freeEmployeeLimit` empleados, sin API/MCP) y plan pago **mensual** (COP/USD por empleado, precio en `BillingConfig`, leído desde DB — nunca quemado en UI/landing).
- **Cobro por periodo:** 30 días (`BILLING_PERIOD_DAYS`); addons de nuevos empleados se prorratean sobre el periodo vigente (`src/lib/billing/pricing.ts`).
- **Servicio:** `src/lib/billing/service.ts` (`buildQuote`, `createCheckout`, `cancelPendingInvoice`, `handleBillingWebhook`, `getCompanyBillingStatus`). Máx. 1 factura pendiente por empresa.
- **Cliente HTTP:** `src/lib/billing/cuenti-pay.client.ts` — `createPaymentDocument` (grabarDocumentoSimple) y `voidTransaction` (anularTransacion). Tolera respuestas no-JSON.
- **APIs:** `GET/POST /api/billing` (quote/checkout/invoices), `GET /api/billing/config` (público, consumido por landing), `POST /api/billing/invoices/[invoiceId]/cancel`, webhook público `POST /api/billing/webhook/[codigoUnico]` (valida `x-billing-webhook-secret` opcional), `POST /api/billing/renewal-reminders` (cron, `CRON_SECRET`).
- **Config:** vars `CUENTI_PAY_*` en `src/lib/billing/env.ts`; `codigoUnico` numérico en `src/lib/billing/codigo-unico.ts`. Ver `docs/billing-cuenti-pay.md`.

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
- No usar `JSON.stringify()` directamente sobre resultados Prisma que contengan `bigint`; usar `serializeRecord()` o `bigintReplacer`.
- En formularios Zod con `z.coerce` o `.default()`, usar `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>()` para separar entrada y salida.

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
- [x] Email verification en registro (código 6 dígitos) y login bloqueado para email no verificado; cuentas nuevas en plan gratis
- [x] Refresh token 7 días + access token 15 minutos + endpoint `/api/auth/refresh`
- [x] Suscripción vencida con `/subscription-expired` y `/pricing` pública básica
- [x] Límite `maxEmployees` aplicado solo a nuevos registros faciales
- [x] Geofence de sucursales con lat/lng/radio; GPS obligatorio solo en móvil (`deviceClass`)
- [x] SDD OpenSpec: `branch-form-cleanup` archivado; main spec en `openspec/specs/branch-management/spec.md`
- [x] Marca cuenti time + logos app-work; login minimalista; AuthSessionProvider + refresh deslizante
- [x] Cargo por defecto `general` al crear cuenta/empresa
- [x] `Company.faceMatchThreshold` + deps exactas (`save-exact`) + header sin buscador vacío
- [x] MCP RRHH remoto + webhooks con reintentos/logs (ver secciones abajo)
- [x] Migración de IDs Prisma de cuid a BigInt autoincrement con serialización segura en todos los límites
- [x] Verificación BigInt: helpers 8/8, MCP 29/29, TypeScript y `pnpm build`
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
- [x] Cuenti Pay: `BillingConfig` + `BillingInvoice`, checkout **mensual**, addons prorrateados, webhook, void; landing `/precios` lee DB vía `/api/billing/config` (ver `docs/billing-cuenti-pay.md`)
- [ ] Confirmar IDs reales Cuenti (producto COP/USD, sucursal, consecutivos) y `BILLING_WEBHOOK_SECRET` en producción
- [x] Webhooks outbound: catálogo, HMAC, deliveries, 1+3 reintentos/10min, logs `[webhook]`
- [x] MCP RRHH remoto (HTTP :4101) + tab Integraciones (Claude/ChatGPT first)
- [x] OAuth 2.1 en endpoint MCP (DCR/PKCE/consent) **además** de Bearer `cuenti_`
- [ ] Persistencia OAuth en DB si hay multi-instancia (hoy persiste en archivo local `.data/mcp-oauth-store.json`)
- [ ] Deploy MCP detrás de Cloudflare (`NEXT_PUBLIC_MCP_URL` / `MCP_PUBLIC_URL` HTTPS)
- [ ] Reporte diario por email de tardanzas/ausencias agrupado por turno y sucursal
- [ ] Novedades colectivas por `shiftId` en UI/reportes
- [ ] `/pricing` final conectada a pagos y cálculo de empleados extra
- [ ] Alerta de cambio de prendas entrada vs salida (pipeline aparte de ArcFace; ver `docs/clothing-checkout-alert.md`)
- [ ] Licencia comercial InsightFace `buffalo_s` (o modelo 512-D permisivo) antes de facturar facial

## Quirks Next.js
- `useSearchParams()` debe estar dentro de un componente envuelto en `<Suspense>` (ver `facial-registration/page.tsx`)
- `getCompanyFilter()` retorna `{ companyId }` — NO usar en consultas a `prisma.company` (que filtra por `id`). Usar `{ id: session.companyId }` directamente para Company.
- `z.preprocess()` causa conflicto de tipos con React Hook Form resolver. Usar `.optional().refine()` en su lugar.
- Tras cambiar `schema.prisma`: `pnpm db:generate && pnpm db:push` y **reiniciar** el proceso `next` (el client no hot-reloadea).
- El reset de BigInt ya fue ejecutado en desarrollo y eliminó los datos anteriores; requiere `db:seed` para restaurar las credenciales de prueba.

*Última actualización: 2026-08-29 (noche). Registro facial robusto: multi-template
`FaceTemplate` (frontal + giros, match por mínima distancia), gates de calidad en
enrolamiento (nitidez/luz/pose), anti-duplicados (`excludeEmployeeId`), feedback
visual por etapas. Liveness VLM (Gemini/OpenRouter) FUERA del flujo crítico
(100% fallos en prod, 0 éxitos; era la causa de reintentos). GPS en paralelo con
la marcación. Fase 2: embed dual local→`/api/face/embed` (onnxruntime-node).
Umbrales de distancia relajados (área 0.03, box 90) para detectar a ~1 m.
ArcFace solo para identidad facial; no reutilizar para prendas
(`docs/clothing-checkout-alert.md`). Pendiente: licencia InsightFace comercial.*

*Anterior: 2026-07-20 (noche). Cuenti Pay: plan gratis (default 3 empleados) + plan pago **mensual** COP/USD por empleado, precios/límites leídos desde `BillingConfig` en DB (nunca quemados); checkout/webhook/void + landing dinámica. BigInt autoincrement + serialización de IDs; build verificado; MCP OAuth 2.1 adicional + Bearer; webhooks 1+3×10min; Integraciones Tokens|MCP|Webhooks; deps exactas; faceMatchThreshold; header sin buscador. Dev: `http://localhost:7578`, MCP `:4101`.*
