import { SignJWT, type JWTPayload } from "jose";
import type { NextResponse } from "next/server";
import type { UserRole } from "@/types/user";
import type { ServerSession } from "@/lib/server-auth";
import { getJwtSecret, getJwtRefreshSecret } from "@/lib/server-auth";
import { resolveEffectiveRole } from "@/lib/super-admin-access";

export interface TokenPayload {
  userId: string;
  companyId: string | null;
  role: UserRole;
  email: string;
  name: string;
  impersonatorId?: string;
}

export function extractTokenPayload(payload: JWTPayload): TokenPayload | null {
  const userId = payload.userId as string | undefined;
  const role = payload.role as UserRole | undefined;
  const email = payload.email as string | undefined;
  const name = payload.name as string | undefined;

  if (!userId || !role || !email || !name) return null;

  return {
    userId,
    companyId: (payload.companyId as string | null) ?? null,
    role,
    email,
    name,
    impersonatorId: payload.impersonatorId as string | undefined,
  };
}

export function payloadToSession(payload: TokenPayload): ServerSession {
  const isImpersonating = Boolean(payload.impersonatorId);

  return {
    userId: payload.userId,
    companyId: payload.companyId,
    role: resolveEffectiveRole(payload.email, payload.role, isImpersonating),
    email: payload.email,
    name: payload.name,
    impersonatorUserId: payload.impersonatorId ?? null,
    isImpersonating,
  };
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getJwtSecret());
}

export async function signRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtRefreshSecret());
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
  response.cookies.set("access-token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15,
    path: "/",
  });

  response.cookies.set("refresh-token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete("access-token");
  response.cookies.delete("refresh-token");
}
