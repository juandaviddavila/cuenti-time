# Proposal: ArcFace en servidor (Fase 2)

## Problem

El kiosco/tablet baja ~26 MB de ONNX + WASM de ORT y corre ArcFace en el
navegador. En dispositivos baratos esto puede ser lento o calentar el equipo.

## Goal

Mover solo el embedding ArcFace al servidor. El navegador sigue detectando y
alineando el rostro; el servidor devuelve el descriptor 512-D. Sin cambiar
pgvector, umbrales ni embeddings existentes.

## Scope

In:
- Endpoint `POST /api/face/embed` (público, rate-limited).
- `onnxruntime-node@1.27.0` + `w600k_mbf.onnx` en servidor.
- Cliente dual: ArcFace WASM local primero, servidor como fallback.
- Kiosco y registro facial usan embed dual.

Out:
- Cambiar detector (se queda TinyFaceDetector en cliente).
- Cambiar modelo o dimensión.
- Eliminar ArcFace WASM del navegador (se mantiene como primera opción).

## Success

- Kiosco en tablet arranca sin descargar ONNX/WASM.
- Identificación sigue devolviendo el mismo vector 512-D.
- Fallback local funciona si el servidor no responde.
- `pnpm build` y `tsc --noEmit` pasan tras instalar `onnxruntime-node`.
