import { NextRequest, NextResponse } from "next/server";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "ACTIVE";

  const branches = await prisma.branch.findMany({
    where: {
      companyId: auth.companyId,
      status: status as "ACTIVE" | "INACTIVE",
    },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      city: true,
      phone: true,
      status: true,
      duplicateWindowMinutes: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: branches });
}
