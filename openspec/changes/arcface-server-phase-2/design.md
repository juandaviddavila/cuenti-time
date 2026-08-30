# Design: ArcFace en servidor (Fase 2)

## Goal

Bajar carga del kiosco/tablet manteniendo el mismo vector 512-D y los mismos
umbrales. El navegador detecta y recorta el rostro; el servidor corre ArcFace
con `onnxruntime-node`.

## Approach

### Backend

1. Nuevo API route **público** `POST /api/face/embed`.
   - Acepta un body `{ imageDataUrl: string }` (JPEG Base64 de la foto completa)
     o `{ cropDataUrl: string }` (canvas 112×112 ya alineado).
   - Si recibe foto completa:
     - Detecta rostro con face-api (TinyFaceDetector + landmarks 68) usando el
       modelo en disco.
     - Alinea a 112×112 con `face-align.ts`.
   - Si recibe crop ya alineado, lo usa directamente.
   - Convierte el canvas a tensor NCHW RGB y corre `w600k_mbf.onnx` vía
     `onnxruntime-node`.
   - Devuelve `{ descriptor: number[], normalized: true }`.

2. Modelo y runtime en el servidor.
   - Dependencia: `onnxruntime-node@1.27.0` (igual versión que `onnxruntime-web`).
   - Modelo: `public/models/w600k_mbf.onnx` se resuelve con `path.join(process.cwd(),
     "public", "models", "w600k_mbf.onnx")`.
   - Sesión singleton con cache; primer llamado calienta el modelo.

3. Seguridad / límites.
   - Sin autenticación de usuario (el kiosco es público), pero con:
     - Rate limiting por IP: 30 req/min.
     - Tamaño máximo de imagen: 2 MB.
     - Validación Zod del Data URL.
   - No recibe `companyId` ni `branchId`; solo devuelve el vector. La búsqueda en
     pgvector sigue en `POST /api/face/search` con sesión.

### Frontend

1. `face-api-service.ts` crea una función dual:
   - `embedDetectedFace(video, fivePoints)`: primero intenta ArcFace WASM local
     (`embedFaceFromFivePoints`).
     - Si falla o no está cargado, envía un crop 112×112 al servidor y recibe el
       descriptor.
     - Nunca envía la foto completa a menos que sea el fallback de seguridad.
   - `loadModels()` ya no espera ArcFace WASM; solo TinyFaceDetector es crítico.
     ArcFace local carga en background si puede.

2. Kiosco y registro facial.
   - Sigue usando `detectFacePresence` (TinyFace) para el óvalo verde.
   - Cuando la cara es estable, alinea localmente a 112×112 y prefiere:
     1. ArcFace WASM local (rápido, sin red).
     2. `POST /api/face/embed` con el crop alineado (fallback).
   - El resultado es un descriptor 512-D idéntico al de antes; el resto del flujo
     (liveness, `/api/face/search`, marcación) no cambia.

### Datos

- Embeddings en `pgvector` no cambian: siguen siendo 512-D de ArcFace.
- `face-migration` y `face-diagnostics` siguen válidos.
- Licencia InsightFace sigue siendo el mismo cuello de botella.

## Files

| Archivo | Cambio |
|---|---|
| `package.json` | agregar `onnxruntime-node@1.27.0` |
| `src/app/api/face/embed/route.ts` | nuevo endpoint |
| `src/lib/ai/arcface-server.ts` | sesión ArcFace con onnxruntime-node |
| `src/lib/ai/face-api-service.ts` | embed dual: local → servidor |
| `src/lib/rate-limit.ts` | rate limit por IP para `/api/face/embed` |
| `src/app/kiosk/kiosk-content.tsx` | usa embed dual, sin cambios grandes |
| `src/components/shared/employee-face-registration-dialog.tsx` | usa embed dual |
| `src/app/(dashboard)/facial-registration/facial-registration-content.tsx` | usa embed dual |
| `AGENTS.md` | documentar Fase 2 |
| `openspec/changes/arcface-server-phase-2/` | proposal + design + tasks |
| `scripts/pack-deploy.sh` | incluir onnxruntime-node en install server |

## Tradeoffs

- Pro: menos descarga en kiosco (~26 MB de ONNX/WASM ya no van al navegador si
  se desactiva el cliente), menos calor en tablet, posibilidad futura de modelos
  grandes (AuraFace) que no caben en navegador.
- Contra: más carga de red por cada identificación (enviar crop + recibir
  descriptor), latencia de ida y vuelta, servidor necesita CPU/memoria para
  ArcFace.
- No mejora precisión; mejora operabilidad en dispositivos débiles.

## When to implement

Solo si en tablet/kiosco real se mide que ArcFace WASM local es lento o inestable
con el flujo actual. Antes de eso, la demora percibida suele ser liveness
(OpenRouter, hasta 4 s).
