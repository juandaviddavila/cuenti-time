# Session summary — Fase 2 ArcFace servidor (2026-08-29)

## Hecho

Solo **diseño**. El usuario pidió implementar; el sandbox no pudo
`pnpm add onnxruntime-node@1.27.0` (store pnpm de solo lectura). El usuario
eligió documentar el diseño y no escribir el código a medias.

## Para implementar (otra máquina / terminal con store escribible)

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v24.13.1
pnpm add onnxruntime-node@1.27.0 -w
```

Luego `tasks.md` T-001…T-007.

## Engram

- `sdd/mediapipe-face-detect/fase-2`
- `sdd/arcface-server-phase-2/design`
- Proyecto: `cuenti-time`
