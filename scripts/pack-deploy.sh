#!/usr/bin/env bash
# Empaqueta el build de producción en tu PC (SaaS + marketing + MCP).
# Los secretos del servidor NUNCA van en el tar (.env de raíz / marketing / mcp).
#
# Build-time (sí se usan en tu PC, NO se suben al tar):
#   .env.production.local
#   packages/marketing/.env.production.local
#
# Uso: bash scripts/pack-deploy.sh [ruta/salida/deploy.tar.gz]
set -euo pipefail

# Node v24 (AGENTS.md) — evita fallos de build con la v18 por defecto
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
nvm use v24.13.1
echo "==> Node $(node -v) | pnpm $(pnpm -v 2>/dev/null || echo '?')"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

require_env_keys() {
  local file="$1"
  shift
  if [ ! -f "$file" ]; then
    echo "Error: falta $file"
    echo ""
    echo "Créalo con las variables de producción. Ejemplo en el .env.example del mismo directorio."
    exit 1
  fi
  local missing=()
  local key
  for key in "$@"; do
    if ! grep -qE "^${key}=.+" "$file"; then
      missing+=("$key")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Error: $file incompleto. Faltan o vacías:"
    for key in "${missing[@]}"; do
      echo "  - $key"
    done
    exit 1
  fi
}

APP_PROD_ENV="$ROOT/.env.production.local"
MKT_PROD_ENV="$ROOT/packages/marketing/.env.production.local"

require_env_keys "$APP_PROD_ENV" NEXT_PUBLIC_APP_URL NEXT_PUBLIC_MCP_URL
require_env_keys "$MKT_PROD_ENV" NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_APP_URL

if grep -qE '^NEXT_PUBLIC_(APP|SITE|MCP)_URL=.*localhost' "$APP_PROD_ENV" "$MKT_PROD_ENV" 2>/dev/null; then
  echo "ADVERTENCIA: algún .env.production.local contiene localhost."
  echo "El build embeberá esas URLs en el cliente. ¿Es intencional?"
  echo ""
fi

echo "==> URLs app SaaS (build-time):"
grep -E '^NEXT_PUBLIC_' "$APP_PROD_ENV" || true
echo ""
echo "==> URLs marketing (build-time):"
grep -E '^NEXT_PUBLIC_' "$MKT_PROD_ENV" || true
echo ""
echo "==> Secretos del servidor (NO se empaquetan; viven solo en el server):"
echo "    .env                              ← DATABASE_URL, JWT_*, Cuenti Pay, SMTP…"
echo "    packages/marketing/.env.local     ← opcional runtime marketing"
echo "    packages/hr-mcp-server/.env       ← DATABASE_URL + MCP_PUBLIC_URL + MCP_ALLOWED_HOSTS (:4101)"
echo ""
echo "==> Apps incluidas en el tar:"
echo "    SaaS (raíz :7578), marketing (:3008), hr-mcp-server (:4101)"
echo "    Nginx: deploy/nginx/cuenti-time*.conf → time / app-time / mcp-time"
echo ""

echo "==> Prisma generate..."
pnpm db:generate

echo "==> Compilando SaaS + marketing + MCP..."
pnpm build
pnpm marketing:build
pnpm mcp:build

# Artefactos esperados tras el build
missing_artifacts=()
for path in \
  .next \
  public \
  prisma/schema.prisma \
  packages/marketing/.next \
  packages/hr-mcp-server/dist/packages/hr-mcp-server/src/http.js \
  packages/hr-mcp-server/dist/packages/hr-mcp-server/src/index.js
do
  if [ ! -e "$path" ]; then
    missing_artifacts+=("$path")
  fi
done
if [ "${#missing_artifacts[@]}" -gt 0 ]; then
  echo "Error: faltan artefactos de build:"
  for p in "${missing_artifacts[@]}"; do
    echo "  - $p"
  done
  exit 1
fi

# Validar que la URL de producción quedó embebida.
# No fallar por menciones de localhost en textos de ayuda (p.ej. Google Maps API key).
PROD_APP_HOST="$(
  grep -E '^NEXT_PUBLIC_APP_URL=' "$APP_PROD_ENV" | head -1 | cut -d= -f2- \
    | tr -d '"' | sed -E 's#https?://##' | cut -d/ -f1
)"
if [ -n "$PROD_APP_HOST" ] && [[ "$PROD_APP_HOST" != localhost* ]] && [[ "$PROD_APP_HOST" != 127.0.0.1* ]]; then
  if ! grep -rqF "$PROD_APP_HOST" .next/static/chunks/ 2>/dev/null; then
    echo ""
    echo "Error: el bundle SaaS no contiene la URL de producción ($PROD_APP_HOST)."
    echo "Revisa .env.production.local y vuelve a compilar."
    exit 1
  fi
  echo "==> Bundle SaaS incluye $PROD_APP_HOST (OK)"
fi
if grep -rqE 'https?://localhost:7578' .next/static/chunks/ 2>/dev/null; then
  echo "aviso: el bundle menciona localhost:7578 (texto de ayuda). No bloquea el pack."
fi

OUTPUT="${1:-$ROOT/deploy.tar.gz}"
chmod +x scripts/server-update.sh scripts/pack-deploy.sh

echo "==> Creando $OUTPUT (sin secretos .env)..."
tar -czf "$OUTPUT" \
  package.json \
  pnpm-workspace.yaml \
  pnpm-lock.yaml \
  ecosystem.config.cjs \
  next.config.mjs \
  postcss.config.mjs \
  tailwind.config.ts \
  tsconfig.json \
  components.json \
  scripts/server-update.sh \
  deploy/nginx \
  prisma/schema.prisma \
  prisma/pgvector.sql \
  prisma/migrate-arcface-512.sql \
  .next \
  public \
  .env.example \
  packages/marketing/.next \
  packages/marketing/public \
  packages/marketing/package.json \
  packages/marketing/next.config.mjs \
  packages/marketing/postcss.config.mjs \
  packages/marketing/tailwind.config.ts \
  packages/marketing/tsconfig.json \
  packages/marketing/.env.example \
  packages/hr-mcp-server/dist \
  packages/hr-mcp-server/package.json \
  packages/hr-mcp-server/.env.example

# Seguridad: el tar no debe incluir secretos
leaked="$(tar -tzf "$OUTPUT" | grep -E '(^|/)\.env($|\.local$|\.production\.local$)' || true)"
if [ -n "$leaked" ]; then
  echo ""
  echo "Error: el tar incluye archivos .env secretos:"
  echo "$leaked"
  rm -f "$OUTPUT"
  exit 1
fi

# Evitar `grep -q` + pipefail (SIGPIPE de tar → falso negativo).
if ! tar -tzf "$OUTPUT" | grep -E '(^|/)packages/hr-mcp-server/dist/packages/hr-mcp-server/src/http\.js$' >/dev/null; then
  echo "Error: el tar no incluye el HTTP del MCP (packages/hr-mcp-server/dist/.../http.js)."
  rm -f "$OUTPUT"
  exit 1
fi

# Motor facial: MediaPipe (detección) + ArcFace ONNX + ORT WASM + SQL 512-D
missing_face=()
for face_path in \
  public/models/w600k_mbf.onnx \
  public/models/face_landmarker.task \
  public/mediapipe/vision_bundle.mjs \
  public/mediapipe/wasm/vision_wasm_internal.wasm \
  public/ort/ort.wasm.bundle.min.mjs \
  public/ort/ort-wasm-simd-threaded.wasm \
  prisma/migrate-arcface-512.sql
do
  if ! tar -tzf "$OUTPUT" | grep -E "(^|/)${face_path}$" >/dev/null; then
    missing_face+=("$face_path")
  fi
done
if [ "${#missing_face[@]}" -gt 0 ]; then
  echo "Error: el tar no incluye assets faciales ArcFace:"
  for p in "${missing_face[@]}"; do
    echo "  - $p"
  done
  echo "Ejecuta: pnpm face:setup"
  rm -f "$OUTPUT"
  exit 1
fi
echo "==> Assets faciales en el tar (MediaPipe + ONNX + ORT + migrate-arcface-512.sql) OK"

echo ""
echo "Contenido .env* en el tar (solo examples, OK):"
tar -tzf "$OUTPUT" | grep -E '\.env' || echo "  (ninguno)"
echo ""
echo "Nginx en el tar:"
tar -tzf "$OUTPUT" | grep 'deploy/nginx/' || echo "  (falta conf)"
echo ""
echo "Listo. Sube por FTP:"
echo "  $OUTPUT"
echo ""
echo "En el servidor:"
echo "  cd /home/ubuntu/app/cuenti-time_compilado"
echo "  # Primera vez:"
echo "  #   cp .env.example .env && nano .env"
echo "  #   cp packages/hr-mcp-server/.env.example packages/hr-mcp-server/.env && nano packages/hr-mcp-server/.env"
echo "  #     → DATABASE_URL (mismo PG), MCP_PUBLIC_URL=https://mcp-time.cuenti.co"
echo "  #     → MCP_ALLOWED_HOSTS=mcp-time.cuenti.co,localhost,127.0.0.1"
echo "  #   Nginx (una vez):"
echo "  #     sudo cp deploy/nginx/cuenti-time.conf /etc/nginx/sites-available/cuenti-time"
echo "  #     sudo cp deploy/nginx/cuenti-time-site.conf /etc/nginx/sites-available/cuenti-time-site"
echo "  #     sudo cp deploy/nginx/cuenti-time-mcp.conf /etc/nginx/sites-available/cuenti-time-mcp"
echo "  #     sudo ln -sf /etc/nginx/sites-available/cuenti-time* /etc/nginx/sites-enabled/"
echo "  #     sudo certbot --nginx -d app-time.cuenti.co -d time.cuenti.co -d mcp-time.cuenti.co"
echo "  bash scripts/server-update.sh"
echo ""
echo "PM2: cuenti-time :7578 | cuenti-time-marketing :3008 | cuenti-time-mcp :4101"
echo "Público: https://app-time.cuenti.co | https://time.cuenti.co | https://mcp-time.cuenti.co/mcp"
