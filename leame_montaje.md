---------- Generar deploy (PC)
cd /home/juandaviddavila/Documentos/fuentes/j4pro/laboratorio_dev_ia/cuenti-time
# Requiere:
#   .env.production.local
#   packages/marketing/.env.production.local
bash scripts/pack-deploy.sh

# Empaqueta: SaaS (.next :7578), marketing (:3008), MCP (:4101)
# NO incluye secretos .env del servidor

-------- actualizar server
cd /home/ubuntu/app/cuenti-time_compilado
# Primera vez: crear .env y packages/hr-mcp-server/.env
bash scripts/server-update.sh
----
pm2 status
# cuenti-time :7578 | cuenti-time-marketing :3008 | cuenti-time-mcp :4101
curl -I http://localhost:7578
curl -I http://localhost:3008
curl http://localhost:4101/health
