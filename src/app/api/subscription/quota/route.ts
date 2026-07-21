import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import { getFaceQuotaStatus } from "@/lib/subscription";
import { stringToBigint } from "@/lib/bigint";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  const quota = await getFaceQuotaStatus(stringToBigint(session.companyId));
  if (!quota) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  return NextResponse.json(quota);
}
