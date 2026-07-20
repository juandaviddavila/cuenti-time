import { NextRequest, NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { prisma } from "@/lib/prisma";
import { parseLocalDateParam } from "@/lib/hr/local-date";

export async function GET(request: NextRequest) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const date = searchParams.get("date");
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const branchId = searchParams.get("branchId") ?? undefined;
  const incidentTypeId = searchParams.get("incidentTypeId") ?? undefined;

  if (employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
  }
  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!branch) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }
  }
  if (incidentTypeId) {
    const type = await prisma.incidentType.findFirst({
      where: { id: incidentTypeId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!type) {
      return NextResponse.json({ error: "Tipo de novedad no encontrado" }, { status: 404 });
    }
  }

  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (date) {
    const d = parseLocalDateParam(date);
    dateFilter = { gte: startOfDay(d), lte: endOfDay(d) };
  } else if (from || to) {
    dateFilter = {
      ...(from ? { gte: startOfDay(parseLocalDateParam(from)) } : {}),
      ...(to ? { lte: endOfDay(parseLocalDateParam(to)) } : {}),
    };
  }

  const incidents = await prisma.incident.findMany({
    where: {
      companyId: auth.companyId,
      ...(employeeId ? { employeeId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(incidentTypeId ? { incidentTypeId } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: {
      employee: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
      shift: { select: { id: true, name: true } },
      incidentType: {
        select: {
          id: true,
          name: true,
          countsAsAbsence: true,
          excusesLate: true,
          excusesEarlyLeave: true,
        },
      },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  return NextResponse.json({ data: incidents });
}
