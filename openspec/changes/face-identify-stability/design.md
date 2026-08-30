# Design: Identidad estable (un solo search)

## Approach

1. `detectFace(video)`: snapshot → TinyFace+68 (score ≥ 0.5, box ≥ 110 px) →
   ArcFace sobre **ese** canvas. Nunca landmarks de un frame y warp de otro.
2. `detectFaceConsensus(video)`:
   - Hasta 8 muestras / 1.4 s.
   - Descarta cara chica (área &lt; 7 % del frame).
   - Si dos embeddings seguidos tienen distancia coseno ≤ 0.2, promedia
     **solo esos dos** y devuelve.
   - Si no hay par estable, usa el frame de mayor calidad (área − penalidad
     de descentrado). No promedia frames sucios con uno bueno.
3. Loop: `FACE_STABLE_HITS = 3`, luego “Confirmando rostro…”, luego **un**
   `POST /api/face/search`. Si falla: cooldown 900 ms, no tres searches seguidos.
4. API search:
   - Empresa: JWT (`getCompanyFilter`). Super admin sin filtro de empresa.
   - Sucursal: solo si `branchId` en body (kiosco sí; registro facial no).
   - `empty_gallery` si 0 filas; `no_match` si distancia ≥ umbral (incluye
     `distance` y `candidates`). Log `[face/search]`.

## Files

| Archivo | Rol |
|---|---|
| `src/lib/ai/face-api-service.ts` | detectFace mismo frame + consensus estable |
| `src/lib/ai/face-detection-loop.ts` | rAF, 200 ms, 3 hits |
| `src/app/api/face/search/route.ts` | tenant + empty_gallery + distance |
| `src/app/kiosk/kiosk-content.tsx` | un search; cooldown si falla |
| `src/app/(dashboard)/facial-registration/facial-registration-content.tsx` | igual |
| `src/components/shared/employee-face-registration-dialog.tsx` | enrolar con consensus |

## Risks

- Plantillas enroladas con el promedio sucio de 3 frames hay que **re-enrolar**.
- Si la cara nunca se queda quieta, no hay search (mensaje “Acerque la cara…”).
- Kiosco + sucursal equivocada → `empty_gallery` aunque el empleado exista.
