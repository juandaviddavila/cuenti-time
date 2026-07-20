import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { getJwtRefreshSecret } from "@/lib/server-auth";
import {
  extractTokenPayload,
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
} from "@/lib/session-tokens";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh-token")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Refresh token requerido" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(refreshToken, getJwtRefreshSecret());
    const tokenPayload = extractTokenPayload(payload);
    if (!tokenPayload) {
      return NextResponse.json({ error: "Refresh token inválido" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
      select: {
        id: true,
        companyId: true,
        role: true,
        email: true,
        name: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      return NextResponse.json({ error: "Sesión no válida" }, { status: 401 });
    }

    const refreshedPayload = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      name: user.name,
      impersonatorId: tokenPayload.impersonatorId,
    };

    const accessToken = await signAccessToken(refreshedPayload);
    const nextRefreshToken = await signRefreshToken(refreshedPayload);

    const response = NextResponse.json({ success: true, accessToken });
    // Renueva ambas cookies (ventana deslizante de 7 días mientras haya uso).
    setAuthCookies(response, accessToken, nextRefreshToken);

    return response;
  } catch {
    const response = NextResponse.json({ error: "Refresh token inválido o vencido" }, { status: 401 });
    response.cookies.delete("access-token");
    response.cookies.delete("refresh-token");
    return response;
  }
}
