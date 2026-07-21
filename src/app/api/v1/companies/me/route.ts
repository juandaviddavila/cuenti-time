import { NextRequest, NextResponse } from "next/server";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { prisma } from "@/lib/prisma";
import { stringToBigint } from "@/lib/bigint";

/** Datos de la empresa dueña del token (nunca otra). */
export async function GET(request: NextRequest) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  const company = await prisma.company.findFirst({
    where: { id: stringToBigint(auth.companyId), status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      legalName: true,
      taxId: true,
      email: true,
      phone: true,
      city: true,
      country: true,
      status: true,
      maxEmployees: true,
      subscriptionExpiresAt: true,
      lateToleranceMinutes: true,
      earlyLeaveToleranceMinutes: true,
      faceMatchThreshold: true,
      createdAt: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ data: company });
}
