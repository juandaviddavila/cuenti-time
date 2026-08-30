# Tasks: Registro facial v2

## Datos
- [x] T-001 Seed sin `faceRegistered` fantasma; asistencia por ACTIVE
- [x] T-002 Modelo `FaceTemplate` en schema.prisma + `db:push`
- [x] T-003 `prisma/backfill-face-templates.sql` idempotente + ejecutar en prod
- [x] T-004 `/api/face/search` por MÍNIMA distancia + `excludeEmployeeId`
- [x] T-005 PUT empleados: `faceTemplates` + reemplazo en transacción (retrocompat)

## Calidad + UX de enrolamiento
- [x] T-006 `src/lib/ai/face-quality.ts` (nitidez, luminancia, roll, yaw)
- [x] T-007 `captureManualTemplate` (captura manual con gate; reemplaza el auto por etapas)
- [x] T-008 Enrolamiento MANUAL por pasos: front/izq/der con botón Capturar/Repetir/Omitir/Guardar en dialog
- [x] T-009 Anti-duplicados (`findDuplicateEnrollment`) en dialog y facial-registration
- [x] T-010 Gate antes que embed: `detectAndAlignFace` + embed solo si pasa gates

## Agilidad
- [x] T-011 Liveness fuera del flujo crítico (kiosco, registro, dialog)
- [x] T-012 GPS en paralelo con la última marcación
- [x] T-013 Umbrales de distancia relajados (área 0.03, box 90, presencia 60, score 0.45)
- [x] T-014 Presencia sin landmarks a 300 ms (`withLandmarks:false`)

## Fase 2 (embed server-side)
- [x] T-015 `onnxruntime-node@1.27.0` + `allowBuilds` + `serverComponentsExternalPackages`
- [x] T-016 `src/lib/ai/arcface-server.ts` (singleton, tensor NCHW, misma normalización)
- [x] T-017 `POST /api/face/embed` (rate limit, Zod literal 112, requireSession)
- [x] T-018 Embed dual en `embedFromAligned` + `loadModels` no bloqueante
- [x] T-019 AGENTS.md documentado

## Pendientes
- [ ] T-020 Probar en kiosco/tablet real (agilidad + fallback servidor)
- [ ] T-021 Re-enrolar empleados para generar múltiples plantillas (frontal + giros)
- [x] T-022 Deploy a app-time.cuenti.co (pack-deploy + server-update) — verificado 401/200
