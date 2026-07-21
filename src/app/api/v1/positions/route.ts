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

  const positions = await prisma.position.findMany({
    where: { companyId: stringToBigint(auth.companyId),
      ...(activeParam === "all" ? {} : { active }),
    },
    select: { id: true, name: true, active: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: positions });
}
