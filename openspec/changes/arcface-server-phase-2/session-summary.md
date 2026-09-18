# Session summary — Fase 2 ArcFace servidor (2026-08-29)

## Hecho (ese día)

Solo **diseño**. El usuario pidió implementar; el sandbox no pudo
`pnpm add onnxruntime-node@1.27.0` (store pnpm de solo lectura). El usuario
eligió documentar el diseño y no escribir el código a medias.

## Addendum (después, face-registration-v2)

El código **sí se implementó**: `onnxruntime-node@1.27.0`, `arcface-server.ts`,
`POST /api/face/embed`, embed dual local→servidor. Tasks T-001–T-006 done.
Falta T-007 (probar en kiosco/tablet real).

## Engram

- `sdd/mediapipe-face-detect/fase-2`
- `sdd/arcface-server-phase-2/design` (estado vigente: código hecho)
- `sdd/handoff/other-agent-2026-08-29` (hilo histórico)
- Proyecto: `cuenti-time`
