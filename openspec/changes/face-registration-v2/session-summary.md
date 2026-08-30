# Session summary: Registro facial v2 + sesión permanente + deploy

## Resumen
Registro/reconocimiento facial estabilizado de punta a punta y desplegado a producción.

## Causas raíz resueltas
- `empty_gallery` real: seed con `faceRegistered` fantasma (sin embedding) + cupo free bloqueado.
- Distance 0.83 para "la misma persona" = ENROLAMIENTO corrupto, no pipeline (verificado en DB:
  misma persona = 0.008, distintas = 0.84–1.05).
- Liveness VLM (Gemini) = 100% fallos en prod → fuera del flujo crítico.
- Bloqueo de navegador → loop de presencia sin landmarks a 300 ms.

## Implementado
- Multi-template `FaceTemplate` + search por mínima distancia + backfill (14 plantillas).
- Gates de calidad + enrolamiento MANUAL por pasos (frente/izq/der con botón) + anti-duplicados.
- Fase 2: `POST /api/face/embed` (onnxruntime-node) + embed dual local→servidor.
- Sesión permanente: refresh JWT sin `exp` + cookie 10 años.
- Umbrales de distancia relajados, GPS paralelo, gate antes que embed.

## Deploy
pack-deploy → scp (pem chatti.chat.pem) → server-update.sh en 32.186.145.119.
Verificado: face/embed 401, face/search 401, MCP /health 200, /login 200.

## Pendiente
- T-020 kiosco/tablet real · T-021 re-enrolar para múltiples plantillas
- permanent-session T-010 (smoke real de refresh)