import { NextRequest, NextResponse } from "next/server";
import {
  isApiTokenContext,
  requireApiToken,
} from "@/lib/api-token-auth";
import { prisma } from "@/lib/prisma";
import { stringToBigint } from "@/lib/bigint";

export async function GET(request: NextRequest) {
  const auth = await requireApiToken(request, "read");
  if (!isApiTokenContext(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const activeParam = searchParams.get("active");
  const active =
    activeParam === null ? true : activeParam === "true" || activeParam === "1";

  const shifts = await prisma.shift.findMany({
    where: { companyId: stringToBigint(auth.companyId),
      ...(activeParam === "all" ? {} : { active }),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: shifts });
}
