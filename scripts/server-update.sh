#!/usr/bin/env bash
# Actualiza la app en el servidor sin pisar .env.
# Uso: bash scripts/server-update.sh [ruta/al/deploy.tar.gz]
#
# Rescata TODOS los .env* del árbol (raíz, packages/),
# excepto plantillas *.example (esas sí vienen del tar).
#
# Servicios PM2: cuenti-time :7578 | cuenti-time-marketing :3008 | cuenti-time-mcp :4101
set -euo pipefail

# Node v24 — pnpm install / prisma generate / next
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
  nvm use v24.13.1
  echo "==> Node $(node -v) | pnpm $(pnpm -v 2>/dev/null || echo '?')"
else
  echo "aviso: no se encontró nvm en $NVM_DIR; se usa el Node del PATH ($(node -v 2>/dev/null || echo '?'))"
fi

APP_DIR="${APP_DIR:-/home/ubuntu/app/cuenti-time_compilado}"
ARCHIVE="${1:-$APP_DIR/deploy.tar.gz}"

PM2_APPS=(cuenti-time cuenti-time-marketing cuenti-time-mcp)

# Descubre secretos .env en el server (relativos a APP_DIR).
# Incluye: .env, .env.local, .env.production, .env.production.local, etc.
# Excluye: .env.example y cualquier *.example
discover_env_files() {
  local found=()
  while IFS= read -r -d '' f; do
    local rel="${f#./}"
    found+=("$rel")
  done < <(
    find . \( -path './.deploy-backup' -o -path './node_modules' -o -path '*/node_modules/*' -o -path '*/.next/*' \) -prune -o \
      -type f \( -name '.env' -o -name '.env.*' \) \
      ! -name '*.example' \
      -print0 2>/dev/null
  )
  if [ -f ./.env ] && [[ ! " ${found[*]} " =~ " .env " ]]; then
    found+=(".env")
  fi
  printf '%s\n' "${found[@]}" | sort -u
}

if [ ! -d "$APP_DIR" ]; then
  echo "Error: no existe $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

if [ ! -f "$ARCHIVE" ]; then
  echo "Error: no se encontró el archivo:"
  echo "  $ARCHIVE"
  echo ""
  echo "Sube deploy.tar.gz por FTP a:"
  echo "  $APP_DIR/deploy.tar.gz"
  exit 1
fi

# Validar que el tar no esté truncado (FTP incompleto es la causa habitual)
archive_size="$(wc -c < "$ARCHIVE" | tr -d ' ')"
if [ "${archive_size:-0}" -lt 1000000 ]; then
  echo "Error: $ARCHIVE es demasiado pequeño (${archive_size} bytes)."
  echo "Probablemente la subida FTP quedó a medias. Vuelve a subir el archivo completo."
  exit 1
fi

echo "==> Verificando integridad de $(basename "$ARCHIVE") (${archive_size} bytes)..."
if ! gzip -t "$ARCHIVE" 2>/dev/null; then
  echo "Error: el archivo gzip está corrupto o incompleto (unexpected EOF)."
  echo ""
  echo "Qué hacer:"
  echo "  1. En tu PC, vuelve a generar: bash scripts/pack-deploy.sh"
  echo "  2. Sube de nuevo el tar completo por FTP (modo binario)."
  echo "  3. Compara tamaños PC vs server:"
  echo "       ls -lh deploy.tar.gz"
  echo "  4. Vuelve a ejecutar: bash scripts/server-update.sh"
  exit 1
fi

if ! tar -tzf "$ARCHIVE" >/dev/null 2>&1; then
  echo "Error: el tar no se puede listar (archivo incompleto o dañado)."
  echo "Vuelve a subir deploy.tar.gz completo en modo binario."
  exit 1
fi

# Evitar `grep -q` con pipefail: al encontrar match cierra el pipe y tar
# sale con 141 (SIGPIPE), lo que marca el pipeline como fallo aunque el
# artefacto sí esté en el tar.
if ! tar -tzf "$ARCHIVE" | grep -E '(^|/)packages/hr-mcp-server/dist/packages/hr-mcp-server/src/http\.js$' >/dev/null; then
  echo "Error: el tar no incluye el HTTP del MCP (packages/hr-mcp-server/dist/.../http.js)."
  echo "Regenera con: bash scripts/pack-deploy.sh"
  exit 1
fi

BACKUP_DIR="$APP_DIR/.deploy-backup"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP_DIR="$BACKUP_DIR/env-$STAMP"
mkdir -p "$ENV_BACKUP_DIR"
MANIFEST="$ENV_BACKUP_DIR/MANIFEST.txt"
: > "$MANIFEST"

echo "==> Descubriendo y respaldando todos los .env*..."
mapfile -t ENV_FILES < <(discover_env_files)

backed_up=0
if [ "${#ENV_FILES[@]}" -eq 0 ] || [ -z "${ENV_FILES[0]:-}" ]; then
  echo "    (ningún .env encontrado aún)"
else
  for rel in "${ENV_FILES[@]}"; do
    [ -z "$rel" ] && continue
    [ ! -f "$rel" ] && continue
    dest="$ENV_BACKUP_DIR/$rel"
    mkdir -p "$(dirname "$dest")"
    cp -a "$rel" "$dest"
    latest="$BACKUP_DIR/env-latest/$rel"
    mkdir -p "$(dirname "$latest")"
    cp -a "$rel" "$latest"
    echo "$rel" >> "$MANIFEST"
    echo "    OK  $rel"
    backed_up=$((backed_up + 1))
  done
fi

mkdir -p "$BACKUP_DIR/env-latest"
cp -a "$MANIFEST" "$BACKUP_DIR/env-latest/MANIFEST.txt"

if [ ! -f .env ] && [ ! -f "$BACKUP_DIR/env-latest/.env" ]; then
  echo ""
  echo "Error: no hay .env en el servidor."
  echo "Créalo antes del deploy (no va dentro de deploy.tar.gz):"
  echo "  cp .env.example .env && nano .env"
  echo "  # mínimo: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, NEXT_PUBLIC_APP_URL"
  exit 1
fi

# Aviso si falta .env del MCP
if [ ! -f packages/hr-mcp-server/.env ] && [ ! -f "$BACKUP_DIR/env-latest/packages/hr-mcp-server/.env" ]; then
  echo "    aviso: no existe packages/hr-mcp-server/.env (necesario para cuenti-time-mcp)"
  echo "           cp packages/hr-mcp-server/.env.example packages/hr-mcp-server/.env && nano packages/hr-mcp-server/.env"
  echo "           # DATABASE_URL + MCP_PUBLIC_URL + MCP_ALLOWED_HOSTS=mcp-time.cuenti.co,..."
fi

[ -f pnpm-lock.yaml ] && cp -a pnpm-lock.yaml "$BACKUP_DIR/pnpm-lock.yaml.bak"

echo "==> Extrayendo $(basename "$ARCHIVE")..."
tar -xzf "$ARCHIVE" -C "$APP_DIR"

echo "==> Restaurando todos los .env respaldados..."
restored=0
LATEST_MANIFEST="$BACKUP_DIR/env-latest/MANIFEST.txt"
if [ -f "$LATEST_MANIFEST" ]; then
  while IFS= read -r rel || [ -n "${rel:-}" ]; do
    [ -z "$rel" ] && continue
    bak="$BACKUP_DIR/env-latest/$rel"
    if [ -f "$bak" ]; then
      mkdir -p "$(dirname "$rel")"
      cp -a "$bak" "$rel"
      chmod 600 "$rel" 2>/dev/null || true
      echo "    restaurado  $rel"
      restored=$((restored + 1))
    fi
  done < "$LATEST_MANIFEST"
fi

# Por seguridad: forzar de nuevo raíz y MCP si existían
if [ -f "$BACKUP_DIR/env-latest/.env" ]; then
  cp -a "$BACKUP_DIR/env-latest/.env" .env
  chmod 600 .env 2>/dev/null || true
fi
if [ -f "$BACKUP_DIR/env-latest/packages/hr-mcp-server/.env" ]; then
  mkdir -p packages/hr-mcp-server
  cp -a "$BACKUP_DIR/env-latest/packages/hr-mcp-server/.env" packages/hr-mcp-server/.env
  chmod 600 packages/hr-mcp-server/.env 2>/dev/null || true
fi

if [ ! -f .env ]; then
  echo "Error: tras el extract sigue faltando .env"
  exit 1
fi

if [ ! -f packages/hr-mcp-server/dist/packages/hr-mcp-server/src/http.js ]; then
  echo "Error: tras el extract falta packages/hr-mcp-server/dist/.../http.js"
  exit 1
fi

# Primera vez MCP: crear .env desde example si aún no hay
if [ ! -f packages/hr-mcp-server/.env ]; then
  if [ -f packages/hr-mcp-server/.env.example ]; then
    cp -a packages/hr-mcp-server/.env.example packages/hr-mcp-server/.env
    chmod 600 packages/hr-mcp-server/.env 2>/dev/null || true
    echo ""
    echo "aviso: creado packages/hr-mcp-server/.env desde .env.example — edítalo ahora:"
    echo "  nano $APP_DIR/packages/hr-mcp-server/.env"
    echo "  # mínimo: DATABASE_URL, MCP_PUBLIC_URL, MCP_ALLOWED_HOSTS"
  else
    echo "Error: falta packages/hr-mcp-server/.env y no hay .env.example en el tar."
    exit 1
  fi
fi

# Validación mínima del .env de la app
missing_keys=()
for key in DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET; do
  if ! grep -qE "^${key}=.+" .env; then
    missing_keys+=("$key")
  fi
done

if [ "${#missing_keys[@]}" -gt 0 ]; then
  echo ""
  echo "Error: .env incompleto. Faltan o están vacías:"
  for k in "${missing_keys[@]}"; do
    echo "  - $k"
  done
  echo "Edita el archivo y vuelve a ejecutar este script:"
  echo "  nano $APP_DIR/.env"
  exit 1
fi

# Validar MCP remoto
mcp_missing=()
for key in DATABASE_URL MCP_PUBLIC_URL MCP_ALLOWED_HOSTS; do
  if ! grep -qE "^${key}=.+" packages/hr-mcp-server/.env; then
    mcp_missing+=("$key")
  fi
done
if [ "${#mcp_missing[@]}" -gt 0 ]; then
  echo ""
  echo "Error: packages/hr-mcp-server/.env incompleto. Faltan o vacías:"
  for k in "${mcp_missing[@]}"; do
    echo "  - $k"
  done
  echo "Edita y vuelve a ejecutar:"
  echo "  nano $APP_DIR/packages/hr-mcp-server/.env"
  echo "Ejemplo:"
  echo "  DATABASE_URL=postgresql://…"
  echo "  MCP_PUBLIC_URL=https://mcp-time.cuenti.co"
  echo "  MCP_ALLOWED_HOSTS=mcp-time.cuenti.co,localhost,127.0.0.1"
  exit 1
fi

if grep -qE '^MCP_PUBLIC_URL=.*localhost' packages/hr-mcp-server/.env; then
  echo "aviso: packages/hr-mcp-server/.env tiene MCP_PUBLIC_URL con localhost (¿OK en este server?)"
fi

db_line="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
db_safe="$(echo "$db_line" | sed -E 's#://[^/@]+@#://***@#')"
mcp_public="$(grep -E '^MCP_PUBLIC_URL=' packages/hr-mcp-server/.env | head -1 | cut -d= -f2-)"
echo ""
echo "==> BD configurada: $db_safe"
echo "==> MCP public URL: $mcp_public"
echo "    Backups de .env: $ENV_BACKUP_DIR ($backed_up archivos)"
echo "    Restaurados: $restored"
if [ -f "$LATEST_MANIFEST" ]; then
  echo "    Manifiesto:"
  sed 's/^/      - /' "$LATEST_MANIFEST"
fi

LOCK_CHANGED=1
if [ -f "$BACKUP_DIR/pnpm-lock.yaml.bak" ] && [ -f pnpm-lock.yaml ]; then
  if cmp -s "$BACKUP_DIR/pnpm-lock.yaml.bak" pnpm-lock.yaml; then
    LOCK_CHANGED=0
  fi
fi

if [ "$LOCK_CHANGED" -eq 1 ]; then
  echo "==> Dependencias nuevas, ejecutando pnpm install --prod..."
  pnpm install --prod
else
  echo "==> Sin cambios en dependencias, saltando install."
fi

echo "==> Prisma generate (cliente)..."
pnpm db:generate

chmod +x scripts/server-update.sh 2>/dev/null || true

# Si llegó la plantilla nginx, recordar instalación (no sobrescribe /etc)
if [ -d deploy/nginx ]; then
  echo "==> Nginx: plantillas en deploy/nginx/"
  echo "    (solo primera vez / si cambió el conf):"
  echo "      sudo cp deploy/nginx/cuenti-time.conf /etc/nginx/sites-available/cuenti-time"
  echo "      sudo cp deploy/nginx/cuenti-time-site.conf /etc/nginx/sites-available/cuenti-time-site"
  echo "      sudo cp deploy/nginx/cuenti-time-mcp.conf /etc/nginx/sites-available/cuenti-time-mcp"
  echo "      sudo ln -sf /etc/nginx/sites-available/cuenti-time /etc/nginx/sites-enabled/"
  echo "      sudo ln -sf /etc/nginx/sites-available/cuenti-time-site /etc/nginx/sites-enabled/"
  echo "      sudo ln -sf /etc/nginx/sites-available/cuenti-time-mcp /etc/nginx/sites-enabled/"
  echo "      sudo nginx -t && sudo systemctl reload nginx"
fi

echo "==> Reiniciando / arrancando servicios PM2..."
if pm2 describe cuenti-time >/dev/null 2>&1; then
  for name in "${PM2_APPS[@]}"; do
    if pm2 describe "$name" >/dev/null 2>&1; then
      pm2 restart "$name"
    else
      echo "    arrancando $name (nuevo en ecosystem)..."
      pm2 start ecosystem.config.cjs --only "$name"
    fi
  done
else
  pm2 start ecosystem.config.cjs
fi

pm2 save 2>/dev/null || true

# Smoke local (no falla el deploy si nginx aún no apunta)
sleep 1
if curl -sf --max-time 3 "http://127.0.0.1:4101/health" >/dev/null 2>&1; then
  echo "==> MCP health OK → http://127.0.0.1:4101/health"
else
  echo "aviso: MCP no responde en :4101/health (revisa pm2 logs cuenti-time-mcp y packages/hr-mcp-server/.env)"
fi

if curl -sf --max-time 3 -o /dev/null -w '' "http://127.0.0.1:7578" >/dev/null 2>&1; then
  echo "==> SaaS responde en :7578"
else
  echo "aviso: SaaS no responde aún en :7578 (revisa pm2 logs cuenti-time)"
fi

echo ""
echo "==> Actualización completa."
echo "    Todos los .env* del server se rescatan (excepto *.example)."
echo "    Para cambiar BD: edita .env (DATABASE_URL) y: pm2 restart cuenti-time cuenti-time-mcp"
echo "    Para MCP: edita packages/hr-mcp-server/.env y: pm2 restart cuenti-time-mcp"
echo "    Puertos: saas:7578 marketing:3008 mcp:4101"
echo "    Público MCP: https://mcp-time.cuenti.co/mcp"
pm2 status
