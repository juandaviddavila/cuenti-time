import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import {
  calculatePlanTotalCOP,
  copToWompiCents,
  type BillingCycle,
} from "@/lib/pricing";
import {
  buildCheckoutIntegritySignature,
  generatePaymentReference,
  getWompiPublicKey,
} from "@/lib/wompi";

const checkoutSchema = z.object({
  billingCycle: z.enum(["monthly", "yearly"]),
  additionalEmployees: z.number().int().min(0).max(500),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.companyId || session.role === "SAAS_SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Debes iniciar sesión con una cuenta de empresa para pagar" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const publicKey = getWompiPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Pasarela de pago no configurada (WOMPI_PUBLIC_KEY)" },
      { status: 503 }
    );
  }

  const billingCycle = parsed.data.billingCycle as BillingCycle;
  const amountCop = calculatePlanTotalCOP(billingCycle, parsed.data.additionalEmployees);
  const amountInCents = copToWompiCents(amountCop);
  const reference = generatePaymentReference();

  await prisma.payment.create({
    data: {
      companyId: BigInt(session.companyId),
      wompiReference: reference,
      amount: amountInCents,
      billingCycle,
      additionalEmployees: parsed.data.additionalEmployees,
      status: "PENDING",
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:7578";
  const redirectUrl = `${appUrl}/pricing/success?reference=${encodeURIComponent(reference)}`;
  const integritySignature = buildCheckoutIntegritySignature(reference, amountInCents);

  return NextResponse.json({
    publicKey,
    currency: "COP",
    amountInCents,
    amountCop,
    reference,
    integritySignature,
    redirectUrl,
    billingCycle,
    additionalEmployees: parsed.data.additionalEmployees,
  });
}
