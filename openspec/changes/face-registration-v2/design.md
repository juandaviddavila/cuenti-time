# Design: Registro facial v2

## Datos

### FaceTemplate (nuevo modelo)

```prisma
model FaceTemplate {
  id         BigInt   @id @default(autoincrement())
  employeeId BigInt
  label      String?          // frontal | left | right
  createdAt  DateTime @default(now())
  embedding  Unsupported("vector(512)")?
  employee   Employee @relation(...)
  @@index([employeeId])
}
```

- `Employee.faceEmbedding` se conserva como vector frontal (compat con
  `/api/face/descriptors`, face-migration y face-diagnostics).
- Backfill idempotente: `prisma/backfill-face-templates.sql` (una fila 'frontal'
  por empleado con embedding y sin plantillas).
- El PUT `/api/employees/[id]` acepta `faceTemplates: number[][]` (1-3 de 512) y
  reemplaza plantillas en la misma transacción (DELETE + INSERT con labels
  frontal/left/right). Sin `faceTemplates` pero con `faceEmbedding`, escribe una
  sola plantilla frontal (retrocompat).

### Search por mínima distancia

```sql
SELECT e."id"::text, ..., MIN(t."embedding" <=> $q) AS distance
FROM "FaceTemplate" t
JOIN "Employee" e ON e.id = t.employeeId
WHERE e.status='ACTIVE' [AND companyId] [AND branchId] [AND t.employeeId <> $excl]
  AND t.embedding IS NOT NULL
GROUP BY e.id, ...
ORDER BY "distance" LIMIT 2
```

El match queda robusto: basta que CUALQUIER plantilla (frontal o giro) se acerque
al query. `excludeEmployeeId` habilita el anti-duplicados sin auto-match.

## Cliente

### Gates de calidad (`src/lib/ai/face-quality.ts`)

Sobre el canvas alineado 112×112 + los 5 puntos:
- `measureSharpness`: varianza del Laplaciano (4-vecinos) ≥ 40.
- `measureLuminance`: media gris 35-225.
- `measureRollDeg`: ángulo de la línea de ojos ≤ 15°.
- `measureYawAsymmetry`: `(dLeft-dRight)/(dLeft+dRight)`; frontal |a|≤0.16;
  giro izquierda a≥0.08, derecha a≤-0.08 (semántica anatómica, invariante al espejo).

### Enrolamiento por etapas (`captureEnrollmentTemplates`)

- `collectStage(frontal, 3, 6s)` → `collectStage(left, 2, 3.5s)` → `right`.
  Cada etapa se omite si no junta muestras válidas en su budget.
- **Gate antes que embed**: `detectAndAlignFace()` (detect+align, SIN embed) →
  `evaluateAlignedFace` → solo si pasa, `embedFromAligned` → outlier-check
  (coseno > 0.35 vs capturadas). Caso "gates OK + embed falla": reintento con
  mensaje propio.
- Outliers y muestras inválidas no entran; el promedio de la etapa = plantilla.
- `onProgress({stage, samples, target, issue})` → `enrollmentStageLabel` en UI.

### Embed dual (Fase 2)

- `embedFromAligned`: ArcFace WASM local si está cargado; si no o si falla,
  `embedViaServer` (crop RGBA base64 112×112 → `POST /api/face/embed`).
- `loadModels()` solo exige el detector; ArcFace WASM carga en background
  (`void loadArcFaceModel().catch(...)`).
- Servidor: `src/lib/ai/arcface-server.ts` (sesión singleton onnxruntime-node,
  misma normalización (px-127.5)/127.5 + L2 → vectores comparables).
- `next.config.mjs`: `serverComponentsExternalPackages: ["onnxruntime-node"]`.
- `pnpm-workspace.yaml`: `allowBuilds.onnxruntime-node: true` (postinstall nativo).

### Presencia barata

- `detectFacePresence` → `detectWithFaceApi({ withLandmarks: false })`: solo caja
  TinyFace. Landmarks/ArcFace recién en `detectFace`/`detectFaceConsensus`.
- `FACE_PRESENCE_MIN_INTERVAL_MS` 200→300.

### Flujos sin liveness

- Kiosco, `/facial-registration` y dialog ya no llaman `checkLiveness`; la marcación
  sigue a `/api/attendance` sin `livenessScore` (campo optional). GPS corre en
  paralelo con `fetchLastAttendanceRecord`.

## Tradeoffs

- Multi-template: más filas por empleado y GROUP BY en cada search; a esta escala
  (decenas-empleados por empresa) es despreciable y el ivfflat no aplica al GROUP BY
  (scan acotado por empresa).
- Gate antes que embed: rechazos por outlier siguen pagando el embed (necesitan el
  descriptor); los rechazos por gates (mayoría en malas condiciones) no.
- Sin liveness: sin anti-spoofing activo; aceptado como decisión de producto
  (kiosco supervisado); fase futura con modelo dedicado.

## Archivos

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | modelo `FaceTemplate` + relación |
| `prisma/backfill-face-templates.sql` | nuevo |
| `prisma/seed.ts` | seed sin rostros fantasma |
| `src/app/api/face/search/route.ts` | min distancia + `excludeEmployeeId` |
| `src/app/api/employees/[id]/route.ts` | `faceTemplates` + reemplazo en tx |
| `src/app/api/face/embed/route.ts` | nuevo (rate limit, Zod literal 112, sesión) |
| `src/lib/ai/arcface-server.ts` | nuevo |
| `src/lib/ai/face-quality.ts` | nuevo |
| `src/lib/ai/face-api-service.ts` | etapas, gate-before-embed, embed dual, presencia sin landmarks, `detectAndAlignFace` |
| `src/lib/ai/face-detection-loop.ts` | 300 ms |
| kiosco / facial-registration / dialog | sin liveness, feedback, templates, duplicados, GPS paralelo |
| `next.config.mjs`, `pnpm-workspace.yaml` | onnxruntime-node |
