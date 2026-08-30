# Session summary — motor facial 2026-08-29

Hilo: detección MediaPipe → rollback TinyFace → duda Fase 2 →
`no_match` intermitente → search al tercer intento. Repo: cuenti-time.
Engram: proyecto `cuenti-time`. Dev: `http://localhost:7578`.

## Hecho

1. **Fase 1 MediaPipe** se implementó y **rompió** detección/enrolamiento:
   `loadModels()` esperaba el WASM; si se colgaba, no había TinyFace ni captura.
2. **Rollback:** TinyFaceDetector + landmark 68 + ArcFace otra vez. MediaPipe
   no se espera ni se usa en el loop. Assets quedan en `public/mediapipe/`.
3. Modal empleados: botón **Capturar ahora**.
4. **Fase 2** (ArcFace en servidor) **solo diseño**. No se instaló
   `onnxruntime-node` (store pnpm de solo lectura en el sandbox). Ver
   `openspec/changes/arcface-server-phase-2/`.
5. **Search intermitente:** se detectaba un frame y se embebia otro →
   distancia 0.42 vs ≥0.5. Luego se promediaron 3 frames sucios y el primer
   `/api/face/search` fallaba; acertaba el tercero.
6. **Estado actual:** mismo canvas para detectar+embeber; `detectFaceConsensus`
   espera 2 embeddings locales parecidos (≤0.2) y **un solo** search.
   `FACE_STABLE_HITS = 3`. Search distingue `empty_gallery` vs `no_match`
   (con `distance` + `candidates`).

## Pipeline vigente

TinyFace presencia (~200 ms) → 3 hits estables → “Confirmando rostro…”
(2 embeddings locales quietos) → **un** `POST /api/face/search` →
liveness OpenRouter (4 s) → marcación / enrolar.

- Empresa: siempre desde JWT (`getCompanyFilter`). Super admin ve todas.
- Sucursal: solo si el body trae `branchId` (kiosco sí; `/facial-registration` no).
- Umbral default 0.5 coseno; techo duro 0.55. Mismos embeddings 512-D.

## Cómo probar

1. Ctrl+F5 (si overlay “Cargando modelos…”, reiniciar `pnpm dev`).
2. Re-enrolar a quien se enroló con el promedio de 3 frames sucios.
3. Cara grande en el óvalo, quieto ~1 s. Network: **una** llamada a search.
4. Si `no_match`, leer `distance`. Si `empty_gallery`, no hay embedding.

## Engram (topic_key)

- `sdd/mediapipe-face-detect/design`
- `sdd/mediapipe-face-detect/bugfix-enroll`
- `sdd/mediapipe-face-detect/fase-2`
- `sdd/arcface-server-phase-2/design`
- `sdd/face-search/intermittent-no-match`
- `sdd/face-search/first-call-should-match`
- `sdd/face-search/tenant-filters`
- `sdd/face-pipeline/current-2026-08-29`

## Changes OpenSpec

- `openspec/changes/mediapipe-face-detect/`
- `openspec/changes/arcface-server-phase-2/` (diseño, sin código)
- `openspec/changes/face-identify-stability/`
