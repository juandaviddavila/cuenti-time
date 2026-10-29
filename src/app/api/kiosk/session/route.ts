import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readKioskDevice } from "@/lib/kiosk/service";
import { KIOSK_COOKIE_NAME } from "@/lib/kiosk/routes";

export async function GET() {
  const token = cookies().get(KIOSK_COOKIE_NAME)?.value;
  const device = token ? await readKioskDevice(token, prisma) : null;
  if (!device) return NextResponse.json({ error: "Kiosco no activado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ name: device.name, branch: { id: device.branchId.toString(), name: device.branch.name, duplicateWindowMinutes: device.branch.duplicateWindowMinutes }, expiresAt: device.expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
