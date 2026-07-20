import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWompiEventChecksum } from "@/lib/wompi";
import { applyApprovedPayment } from "@/lib/payment-renewal";

interface WompiWebhookBody {
  event: string;
  data: {
    transaction: {
      id: string;
      status: string;
      reference: string;
      amount_in_cents: number;
    };
  };
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
}

export async function POST(request: NextRequest) {
  let body: WompiWebhookBody;
  try {
    body = (await request.json()) as WompiWebhookBody;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  try {
    const isValid = verifyWompiEventChecksum(
      body.data as unknown as Record<string, unknown>,
      body.signature,
      body.timestamp
    );

    if (!isValid) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  } catch (err) {
    console.error("Wompi webhook signature error:", err);
    return NextResponse.json({ error: "Configuración de webhook inválida" }, { status: 503 });
  }

  const transaction = body.data?.transaction;
  if (!transaction?.reference) {
    return NextResponse.json({ ok: true });
  }

  const payment = await prisma.payment.findUnique({
    where: { wompiReference: transaction.reference },
  });

  if (!payment) {
    return NextResponse.json({ ok: true });
  }

  if (transaction.status === "APPROVED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { wompiSignature: transaction.id },
    });
    await applyApprovedPayment(payment.id);
  } else if (transaction.status === "DECLINED" || transaction.status === "ERROR") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "REJECTED", wompiSignature: transaction.id },
    });
  }

  return NextResponse.json({ ok: true });
}
