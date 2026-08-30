# Tasks: ArcFace en servidor (Fase 2)

- [x] T-001 Instalar `onnxruntime-node@1.27.0` y verificar carga del modelo en servidor
- [x] T-002 Crear `src/lib/ai/arcface-server.ts` con sesión singleton y tensor NCHW
- [x] T-003 Crear `POST /api/face/embed` con rate limiting, validación Zod y soporte crop alineado RGBA base64
- [x] T-004 Actualizar `face-api-service.ts` con embed dual (local → servidor)
- [x] T-005 Actualizar kiosco, registro facial y modal para usar embed dual (heredado: todos usan `embedDetectedFace`)
- [x] T-006 Actualizar `AGENTS.md` y documentación de deploy
- [ ] T-007 Probar en kiosco/tablet real (fallback servidor ante WASM débil)
