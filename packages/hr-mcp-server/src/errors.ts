/**
 * Error taxonomy MCP-compatible.
 * Codes:
 *  - -32001: Unauthorized (token missing, malformed, inactive)
 *  - -32003: Forbidden (insufficient scope)
 *  - -32602: Invalid params (validation, ranges, IDs)
 *  - -32603: Internal error (DB, unexpected)
 *  - -32601: Method not found (tool desconocido)
 */
export class McpError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: Record<string, unknown>
  ) {
    super(message);
    this.name = "McpError";
  }
}

export function unauthorized(message = "Invalid or expired token"): McpError {
  return new McpError(-32001, message);
}

export function forbidden(message = "Forbidden: se requiere alcance read"): McpError {
  return new McpError(-32003, message);
}

export function invalidParams(message: string, data?: Record<string, unknown>): McpError {
  return new McpError(-32602, message, data);
}

export function internalError(message = "Error interno del servidor"): McpError {
  return new McpError(-32603, message);
}

export function notFound(resource: string, id?: string): McpError {
  const feminine = resource === "Sucursal" || resource === "Empresa";
  const suffix = feminine ? "no encontrada" : "no encontrado";
  return new McpError(
    -32602,
    id ? `${resource} ${suffix}: ${id}` : `${resource} ${suffix}`
  );
}
