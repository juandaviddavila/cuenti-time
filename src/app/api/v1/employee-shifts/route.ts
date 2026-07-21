import { NextRequest, NextResponse } from "next/server";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { prisma } from "@/lib/prisma";
import { parseLocalDateParam } from "@/lib/hr/local-date";
import { stringToBigint } from "@/lib/bigint";

export async function GET(request: NextRequest) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const employeeIdBigInt = employeeId ? stringToBigint(employeeId) : undefined;
  const shiftId = searchParams.get("shiftId") ?? undefined;
  const shiftIdBigInt = shiftId ? stringToBigint(shiftId) : undefined;
  const onDate = searchParams.get("date");

  if (employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeIdBigInt, companyId: stringToBigint(auth.companyId) },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
  }

  if (shiftId) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftIdBigInt, companyId: stringToBigint(auth.companyId) },
      select: { id: true },
    });
    if (!shift) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
  }

  const day = onDate ? parseLocalDateParam(onDate) : undefined;

  // Aislamiento: solo asignaciones de empleados de la empresa del token.
  const assignments = await prisma.employeeShift.findMany({
    where: {
      employee: { companyId: stringToBigint(auth.companyId) },
      ...(employeeId ? { employeeId: employeeIdBigInt } : {}),
      ...(shiftId ? { shiftId: stringToBigint(shiftId) } : {}),
      ...(day
        ? {
            startDate: { lte: day },
            OR: [{ endDate: null }, { endDate: { gte: day } }],
          }
        : {}),
    },
    include: {
      employee: { select: { id: true, fullName: true } },
      shift: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
    take: 500,
  });

  return NextResponse.json({ data: assignments });
}
