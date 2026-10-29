import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { serializeRecord } from "@/lib/bigint";
import { kioskOperator, manageableBranch, KioskAccessError } from "@/lib/kiosk/management";
import { ACTIVATION_TTL_MS, DEVICE_TTL_MS, hashKioskSecret } from "@/lib/kiosk/policy";

const id = z.string().regex(/^[1-9]\d*$/);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), branchId: id, name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal("revoke"), deviceId: id }).strict(),
  z.object({ action: z.enum(["grant", "revoke-grant"]), branchId: id, userId: id }).strict(),
]);
const deviceSelect = { id: true, branchId: true, name: true, activatedAt: true, revokedAt: true, expiresAt: true, activationExpiresAt: true } as const;
function json(data: unknown, status = 200) { return NextResponse.json(serializeRecord(data), { status, headers: { "Cache-Control": "no-store" } }); }
function failure(error: unknown) {
  if (error instanceof KioskAccessError) return json({ error: error.message }, error.status);
  console.error("Kiosk management failed");
  return json({ error: "No se pudo gestionar el kiosco" }, 500);
}
export async function GET() {
  try {
    const context = await kioskOperator();
    const companyId = BigInt(context.operator.companyId!);
    const branches = await prisma.branch.findMany({ where: { companyId, status: "ACTIVE", ...(!context.admin ? { id: { in: context.grants.filter(g => context.operator.role !== "BRANCH_SUPERVISOR" || g === context.operator.branchId).map(BigInt) } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const [devices, grants, users] = await Promise.all([
      prisma.kioskDevice.findMany({ where: { companyId, branchId: { in: branches.map(b => b.id) } }, select: deviceSelect, orderBy: { createdAt: "desc" }, take: 100 }),
      context.admin ? prisma.kioskGrant.findMany({ where: { companyId }, select: { userId: true, branchId: true } }) : [],
      context.admin ? prisma.user.findMany({ where: { companyId, status: "ACTIVE" }, select: { id: true, name: true, role: true, branchId: true } }) : [],
    ]);
    return json({ admin: context.admin, branches, devices, grants, users });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return json({ error: "Forbidden" }, 403);
  let input: unknown;
  try { input = await request.json(); } catch { return json({ error: "Cuerpo inválido" }, 400); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
  try {
    const context = await kioskOperator();
    const companyId = BigInt(context.operator.companyId!);
    const data = parsed.data;
    if (data.action === "create") {
      const branch = await manageableBranch(context, data.branchId);
      const code = randomBytes(32).toString("base64url");
      const now = Date.now();
      const device = await prisma.kioskDevice.create({ data: { companyId, branchId: branch.id, name: data.name, activationHash: hashKioskSecret(code), activationExpiresAt: new Date(now + ACTIVATION_TTL_MS), expiresAt: new Date(now + DEVICE_TTL_MS) }, select: deviceSelect });
      await createAuditLog({ request, session: context.session, action: "CREATE_KIOSK", entity: "KIOSK", entityId: device.id, newValues: { branchId: branch.id } });
      return json({ device, activationCode: code }, 201);
    }
    if (data.action === "revoke") {
      const device = await prisma.kioskDevice.findFirst({ where: { id: BigInt(data.deviceId), companyId } });
      if (!device) return json({ error: "Kiosco no encontrado" }, 404);
      await manageableBranch(context, device.branchId.toString());
      await prisma.kioskDevice.updateMany({ where: { id: device.id, companyId }, data: { revokedAt: new Date(), tokenHash: null } });
      await createAuditLog({ request, session: context.session, action: "REVOKE_KIOSK", entity: "KIOSK", entityId: device.id });
      return json({ ok: true });
    }
    if (!context.admin) throw new KioskAccessError(403);
    const branch = await manageableBranch(context, data.branchId);
    const user = await prisma.user.findFirst({ where: { id: BigInt(data.userId), companyId, status: "ACTIVE" } });
    if (!user || (user.role === "BRANCH_SUPERVISOR" && user.branchId !== branch.id)) return json({ error: "Usuario o sucursal no válidos" }, 400);
    if (data.action === "grant") {
      await prisma.kioskGrant.upsert({ where: { userId_branchId: { userId: user.id, branchId: branch.id } }, create: { userId: user.id, branchId: branch.id, companyId }, update: {} });
    } else {
      await prisma.kioskGrant.deleteMany({ where: { companyId, userId: user.id, branchId: branch.id } });
    }
    await createAuditLog({ request, session: context.session, action: data.action === "grant" ? "GRANT_KIOSK_MANAGEMENT" : "REVOKE_KIOSK_MANAGEMENT", entity: "USER", entityId: user.id, newValues: { branchId: branch.id } });
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
