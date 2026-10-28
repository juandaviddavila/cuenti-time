# Resúmenes ejecutivos de RR. HH.

El dashboard y MCP usan un resumen determinista del motor existente de asistencia. El correo comparte esa fuente; no califica trabajadores ni calcula nómina.

## Consulta

- Dashboard: tarjeta «Resumen ejecutivo de la semana».
- API de sesión: `GET /api/hr-summaries?kind=daily` o `kind=weekly`.
- Rango explícito: `GET /api/hr-summaries?from=2026-10-01&to=2026-10-07` (máximo 92 días de diferencia entre extremos).
- MCP: herramienta de solo lectura `get_executive_summary`, con los filtros declarados en su esquema.

La API requiere sesión y permiso de consulta. Los supervisores quedan limitados a su sucursal mediante el motor de reportes existente. El tenant se obtiene de la sesión o del token MCP, no del cliente.

## Entrega automática por correo

El punto de entrada es `POST /api/cron/hr-summaries`. Requiere `CRON_SECRET` mediante autenticación Bearer o el encabezado `x-cron-secret`. El cuerpo admite:

```json
{ "kind": "daily", "date": "2026-10-27" }
```

`kind` puede ser `daily` o `weekly`. `date` es opcional y selecciona el día o la semana que lo contiene. También puede indicarse `companyId` para limitar una ejecución autorizada del cron a una empresa. Sin filtro se procesan empresas activas. Los destinatarios son administradores de empresa activos con correo verificado; sus direcciones se deduplican.

Las variables existentes `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` siguen siendo las del servicio compartido. Sus valores permanecen en la configuración de entorno y no se documentan aquí.

Un programador externo debe llamar al endpoint; añadir esta ruta no instala un cron. Para resúmenes definitivos, programar la entrega después de cerrar el período e indicar el día cerrado: una primera entrega exitosa impide actualizaciones posteriores por correo del mismo período. Las semanas comienzan el lunes. Los límites de día/semana usan la zona horaria del proceso; configurar la misma zona horaria en todas las instancias.

## Deduplicación y fallos

`LateReportLog` conserva la confirmación por empresa y período. Diario usa medianoche y semanal mediodía del lunes como anclas diferenciadas. No cambia el esquema Prisma.

Un advisory lock de PostgreSQL y una transacción `ReadCommitted` serializan ejecuciones del mismo período. La comprobación posterior al lock ve la confirmación de una ejecución anterior. Los envíos omitidos por SMTP no configurado o fallidos no generan confirmación de éxito y pueden reintentarse. Sin datos no se envía correo.

**Límite:** SMTP y la confirmación en PostgreSQL no son atómicos. Si el correo sale y el proceso falla antes de confirmar la transacción, un reintento puede duplicarlo. Un error de transacción se propaga; nunca se interpreta automáticamente como «ya enviado». No se promete entrega exactamente una vez frente a fallos del proceso.

## Verificación

```bash
pnpm exec tsx --test src/lib/hr-summary/__tests__/*.test.ts
pnpm exec tsc --noEmit
pnpm --filter @cuenti/hr-mcp-server exec vitest run src/__tests__/tools.test.ts -t 'tool registry'
```

Las pruebas locales inyectan base de datos y correo falsos; no envían correos reales. La prueba de concurrencia se complementó con verificación independiente del modelo de snapshots. La integración real de dos sesiones PostgreSQL y la entrega SMTP quedan pendientes de un entorno de pruebas autorizado.
