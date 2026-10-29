import { randomBytes } from "node:crypto";
import { hashKioskSecret, validActivation, validKioskDevice } from "./policy";

export interface DeviceRecord {
  id: bigint;
  companyId: bigint;
  branchId: bigint;
  name: string;
  activatedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  activationExpiresAt: Date;
  company: { status: string };
  branch: { id: bigint; companyId: bigint; name: string; status: string; duplicateWindowMinutes: number };
}
export interface DeviceStore {
  kioskDevice: {
    findUnique(args: { where: { activationHash: string } | { tokenHash: string }; include: { company: { select: { status: true } }; branch: true } }): Promise<DeviceRecord | null>;
    updateMany(args: { where: { id: bigint; activatedAt: null; revokedAt: null; activationExpiresAt: { gt: Date }; expiresAt: { gt: Date } }; data: { activatedAt: Date; tokenHash: string } }): Promise<{ count: number }>;
  };
}
const include = { company: { select: { status: true as const } }, branch: true as const };
const secretFormat = /^[A-Za-z0-9_-]{43}$/;

export async function activateKiosk(code: string, db: DeviceStore, now = new Date()): Promise<{ token: string; device: DeviceRecord } | null> {
  if (!secretFormat.test(code)) return null;
  const device = await db.kioskDevice.findUnique({ where: { activationHash: hashKioskSecret(code) }, include });
  if (!device || !validActivation(device, now) || device.expiresAt <= now || device.company.status !== "ACTIVE" || device.branch.status !== "ACTIVE" || device.branch.companyId !== device.companyId) return null;
  const token = randomBytes(32).toString("base64url");
  // Compare-and-set: only one simultaneous redemption may claim this invitation.
  const claimed = await db.kioskDevice.updateMany({
    where: { id: device.id, activatedAt: null, revokedAt: null, activationExpiresAt: { gt: now }, expiresAt: { gt: now } },
    data: { activatedAt: now, tokenHash: hashKioskSecret(token) },
  });
  return claimed.count === 1 ? { token, device } : null;
}
export async function readKioskDevice(token: string, db: DeviceStore, now = new Date()): Promise<DeviceRecord | null> {
  if (!secretFormat.test(token)) return null;
  const device = await db.kioskDevice.findUnique({ where: { tokenHash: hashKioskSecret(token) }, include });
  return device && device.branch.companyId === device.companyId && validKioskDevice({ ...device, companyStatus: device.company.status, branchStatus: device.branch.status }, now) ? device : null;
}
