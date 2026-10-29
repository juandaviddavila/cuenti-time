import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSession, type ServerSession } from "@/lib/server-auth";
import { readKioskDevice } from "./service";
import { KIOSK_COOKIE_NAME } from "./routes";

export interface AttendanceSession extends ServerSession { kioskBranchId?: string; kioskDeviceId?: string }
// Used only by the six explicitly allowed kiosk data operations, never by
// requireSession(), dashboard routes, user management or API integrations.
export async function requireAttendanceSession(): Promise<AttendanceSession> {
  // Ordinary dashboard requests keep their existing account-session behavior.
  // The kiosk explicitly opts into device scope even when an account is open.
  if (headers().get("x-kiosk-mode") !== "1") {
    try { return await requireSession(); } catch { /* device-only browser */ }
  }
  const token = cookies().get(KIOSK_COOKIE_NAME)?.value;
  if (!token) throw new Response("Unauthorized", { status: 401 });
  const device = await readKioskDevice(token, prisma);
  if (!device) throw new Response("Unauthorized", { status: 401 });
  return { userId: "0", companyId: device.companyId.toString(), role: "FACE_REGISTRAR", email: "", name: device.name, isImpersonating: false, kioskBranchId: device.branchId.toString(), kioskDeviceId: device.id.toString() };
}
