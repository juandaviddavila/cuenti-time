import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession, requireIntegrationAccess } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit";
import {
  decryptApiToken,
  encryptApiToken,
} from "@/lib/api-token-crypto";

type RouteParams = { params: { id: string } };

/**
 * Recupera el secreto en claro del token (cifrado en DB).
 * Si el token es legacy sin cipher, regenera uno nuevo y lo devuelve.
 * Query: ?rotate=1 fuerza regeneración aunque exista cipher.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  const forceRotate =
    new URL(request.url).searchParams.get("rotate") === "1";

  const existing = await prisma.apiToken.findFirst({
    where: { id: params.id, companyId: session.companyId },
    select: {
      id: true,
      name: true,
      tokenCipher: true,
      companyId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Token no encontrado" }, { status: 404 });
  }

  try {
    if (existing.tokenCipher && !forceRotate) {
      const raw = decryptApiToken(existing.tokenCipher);
      await createAuditLog({
        request,
        session,
        action: "REVEAL",
        entity: "API_TOKEN",
        entityId: existing.id,
        companyId: existing.companyId,
        newValues: { name: existing.name, revealed: true },
      });
      return NextResponse.json({
        id: existing.id,
        name: existing.name,
        token: raw,
        regenerated: false,
      });
    }

    // Legacy sin cipher, o rotación forzada: nuevo secreto.
    const rawToken = `cuenti_${randomBytes(32).toString("hex")}`;
    const tokenPrefix = rawToken.slice(0, 16);
    const hashed = await bcrypt.hash(rawToken, 12);
    const tokenCipher = encryptApiToken(rawToken);

    await prisma.apiToken.update({
      where: { id: existing.id },
      data: {
        token: hashed,
        tokenPrefix,
        tokenCipher,
      },
    });

    await createAuditLog({
      request,
      session,
      action: "ROTATE",
      entity: "API_TOKEN",
      entityId: existing.id,
      companyId: existing.companyId,
      newValues: {
        name: existing.name,
        regenerated: true,
        reason: existing.tokenCipher ? "manual_rotate" : "legacy_no_cipher",
      },
    });

    return NextResponse.json({
      id: existing.id,
      name: existing.name,
      token: rawToken,
      regenerated: true,
      message: existing.tokenCipher
        ? "Se generó un secreto nuevo. Actualiza tus integraciones."
        : "Este token era antiguo y no tenía copia recuperable. Se generó un secreto nuevo.",
    });
  } catch (err) {
    console.error("POST /api/api-tokens/[id]/reveal error:", err);
    return NextResponse.json(
      { error: "No se pudo recuperar el token" },
      { status: 500 }
    );
  }
}
