import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { activateKiosk } from "@/lib/kiosk/service";
import { KIOSK_COOKIE_NAME } from "@/lib/kiosk/routes";
import { createAuditLog } from "@/lib/audit";

const schema = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`kiosk-activate:${ip}`, { limit: 5, windowMs: 60_000 }).allowed) return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Código inválido" }, { status: 400 }); }
  const input = schema.safeParse(body);
  if (!input.success) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const activated = await activateKiosk(input.data.code, prisma);
  if (!activated) return NextResponse.json({ error: "Código inválido, vencido o utilizado" }, { status: 401 });
  await createAuditLog({ request, session: null, companyId: activated.device.companyId, action: "ACTIVATE_KIOSK", entity: "KIOSK", entityId: activated.device.id });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(KIOSK_COOKIE_NAME, activated.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: activated.device.expiresAt });
  return response;
}
