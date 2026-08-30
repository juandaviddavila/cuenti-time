# Design: MediaPipe face detect (Fase 1)

## Approach

1. **Detección en caliente: TinyFaceDetector + landmark 68** (face-api).
   MediaPipe Fase 1 rompió detección/enrolamiento: la carga WASM bloqueaba
   `loadModels()` y el loop no tenía respaldo.
2. MediaPipe queda en `mediapipe-face.ts` (IMAGE + CPU, timeout 8 s) pero
   **no** se espera ni se usa en `detectFacePresence`.
3. `face-detection-loop.ts`: `requestAnimationFrame` + busy lock; presencia
   vía face-api (snapshot de video → canvas).
4. Enrolar / identificar: `detectFaceConsensus` (par estable), no JPEG ni
   promedio de frames sucios. Detalle en `openspec/changes/face-identify-stability/`.
5. ArcFace 512-D solo con 5 puntos. Search: `/api/face/search`
   (empresa por JWT; sucursal solo si `branchId`).

## Assets

- `/models/face_landmarker.task`
- `/mediapipe/wasm/*` (copia de `node_modules/@mediapipe/tasks-vision/wasm`)
- Middleware deja pasar `/mediapipe/` y extensión `.task`

## Risks

- Import de `@mediapipe/tasks-vision` en Next 14: solo cliente, WASM self-hosted.
- Timestamps VIDEO deben ser monótonos (`lastVideoTimestamp`).
- Plantillas ya enroladas con face-api 68 pts siguen válidas (mismo ArcFace 512-D).
