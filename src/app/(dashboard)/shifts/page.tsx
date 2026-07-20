import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession, getCompanyFilter } from "@/lib/server-auth";
import { ShiftsClient } from "./shifts-client";
import type { Shift } from "./shifts-client";

export default async function ShiftsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const companyFilter = getCompanyFilter(session);

  const shifts = await prisma.shift.findMany({
    where: companyFilter,
    orderBy: { name: "asc" },
  });

  const serialized: Shift[] = shifts.map((s) => ({
    id: s.id,
    companyId: s.companyId,
    name: s.name,
    mondayStart: s.mondayStart,
    mondayEnd: s.mondayEnd,
    tuesdayStart: s.tuesdayStart,
    tuesdayEnd: s.tuesdayEnd,
    wednesdayStart: s.wednesdayStart,
    wednesdayEnd: s.wednesdayEnd,
    thursdayStart: s.thursdayStart,
    thursdayEnd: s.thursdayEnd,
    fridayStart: s.fridayStart,
    fridayEnd: s.fridayEnd,
    saturdayStart: s.saturdayStart,
    saturdayEnd: s.saturdayEnd,
    sundayStart: s.sundayStart,
    sundayEnd: s.sundayEnd,
    active: s.active,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <ShiftsClient
      companyId={session.companyId ?? ""}
      userRole={session.role}
      shifts={serialized}
    />
  );
}
