import type { ServerSession } from "@/lib/server-auth";
import { isConfiguredSuperAdminEmail } from "@/lib/super-admin-access";

export function isSuperAdmin(session: ServerSession): boolean {
  return (
    session.role === "SAAS_SUPER_ADMIN" &&
    isConfiguredSuperAdminEmail(session.email) &&
    !session.isImpersonating
  );
}

export function requireSuperAdmin(session: ServerSession): void {
  if (!isSuperAdmin(session)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}
