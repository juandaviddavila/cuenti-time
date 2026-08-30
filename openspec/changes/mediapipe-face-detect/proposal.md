# Proposal: MediaPipe para detectar rostro (Fase 1)

## Problem

El kiosco y el registro facial usaban TinyFaceDetector + ArcFace en **cada** tick
(`setInterval` 800–1000 ms × 3 hits). Si fallaba la alineación o el ONNX, la UI
decía “Buscando rostro…” aunque hubiera cara. Además, al abrir el kiosco se
re-embebian todas las fotos de la sucursal.

## Goal

Separar **encontrar cara** de **quién es**: MediaPipe Face Landmarker en el
navegador; ArcFace 512-D solo con cara estable. Mismos embeddings y umbrales.

## Scope

**In**
- MediaPipe Tasks Vision (self-hosted WASM + `face_landmarker.task`)
- Loop rAF con candado (~200 ms, 2 hits)
- Mensajes: sin rostro / detectado / no alineable / buscando identidad
- Quitar backfill de fotos al abrir kiosco/registro
- Timeout 4 s en liveness cliente

**Out**
- Fase 2 (ArcFace en servidor)
- Cambiar dimensión 512 o Gemini embeddings
- Licencia InsightFace

## Success

- La cámara reporta cara sin esperar a ArcFace
- Identidad solo tras 2 frames estables
- `pnpm face:setup` deja assets MediaPipe + ArcFace
