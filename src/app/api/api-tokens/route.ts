import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession, requireIntegrationAccess } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import { encryptApiToken } from "@/lib/api-token-crypto";

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.string().default("read"),
});

export async function GET(_request: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    await requireIntegrationAccess(session);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!session.companyId) {
    return NextResponse.json(
      { error: "Tu cuenta no tiene empresa asociada." },
      { status: 422 }
    );
  }

  try {
    const tokens = await prisma.apiToken.findMany({
      where: { companyId: session.companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        scopes: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
        tokenCipher: true,
      },
    });
    return NextResponse.json({
      data: tokens.map(({ tokenCipher, ...rest }) => ({
        ...rest,
        recoverable: Boolean(tokenCipher),
      })),
    });
  } catch (err) {
    console.error("GET /api/api-tokens error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    await requireIntegrationAccess(session);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  const companyId = session.companyId;
  if (!companyId) {
    return NextResponse.json(
      { error: "Tu cuenta no tiene empresa asociada. No se puede emitir un token multi-tenant." },
      { status: 422 }
    );
  }

  const rawToken = `cuenti_${randomBytes(32).toString("hex")}`;
  const tokenPrefix = rawToken.slice(0, 16);
  const hashed = await bcrypt.hash(rawToken, 12);
  let tokenCipher: string;
  try {
    tokenCipher = encryptApiToken(rawToken);
  } catch (err) {
    console.error("encryptApiToken error:", err);
    return NextResponse.json(
      { error: "No se pudo cifrar el token. Revisa JWT_SECRET en el servidor." },
      { status: 500 }
    );
  }

  try {
    const token = await prisma.apiToken.create({
      data: {
        companyId,
        name: parsed.data.name,
        scopes: parsed.data.scopes,
        token: hashed,
        tokenPrefix,
        tokenCipher,
      },
      select: { id: true, name: true, scopes: true, active: true, createdAt: true },
    });
    await createAuditLog({
      request,
      session,
      action: "CREATE",
      entity: "API_TOKEN",
      entityId: token.id,
      companyId,
      newValues: { name: token.name, scopes: token.scopes },
    });
    return NextResponse.json(
      { ...token, token: rawToken, recoverable: true },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/api-tokens error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
