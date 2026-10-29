// Edge-safe dispatch allowlist. A cookie is not authorization; each handler
// resolves and validates the device against PostgreSQL before accessing data.
export const KIOSK_COOKIE_NAME = "kiosk-device";
export function isKioskDataRoute(path: string, method: string): boolean {
  return (method === "GET" && ["/api/branches", "/api/attendance", "/api/face/descriptors"].includes(path)) ||
    (method === "POST" && ["/api/attendance", "/api/face/search", "/api/face/embed"].includes(path));
}
