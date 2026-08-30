# Tasks: ArcFace en servidor (Fase 2)

- [ ] T-001 Instalar `onnxruntime-node@1.27.0` y verificar carga del modelo en servidor
- [ ] T-002 Crear `src/lib/ai/arcface-server.ts` con sesión singleton y tensor NCHW
- [ ] T-003 Crear `POST /api/face/embed` con rate limiting, validación Zod y soporte foto/crop
- [ ] T-004 Actualizar `face-api-service.ts` con embed dual (local → servidor)
- [ ] T-005 Actualizar kiosco, registro facial y modal para usar embed dual
- [ ] T-006 Actualizar `AGENTS.md` y documentación de deploy
- [ ] T-007 Verificar `pnpm build` y probar en kiosco/tablet real
