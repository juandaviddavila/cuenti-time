import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bigintToString } from "@/lib/bigint";
import {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  type TokenPayload,
} from "@/lib/session-tokens";
import { resolveEffectiveRole } from "@/lib/super-admin-access";

type SessionUser = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "role"
  | "companyId"
  | "avatar"
  | "status"
  | "bypassGeofence"
  | "canManageIntegrations"
  | "createdAt"
>;

export async function createAuthenticatedLoginResponse(
  user: SessionUser,
  options?: { impersonatorId?: string }
) {
  const effectiveRole = resolveEffectiveRole(
    user.email,
    user.role,
    Boolean(options?.impersonatorId)
  );
  const payload: TokenPayload = {
    userId: bigintToString(user.id),
    companyId: user.companyId ? bigintToString(user.companyId) : null,
    role: effectiveRole,
    email: user.email,
    name: user.name,
    impersonatorId: options?.impersonatorId,
  };

  const accessToken = await signAccessToken(payload);
  const refreshToken = await signRefreshToken(payload);

  prisma.user
    .update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginOtpHash: null,
        loginOtpExpiresAt: null,
      },
    })
    .catch(console.error);

  let companyName: string | null = null;
  if (user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    });
    companyName = company?.name ?? null;
  }

  const response = NextResponse.json({
    user: {
      id: bigintToString(user.id),
      name: user.name,
      email: user.email,
      role: effectiveRole,
      companyId: user.companyId ? bigintToString(user.companyId) : null,
      companyName,
      avatar: user.avatar,
      status: user.status,
      bypassGeofence: user.bypassGeofence,
      canManageIntegrations: user.canManageIntegrations,
      createdAt: user.createdAt.toISOString(),
    },
    accessToken,
    isImpersonating: Boolean(options?.impersonatorId),
  });

  setAuthCookies(response, accessToken, refreshToken);

  return response;
}
