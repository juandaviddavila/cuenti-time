# Activación de kioscos por sucursal

Un kiosco usa una credencial de dispositivo revocable, no la cuenta del administrador. La credencial no autoriza acceso al dashboard, usuarios, integraciones ni creación de sucursales.

## Activar

1. Abre **Kioscos** (`/kiosks`) con tu cuenta.
2. Selecciona una sucursal autorizada y un nombre de dispositivo.
3. Crea el código y escríbelo en `/kiosk` desde el dispositivo de marcación.

El código es aleatorio, dura 15 minutos y solo puede utilizarse una vez. Se muestra únicamente al crearlo; no va en la URL ni en registros de auditoría. El navegador recibe otra credencial distinta en una cookie httpOnly, SameSite=Strict y Secure en producción. La sesión dura como máximo 30 días desde la creación y puede revocarse desde la lista de dispositivos.

## Delegar «Gestionar kioscos»

- Los administradores de empresa tienen acceso a las sucursales de su empresa por defecto.
- Solo ellos pueden conceder o retirar permisos a otros usuarios de la misma empresa.
- Cada permiso corresponde a un usuario y una sucursal. No modifica el rol ni concede otras facultades administrativas.
- Un supervisor de sucursal necesita permiso explícito y solo puede recibirlo para su sucursal asignada.
- Retirar el permiso impide nuevas gestiones. Para desactivar también los dispositivos ya emitidos, revoca esos dispositivos explícitamente.
- El superadministrador necesita un contexto de empresa; no se acepta una empresa arbitraria desde el cliente.

## Límites del dispositivo

Se verifica su registro en cada operación de datos: revocación, vencimiento, estado de empresa y sucursal y pertenencia de la sucursal. Las búsquedas faciales y descriptores se limitan a la sucursal del dispositivo; las marcaciones rechazan empleados o sucursales distintos y no permiten el modo manual. No se heredan excepciones de geofence de quien creó el código.

El kiosco envía `x-kiosk-mode: 1` a sus operaciones de datos para mantener el alcance de dispositivo aunque haya una cuenta abierta en el navegador. Las solicitudes normales del dashboard conservan su sesión de cuenta. La cookie de dispositivo nunca es aceptada por `requireSession()`.

El middleware solo permite llegar a una lista exacta de operaciones GET/POST de asistencia/facial/sucursales; la cookie por sí sola no autentica. Cada handler valida la credencial en la base antes de consultar o escribir datos. La pantalla revisa la vigencia cada 30 segundos y desmonta la cámara si pierde autorización; los rechazos de API son inmediatos en la siguiente solicitud.

## Preparar la base de datos

Se agregan las tablas `KioskDevice` y `KioskGrant` sin modificar registros existentes. Generar el cliente y aplicar el esquema solo sobre una base autorizada:

```bash
pnpm db:generate
pnpm db:push
```

No usar `--force-reset`. Reiniciar Next después de actualizar el cliente. Estos cambios de código no actualizan automáticamente la base configurada en `DATABASE_URL`.

## API

- `GET /api/kiosks`: lista únicamente sucursales y dispositivos gestionables. No devuelve hashes ni credenciales.
- `POST /api/kiosks`: acciones `create`, `revoke`, `grant` y `revoke-grant`; las dos últimas requieren administrador. Entrada JSON validada; rechazos sin cambios en permisos o dispositivos.
- `POST /api/kiosk/activate`: canje de código de un uso, con límite de intentos.
- `GET /api/kiosk/session`: vigencia y sucursal del dispositivo, sin acceso a la cuenta.

## Comprobar

```bash
pnpm exec tsx --test src/lib/kiosk/*.test.ts src/lib/attendance-window.test.ts src/components/layout/nav-items.test.ts
pnpm exec tsc --noEmit
node --experimental-transform-types --experimental-test-module-mocks --test-force-exit --loader ./scripts/kiosk-test-loader.mjs --test scripts/kiosk-handlers.test.mjs
```

Las pruebas deterministas no conectan a PostgreSQL ni usan SMTP. Los probes de handlers ejercitan las rutas reales con Prisma y cookies simulados, incluyendo rechazos sin cambios en registros o contadores; se usa `--test-force-exit` por el temporizador del limitador existente. La validación de rutas, cookies y revocación real requiere un entorno aislado autorizado con las tablas nuevas. No se modifica el motor ArcFace ni la política de geofence móvil existente.
