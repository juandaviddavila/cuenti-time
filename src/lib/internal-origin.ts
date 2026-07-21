/**
 * Origin for server-component self-fetch (Node → local Next).
 * Do not use the request Host / x-forwarded-proto: behind Dev Tunnels or
 * reverse proxies the public URL often cannot loop back → "fetch failed".
 */
export function getInternalAppOrigin(): string {
  const port = process.env.PORT ?? "7578";
  return `http://127.0.0.1:${port}`;
}
