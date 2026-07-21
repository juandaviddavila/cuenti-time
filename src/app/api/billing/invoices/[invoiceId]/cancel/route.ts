import { NextRequest, NextResponse } from "next/server";
import {
  BillingConflictError,
  BillingValidationError,
  cancelPendingInvoice,
} from "@/lib/billing/service";
import { requireSession } from "@/lib/server-auth";
import { stringToBigint } from "@/lib/bigint";

interface RouteParams {
  params: { invoiceId: string };
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.companyId || (session.role !== "COMPANY_ADMIN" && session.role !== "DEVELOPER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const invoice = await cancelPendingInvoice(stringToBigint(session.companyId), params.invoiceId);
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof BillingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof BillingValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST cancel invoice", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
