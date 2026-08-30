#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM_SRC="$ROOT/node_modules/@mediapipe/tasks-vision/wasm"
WASM_DEST="$ROOT/public/mediapipe/wasm"
MODEL_DEST="$ROOT/public/models/face_landmarker.task"
MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

if [ ! -d "$WASM_SRC" ]; then
  echo "Falta @mediapipe/tasks-vision. Ejecuta: pnpm add @mediapipe/tasks-vision"
  exit 1
fi

mkdir -p "$WASM_DEST" "$ROOT/public/models" "$ROOT/public/mediapipe"
cp -f "$WASM_SRC/"* "$WASM_DEST/"
cp -f "$ROOT/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs" \
  "$ROOT/public/mediapipe/vision_bundle.mjs"

if [ ! -f "$MODEL_DEST" ]; then
  echo "Descargando face_landmarker.task..."
  curl -fsSL -o "$MODEL_DEST" "$MODEL_URL"
fi

echo "MediaPipe listo:"
ls -lh "$MODEL_DEST" "$WASM_DEST" | awk '{print $5, $9}'
