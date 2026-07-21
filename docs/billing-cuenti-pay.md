# Billing / Cuenti Pay (cuenti time)

## Modelo comercial

| Plan | Cupo | Precio | Integraciones |
|------|------|--------|----------------|
| **free** | Hasta `BillingConfig.freeEmployeeLimit` (default 3) empleados activos | $0 | Sin API ni MCP |
| **paid** | `Company.maxEmployees` contratados | `priceCopPerEmployeeMonthly` (default **3500 COP**) o `priceUsdPerEmployeeMonthly` (default **1 USD**) **por empleado / mes** | API, webhooks, MCP |

- Los pagos de suscripción/renovación son **solo mensuales** (periodo de 30 días).
- Empleados adicionales a mitad de periodo: **prorrateo** `díasRestantes / 30 × precio mensual` (COP sin decimales; USD máx. 2).
- Ejemplo: 15 días restantes → **1750 COP** por empleado adicional.
- Si la suscripción vence → `/subscription-expired` + link a `/pricing`.
- Cron recordatorio 2 días antes: `POST /api/billing/renewal-reminders` con `Authorization: Bearer $CRON_SECRET`.

Configuración editable en DB: modelo `BillingConfig` (fila sembrada id=1).

## Variables de entorno

```env
CUENTI_PAY_ENABLED=true
CUENTI_PAY_AUTH_TOKEN=<Bearer JWT o token de empresa>
CUENTI_PAY_API_URL=https://api.cuenti.co/jServerj4ErpPro/api/token/grabarDocumentoSimple
CUENTI_PAY_VOID_API_URL=https://api.cuenti.co/jServerj4ErpPro/com/j4ErpPro/server/transacion/anularTransacion
CUENTI_PAY_EMPRESA_ID=2
CUENTI_PAY_EMPLEADO_ID=1
CUENTI_PAY_GTM=GMT-0500
# Opcional pero recomendado:
BILLING_WEBHOOK_SECRET=<secreto compartido>
NEXT_PUBLIC_APP_URL=http://localhost:7578
```

Si `CUENTI_PAY_ENABLED=false`, el checkout no llama la pasarela (modo stub/dev).

**No commitees el Bearer.** No se loguea completo.

Confirma con quien administre la empresa en Cuenti los IDs reales (`id_producto_cop/usd`, sucursal, bodega, consecutivos) antes de producción.

## Endpoints

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/api/billing/config` | Público (landing) |
| GET | `/api/billing` | Empresa admin |
| POST | `/api/billing` `action=quote\|checkout\|invoices` | Empresa admin |
| POST | `/api/billing/invoices/:id/cancel` | Empresa admin |
| POST | `/api/billing/webhook/:codigoUnico` | Público (+ secret opcional) |
| POST | `/api/billing/renewal-reminders` | `CRON_SECRET` |

Frontend retorno: `{NEXT_PUBLIC_APP_URL}/pricing?invoice={id}`  
Webhook: `{NEXT_PUBLIC_APP_URL}/api/billing/webhook/{codigo_unico}`

## Curl de prueba — grabarDocumentoSimple

```bash
curl -v -X POST "$CUENTI_PAY_API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUENTI_PAY_AUTH_TOKEN" \
  -H "x-auth-token-empresa: $CUENTI_PAY_EMPRESA_ID" \
  -H "x-gtm: $CUENTI_PAY_GTM" \
  -H "x-id-empleado: $CUENTI_PAY_EMPLEADO_ID" \
  --data-binary @- <<'EOF'
{
  "tipoDocumento": 9,
  "type_match_producto": 1,
  "id_consecutivo": 1,
  "nota": "cuenti time — 1 empleado(s)",
  "observacion": "Company billing 291812345678",
  "id_sucursal": 5,
  "id_bodega": 5,
  "id_vendedor": 1,
  "id_empleado": 1,
  "codigo_unico": "291812345678",
  "objClienteMini": {
    "id_cliente": -1,
    "nombre_cliente": "Cliente Prueba",
    "identificacion": "900123456",
    "telefono1": "3001234567",
    "telefono2": "",
    "email1": "",
    "direccion": "N/A",
    "id_tipo_persona": 1,
    "es_cliente": 1,
    "es_proveedor": 0,
    "departamento": "",
    "pais": "Colombia",
    "ciudad": "",
    "zona": ""
  },
  "objDetalle": [
    {
      "cantidad": 1,
      "id_producto": 123,
      "descripcion": "cuenti time",
      "total": 42000
    }
  ],
  "generar_link_pago": true,
  "config_link_pago": {
    "responseUrl": "http://localhost:7578/pricing?invoice=TEST",
    "country": "CO",
    "currency": "COP",
    "web_hook": "http://localhost:7578/api/billing/webhook/291812345678",
    "id_consecutivo": 60,
    "convertir_remision_factura": 1
  }
}
EOF
```

Éxito cuando `type === 1`. Guardar `id_transacion` y `cuenti_pay.url`.

## Curl — anularTransacion

```bash
curl -v -X POST "$CUENTI_PAY_VOID_API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUENTI_PAY_AUTH_TOKEN" \
  -H "x-auth-token-empresa: $CUENTI_PAY_EMPRESA_ID" \
  -H "x-gtm: $CUENTI_PAY_GTM" \
  -H "x-id-empleado: $CUENTI_PAY_EMPLEADO_ID" \
  --data-binary @- <<'EOF'
{
  "id_encabezado_anulada": 0,
  "id_transacion": 123456,
  "id_empleado": 1,
  "observacion": "Cancelación factura 291812345678",
  "nota": "Anulación de pago pendiente",
  "esEliminar": true
}
EOF
```

## Flujo E2E

1. Registrar empresa → plan `free`, `maxEmployees=3`.
2. Cotizar/checkout en `/pricing` → factura `pending` + link Cuenti Pay.
3. Pagar → webhook → `plan=paid`, cupo, `subscriptionExpiresAt` +30 días.
4. Cancelar pendiente → `anularTransacion` si hay `id_transacion` → factura `cancelled`.
5. Landing `/precios` (puerto 3008) lee `GET /api/billing/config`.

## Tests

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v24.13.1
pnpm exec tsx src/lib/billing/billing.test.ts
```

## Riesgos de seguridad del webhook

1. La ruta es **pública**; sin `BILLING_WEBHOOK_SECRET` basta conocer `codigoUnico` (~prefijo predecible + 8 dígitos).
2. **No hay firma HMAC** de Cuenti Pay validada en este código; el secreto compartido es la mitigación local.
3. Un webhook repetido es **idempotente** si ya `paid`, pero un atacante con el código puede activar el plan **una vez**.
4. Expón el webhook solo por HTTPS en producción y rota el secret si se filtra.
5. No registres el Bearer `CUENTI_PAY_AUTH_TOKEN` en logs.
