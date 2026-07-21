/**
 * Server-side session utility.
 * Use in Server Components and API Routes to get the authenticated user's context.
 * NEVER use this in Client Components.
 */
import { cookies } from "next/headers";
import { jwtVerify } from "jose/jwt/verify";
import { prisma } from "@/lib/prisma";
import {
  bypassesGeofence,
  canManageIntegrations,
  type UserPermissionFields,
} from "@/lib/user-permissions";
import { extractTokenPayload, payloadToSession } from "@/lib/session-tokens";
import { getCompanyFilter, type TenantSession } from "@/lib/tenant";
import type { UserRole } from "@/types/user";

export interface ServerSession extends TenantSession {
  userId: string;
  companyId: string | null;
  role: UserRole;
  email: string;
  name: string;
  impersonatorUserId?: string | null;
  isImpersonating: boolean;
}

export { getCompanyFilter };

/**
 * Returns the authenticated session from the httpOnly cookie.
 * Tries access-token first; if expired/missing, falls back to refresh-token
 * so Server Components don't redirect to /login right after middleware refresh
 * (cookies set on the response aren't visible to the same request otherwise).
 */
export async function getServerSession(): Promise<ServerSession | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access-token")?.value;
    if (accessToken) {
      try {
        const { payload } = await jwtVerify(accessToken, getJwtSecret());
        const tokenPayload = extractTokenPayload(payload);
        if (tokenPayload) return payloadToSession(tokenPayload);
      } catch {
        // fall through to refresh
      }
    }

    const refreshToken = cookieStore.get("refresh-token")?.value;
    if (!refreshToken) return null;

    const { payload } = await jwtVerify(refreshToken, getJwtRefreshSecret());
    const tokenPayload = extractTokenPayload(payload);
    if (!tokenPayload) return null;
    return payloadToSession(tokenPayload);
  } catch {
    return null;
  }
}

/**
 * Same as getServerSession() but throws a 401 response if not authenticated.
 * Use in API Route handlers.
 */
export async function requireSession(): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

/**
 * Resolves and validates the JWT secret at runtime.
 * Throws at startup if the env var is missing — never silently use a fallback.
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET env variable is missing or too short (min 32 chars). " +
        "Set it in .env before starting the application."
    );
  }
  return new TextEncoder().encode(secret);
}

export function getJwtRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_REFRESH_SECRET env variable is missing or too short (min 32 chars)."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function getUserPermissionFields(
  userId: string
): Promise<UserPermissionFields | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      bypassGeofence: true,
      canManageIntegrations: true,
    },
  });
  return user;
}

export async function requireIntegrationAccess(
  session: ServerSession
): Promise<UserPermissionFields> {
  const permissions = await getUserPermissionFields(session.userId);
  const effectivePermissions = permissions
    ? { ...permissions, role: session.role }
    : null;

  if (!effectivePermissions || !canManageIntegrations(effectivePermissions)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return effectivePermissions;
}

export async function userBypassesGeofence(userId: string): Promise<boolean> {
  const permissions = await getUserPermissionFields(userId);
  return permissions ? bypassesGeofence(permissions) : false;
}
