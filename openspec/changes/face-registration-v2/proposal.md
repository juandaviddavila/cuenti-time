# Proposal: Registro facial v2 (robusto, ágil y medible)

## Problem

El registro/reconocimiento facial fallaba en producción por causas encadenadas:

1. `empty_gallery` real: el seed marcaba empleados con `faceRegistered: true` sin
   embedding ni foto → galería vacía y cupo del plan gratis consumido por rostros
   fantasma; el enrolamiento nuevo quedaba bloqueado por 402.
2. Liveness VLM (Gemini vía OpenRouter) en el camino crítico: 30/30 logs de
   `FaceValidationLog` en prod eran fallos (LOW_CONFIDENCE / SPOOFING_DETECTED /
   LIVENESS_FAILED), 0 éxitos; cada marcación sumaba 1-4 s y rechazaba personas reales.
3. Detección exigía pegar la cara a la cámara (área ≥7 % del frame ≈ 250 px en 720p).
4. Un solo template por empleado → match frágil ante cambio de luz/ángulo.
5. Enrolamiento sin gates de calidad (guardaba frames borrosos/oscuros/girados) y
   sin anti-duplicados (dos identidades para la misma persona).
6. El navegador se bloqueaba en `/facial-registration`: el loop de presencia corría
   68 landmarks cada 200 ms en el hilo principal, más la carga de ArcFace WASM en
   paralelo.
7. Embedding ArcFace calculado antes que los gates: se desperdiciaba en cada frame
   rechazado (la op más cara del cliente).

## Goal

Registro y marcación ágiles (~1-2 s), templates robustos (frontal + giros, match por
mínima distancia), enrolamiento con calidad garantizada y sin duplicados, y embedding
server-side como fallback (Fase 2). Sin cambiar el vector 512-D ni los umbrales de
match del servidor.

## Scope

In:
- Seed honesto: `faceRegistered: false` sin embedding; asistencia sembrada por ACTIVE.
- Liveness fuera del flujo crítico (kiosco, registro y dialog); `/api/face/liveness`
  queda disponible pero sin callers.
- GPS en paralelo con la última marcación (no suma latencia).
- Umbrales de distancia: área 0.07→0.03, box 110→90, presencia box 70→60, score 0.5→0.45.
- Gates de calidad en enrolamiento (`face-quality.ts`): nitidez Laplaciano ≥40,
  luminancia 35-225, roll ≤15°, yaw frontal ≤0.16 / giro ≥0.08.
- Feedback visual por etapas ("Frontal 2/3 — muy oscuro", giros).
- `FaceTemplate` (1-N por empleado) + search por MÍNIMA distancia + backfill.
- Enrolamiento por etapas: frontal 3 muestras + giro izq/der 2 c/u (se omiten solos).
- Anti-duplicados: `excludeEmployeeId` en `/api/face/search` + `findDuplicateEnrollment`.
- Fase 2: `POST /api/face/embed` (onnxruntime-node) + embed dual local→servidor.
- Presencia sin landmarks (solo caja) a 300 ms; landmarks/ArcFace solo al identificar.
- Gate antes que embed en `collectStage` (detect+align+gates → embed solo si pasa).

Out:
- Cambiar modelo/dimensión (sigue w600k_mbf 512-D).
- Anti-spoofing real (fase futura con modelo dedicado).
- `/api/face/descriptors` multi-template (queda con vector frontal; solo fallback).

## Success

- Kiosco marca en ~1-2 s sin pegar la cara (≈1 m).
- Enrolamiento guarda hasta 3 plantillas; reintentos muestran el motivo del rechazo.
- Enrolar un rostro ya existente en OTRO empleado bloquea con el nombre del duplicado.
- `/api/face/search` matchea por mínima distancia entre plantillas.
- Navegador fluido en `/facial-registration` (presencia sin landmarks).
- `tsc --noEmit`, `next lint` y `pnpm build` en verde.
