# Session summary — face-identify-stability (2026-08-29)

## Hecho

1. Causa del `no_match` intermitente: landmarks de un frame + ArcFace de otro,
   y después promedio de 3 frames (2 malos). Search #1 y #2 fallaban.
2. Search ahora es **uno**, tras 2 embeddings locales parecidos (≤ 0.2).
3. API aclara galería vacía vs distancia alta. Kiosco filtra sucursal;
   registro facial busca en toda la empresa.

## Engram

- `sdd/face-search/intermittent-no-match`
- `sdd/face-search/first-call-should-match`
- `sdd/face-search/tenant-filters`
- Proyecto: `cuenti-time`
