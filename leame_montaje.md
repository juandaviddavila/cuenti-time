---------- Generar deploy (PC)
cd /home/juandaviddavila/Documentos/fuentes/j4pro/pequenas_apps/cuenti-time
# Requiere:
#   .env.production.local
#   packages/marketing/.env.production.local
#   public/models/w600k_mbf.onnx + public/ort/*  (pnpm face:setup)
bash scripts/pack-deploy.sh

# Empaqueta: SaaS (.next :7578), marketing (:3008), MCP (:4101)
# + modelos faciales (ONNX ArcFace, WASM ort, face-api detect/landmarks)
# + prisma/migrate-arcface-512.sql
# NO incluye secretos .env del servidor

-------- actualizar server
cd /home/ubuntu/app/cuenti-time_compilado
# Primera vez: crear .env y packages/hr-mcp-server/.env
bash scripts/server-update.sh
# Tras migrar a ArcFace 512-D (una vez):
#   pnpm exec prisma db execute --file prisma/migrate-arcface-512.sql --schema prisma/schema.prisma
# Luego backfill en https://app-time.cuenti.co/settings/face-migration
----
pm2 status
# cuenti-time :7578 | cuenti-time-marketing :3008 | cuenti-time-mcp :4101
curl -I http://localhost:7578
curl -I http://localhost:3008
curl http://localhost:4101/health
curl -I http://localhost:7578/models/w600k_mbf.onnx
curl -I http://localhost:7578/ort/ort-wasm-simd-threaded.wasm
