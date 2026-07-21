import { NextRequest, NextResponse } from "next/server";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { prisma } from "@/lib/prisma";
import { stringToBigint } from "@/lib/bigint";

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  // findFirst + companyId: evita fuga si el id existe en otra empresa.
  const employee = await prisma.employee.findFirst({
    where: { id: stringToBigint(params.id), companyId: stringToBigint(auth.companyId) },
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
  });

  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }
  return NextResponse.json(employee);
}
