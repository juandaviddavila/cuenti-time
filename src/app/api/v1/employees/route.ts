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
  const branchId = searchParams.get("branchId") ?? undefined;

  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId: auth.companyId,
      status: status as "ACTIVE" | "INACTIVE",
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true,
      fullName: true,
      documentType: true,
      documentNumber: true,
      email: true,
      phone: true,
      photo: true,
      status: true,
      branch: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      faceRegistered: true,
      createdAt: true,
    },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({ data: employees });
}
