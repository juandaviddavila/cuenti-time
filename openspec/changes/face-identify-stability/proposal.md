# Proposal: Identidad estable (un solo search)

## Problem

`/api/face/search` devolvía `no_match` (threshold 0.5) en los primeros
intentos y acertaba al tercero con la misma persona. Promediar 3 frames
(movidos + uno bueno) ensuciaba el primer probe.

## Goal

Llamar a search **una vez**, con un embedding tomado cuando la cara ya
está quieta. Mismo modelo 512-D, mismos umbrales, mismo pgvector.

## Scope

In:
- Detectar y embeber el mismo canvas.
- `detectFaceConsensus`: 2 embeddings locales seguidos con distancia ≤ 0.2.
- Cara grande (≥7 % del frame, box ≥ 110 px) y score TinyFace ≥ 0.5 para identidad.
- Search: `empty_gallery` vs `no_match` + `distance` + log `[face/search]`.
- Cooldown si el único search falla (no spamear 3 llamadas).

Out:
- Fase 2 servidor, MediaPipe en el loop, cambiar umbral 0.5, Gemini embeddings.

## Success

- Network: una llamada a `/api/face/search` por identificación.
- Misma persona enrolada de frente: `reason: match` y `distance` &lt; 0.45.
