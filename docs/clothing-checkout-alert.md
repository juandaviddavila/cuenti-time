# Alerta de cambio de prendas (entrada vs salida)

**Estado:** diseño de fase futura. No implementado.

**Decisión (2026-08-21):** el embedding facial ArcFace (`w600k_mbf`, 512-D) **no**
se usa para comparar ropa. Solo identifica *quién es*. Comparar outfits exige un
segundo pipeline.

## Problema de negocio

En almacenes de ropa, un empleado puede entrar con una prenda (p. ej. camisa blanca
con botones) y salir con otra parecida pero distinta (camisa blanca sin botones).
La alerta en `CHECK_OUT` permite que un supervisor valide si hubo posible hurto.

## Por qué no ArcFace

1. ArcFace se entrena para que la misma persona tenga vectores cercanos **aunque
   cambie de ropa**.
2. El pipeline actual recorta y alinea solo la cara a 112×112
   (`src/lib/ai/face-align.ts`); el torso no entra al modelo.
3. Reutilizar `Employee.faceEmbedding` o `Company.faceMatchThreshold` para outfit
   produciría falsos negativos sistemáticos (casi nunca alertaría).

## Arquitectura objetivo (dos señales)

| Señal | Pregunta | Componente |
|-------|----------|------------|
| Facial (existente) | ¿Quién es? | ArcFace 512-D + pgvector |
| Apariencia (nuevo) | ¿Sale con el mismo outfit? | Modelo ReID / atributos de prenda |

```text
Captura cuerpo entero + cara
        │
        ├─► Pipeline facial (ArcFace) ──► empleado identificado
        │                                         │
        └─► Pipeline prendas (nuevo) ──► descriptor / atributos de outfit
                                                  │
                     CHECK_IN del día ◄───────────┤
                                                  ▼
                              comparar entrada vs salida
                                  │              │
                                  ▼              ▼
                              igual → OK    distinto → alerta supervisor
```

## Enfoque de modelo (a elegir al implementar)

Preferencia inicial: **atributos de prenda** (color, tipo, botones, manga, largo)
vía visión (OpenRouter / clasificador) porque la alerta es interpretable
(“entró: camisa blanca con botones / salió: camisa blanca sin botones”).

Alternativa: **clothing / person ReID** (embedding de cuerpo/outfit en ONNX) y
distancia entre foto de `CHECK_IN` y `CHECK_OUT`. Más compacto, menos explicable.

No basarse solo en histograma de color: dos camisas blancas distintas fallan
fácilmente.

## Datos a persistir (orientativo)

En `AttendanceRecord` o tabla hija (`AttendanceAppearance`):

- `bodyPhoto` (base64 o object key) en entrada y salida
- `clothingEmbedding` (vector) **o** `clothingAttributes` (JSON)
- `clothingAlert` / `clothingDistance` solo relevante en `CHECK_OUT`

Reglas:

- Comparar solo si existe `CHECK_IN` del mismo empleado el mismo día.
- Umbral de prenda **independiente** de `faceMatchThreshold`.
- No bloquear la salida a ciegas: mensaje en kiosco + bandeja para supervisor
  (revisión humana). La IA no es la única decisión sobre sospecha de hurto
  (alineado a la regla de producto: la IA no es la única decisión sobre
  autenticidad / riesgo).

## UX kiosco (fase futura)

1. Guía visual de cuerpo entero (no solo óvalo de cara).
2. Tras match facial + liveness: guardar foto/descriptor de outfit en la marcación.
3. En salida: si mismatch → toast/pantalla “Validar prendas con supervisor” y
   crear alerta en dashboard.

## Qué no hacer

- No alimentar ArcFace con imagen de cuerpo entero esperando que “vea la ropa”.
- No mezclar umbrales faciales con umbrales de prenda.
- No sustituir el facial por un único embedding “todo en uno”.

## Relación con el código actual

- Identidad: `src/lib/ai/arcface-service.ts`, `face-api-service.ts`,
  `src/lib/face-match-threshold.ts`
- Este documento es la especificación de la fase de prendas; no hay módulos de
  clothing todavía.
