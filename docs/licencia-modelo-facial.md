# Licencia del modelo de reconocimiento facial

**Estado:** pendiente de respuesta de InsightFace. Bloqueante para producción.

## El problema

El motor facial usa `public/models/w600k_mbf.onnx`, tomado del pack `buffalo_s` de
InsightFace. El código de InsightFace es MIT, pero **los pesos preentrenados se publican
solo para investigación no comercial**. Una licencia sobre el código no licencia los
pesos, así que cuenti time no puede facturar el módulo facial con este archivo.

## Decisión (2026-08-21)

Negociar la licencia comercial de `buffalo_s` con InsightFace en vez de cambiar de modelo.
Es la única opción que no toca nada de lo ya implementado: el pipeline, el esquema
`vector(512)`, los umbrales calibrados y los embeddings del backfill siguen siendo válidos.

Las alternativas evaluadas y por qué se descartaron están en la tabla de `AGENTS.md`,
sección "Capa de IA facial". En resumen: AuraFace tiene la procedencia de datos más limpia
pero es ResNet100 (261 MB) y obligaría a mover el embedding al servidor; FaceX encaja
técnicamente pero está entrenado sobre MS1M-RefineV2, la misma procedencia cuestionada.

## Correo a enviar

**Para:** `recognition-oss-pack@insightface.ai`
**Asunto:** Commercial license request — buffalo_s (w600k_mbf) for browser-based attendance SaaS

```text
Hello,

We are cuenti time, a SaaS company in Colombia. Our product records employee
attendance, and we use face recognition to identify employees at a kiosk.

We would like to license the buffalo_s pack for commercial use, specifically the
w600k_mbf recognition model. Details of our deployment:

- The ONNX model is served from our own domain and runs client-side in the browser
  via onnxruntime-web. It is not redistributed as a downloadable artifact and is not
  exposed through a public API.
- We use it only to produce 512-d embeddings for 1:N identification against employees
  who have given explicit biometric consent. We do not resell the model or expose it
  as a face recognition API to third parties.
- Current scale: <N> companies and roughly <M> enrolled employees.
- We also use the tiny_face_detector and 68-landmark models from face-api.js for
  detection and alignment, not your detection models.

Could you share the terms and pricing for a commercial license? We are happy to sign
whatever agreement you require, and to adjust the deployment if any of the above does
not fit your licensing model.

Thank you,
<nombre>
<cargo> — cuenti time
<email> · <sitio web>
```

Rellenar `<N>`, `<M>` y los datos de contacto antes de enviar.

## Si la respuesta es negativa o el precio no encaja

El modelo es intercambiable: un archivo `.onnx` y la constante `FACE_EMBEDDING_DIMENSIONS`
en `src/lib/ai/pgvector.ts`. Cambiarlo implica volver a correr `/settings/face-migration`
para reconstruir los embeddings y `/settings/face-diagnostics` para recalibrar el umbral,
porque las distancias no son comparables entre modelos.
