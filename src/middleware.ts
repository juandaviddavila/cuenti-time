import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { extractTokenPayload } from "@/lib/session-tokens";

const ACCESS_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 15,
  path: "/",
};

const REFRESH_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
  "/subscription-expired",
  "/pricing",
  "/pricing/success",
  "/kiosk",
  "/api/auth/login",
  "/api/auth/login/verify",
  "/api/auth/login/resend",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/webhooks/wompi",
  "/api/webhooks/retry",
  "/api/v1",
];

// File extensions that should always be served without auth checks.
// Using an explicit allowlist is safer than pathname.includes(".").
const STATIC_EXTENSIONS = /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff|woff2|ttf|otf|json|txt|xml|webmanifest|map|bin)$/i;

/**
 * Rebuilds the Cookie header so Server Components in THIS request
 * see the refreshed tokens (middleware cookies alone only apply next request).
 */
function buildRequestHeadersWithCookies(
  request: NextRequest,
  updates: Record<string, string>
): Headers {
  const headers = new Headers(request.headers);
  const jar = new Map(request.cookies.getAll().map((c) => [c.name, c.value]));
  for (const [name, value] of Object.entries(updates)) {
    jar.set(name, value);
  }
  headers.set(
    "cookie",
    Array.from(jar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ")
  );
  return headers;
}

async function tryRefreshSession(
  request: NextRequest,
  accessSecret: Uint8Array
): Promise<NextResponse | null> {
  const refreshToken = request.cookies.get("refresh-token")?.value;
  const refreshSecretStr = process.env.JWT_REFRESH_SECRET;
  if (!refreshToken || !refreshSecretStr || refreshSecretStr.length < 32) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      refreshToken,
      new TextEncoder().encode(refreshSecretStr)
    );
    const tokenPayload = extractTokenPayload(payload);
    if (!tokenPayload) return null;

    const claims = {
      userId: tokenPayload.userId,
      companyId: tokenPayload.companyId,
      role: tokenPayload.role,
      email: tokenPayload.email,
      name: tokenPayload.name,
      ...(tokenPayload.impersonatorId
        ? { impersonatorId: tokenPayload.impersonatorId }
        : {}),
    };

    const accessToken = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(accessSecret);

    const nextRefreshToken = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(refreshSecretStr));

    const secure = process.env.NODE_ENV === "production";
    const requestHeaders = buildRequestHeadersWithCookies(request, {
      "access-token": accessToken,
      "refresh-token": nextRefreshToken,
    });

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.cookies.set("access-token", accessToken, {
      ...ACCESS_COOKIE,
      secure,
    });
    response.cookies.set("refresh-token", nextRefreshToken, {
      ...REFRESH_COOKIE,
      secure,
    });
    return response;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (exact prefix match — prevents /login.hack bypasses)
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow Next.js internals
  if (pathname.startsWith("/_next/") || pathname.startsWith("/icons/") || pathname.startsWith("/models/")) {
    return NextResponse.next();
  }

  // Allow static file extensions explicitly (not a blanket "." check)
  if (STATIC_EXTENSIONS.test(pathname)) {
    return NextResponse.next();
  }

  // Resolve JWT secret — fail hard if not configured
  const jwtSecretStr = process.env.JWT_SECRET;
  if (!jwtSecretStr || jwtSecretStr.length < 32) {
    console.error("FATAL: JWT_SECRET is missing or too short. Set it in .env.");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 503 }
    );
  }
  const secret = new TextEncoder().encode(jwtSecretStr);

  // Read token from httpOnly cookie only (not Authorization header for page routes)
  const token = request.cookies.get("access-token")?.value;

  // API routes also accept Authorization header (for programmatic access)
  const bearerToken = pathname.startsWith("/api/")
    ? request.headers.get("Authorization")?.replace("Bearer ", "")
    : undefined;

  const resolvedToken = token ?? bearerToken;

  if (resolvedToken) {
    try {
      await jwtVerify(resolvedToken, secret);
      return NextResponse.next();
    } catch {
      // Access expired/invalid — intentar refresh (páginas y API)
    }
  }

  // Renovar sesión con refresh-token cuando el access falta o expiró
  const refreshed = await tryRefreshSession(request, secret);
  if (refreshed) {
    return refreshed;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: resolvedToken ? "Token expired or invalid" : "Unauthorized" },
      { status: 401 }
    );
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("access-token");
  response.cookies.delete("refresh-token");
  return response;
}

export const config = {
  matcher: [
    // Match everything except Next.js static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
