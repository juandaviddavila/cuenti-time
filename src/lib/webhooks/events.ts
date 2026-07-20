/**
 * Catálogo versionado de eventos webhook outbound.
 * Solo estos valores son válidos al crear/actualizar suscripciones.
 * El companyId del payload siempre viene del emisor (tenant), nunca del cliente HTTP.
 */

export const WEBHOOK_EVENT_CATALOG = [
  {
    id: "employee.created",
    label: "Empleado creado",
    description: "Alta de un empleado en la empresa",
    category: "Empleados",
  },
  {
    id: "employee.updated",
    label: "Empleado actualizado",
    description: "Cambios de datos, cargo o sucursal",
    category: "Empleados",
  },
  {
    id: "employee.deactivated",
    label: "Empleado desactivado",
    description: "Soft-delete / status INACTIVE",
    category: "Empleados",
  },
  {
    id: "employee.face_registered",
    label: "Rostro registrado",
    description: "Primer registro facial biométrico del empleado",
    category: "Empleados",
  },
  {
    id: "attendance.checked_in",
    label: "Entrada marcada",
    description: "CHECK_IN en kiosco, dashboard o API",
    category: "Asistencia",
  },
  {
    id: "attendance.checked_out",
    label: "Salida marcada",
    description: "CHECK_OUT en kiosco, dashboard o API",
    category: "Asistencia",
  },
  {
    id: "incident.created",
    label: "Novedad creada",
    description: "Permiso, incapacidad u otra novedad",
    category: "Novedades",
  },
  {
    id: "incident.updated",
    label: "Novedad actualizada",
    description: "Edición de una novedad existente",
    category: "Novedades",
  },
  {
    id: "incident.deleted",
    label: "Novedad eliminada",
    description: "Borrado de una novedad",
    category: "Novedades",
  },
  {
    id: "branch.created",
    label: "Sucursal creada",
    description: "Nueva sucursal en la empresa",
    category: "Sucursales",
  },
  {
    id: "branch.updated",
    label: "Sucursal actualizada",
    description: "Cambios de datos o geofence",
    category: "Sucursales",
  },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_CATALOG)[number]["id"];

export const WEBHOOK_EVENTS: readonly WebhookEventType[] = WEBHOOK_EVENT_CATALOG.map(
  (e) => e.id
);

export function isWebhookEvent(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

export function parseSubscriptionEvents(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === "string");
  } catch {
    return [];
  }
}
