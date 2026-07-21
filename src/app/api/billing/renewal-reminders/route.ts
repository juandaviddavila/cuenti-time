import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/billing/env";

/**
 * Cron: recordatorio 2 días antes del vencimiento.
 * Authorization: Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const inTwoDaysStart = new Date(now);
  inTwoDaysStart.setDate(inTwoDaysStart.getDate() + 2);
  inTwoDaysStart.setHours(0, 0, 0, 0);
  const inTwoDaysEnd = new Date(inTwoDaysStart);
  inTwoDaysEnd.setHours(23, 59, 59, 999);

  const companies = await prisma.company.findMany({
    where: {
      plan: "paid",
      subscriptionStatus: "active",
      subscriptionExpiresAt: {
        gte: inTwoDaysStart,
        lte: inTwoDaysEnd,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      subscriptionExpiresAt: true,
      subscriptionRenewalReminderFor: true,
    },
  });

  const renewalUrl = `${getAppBaseUrl()}/pricing`;
  let sent = 0;

  for (const company of companies) {
    if (
      company.subscriptionRenewalReminderFor &&
      company.subscriptionExpiresAt &&
      company.subscriptionRenewalReminderFor.getTime() ===
        company.subscriptionExpiresAt.getTime()
    ) {
      continue;
    }

    await sendEmail({
      to: company.email,
      subject: "Tu suscripción de cuenti time vence en 2 días",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
          <h1>Renovación de plan</h1>
          <p>Hola ${company.name},</p>
          <p>Tu suscripción vence el <strong>${company.subscriptionExpiresAt?.toISOString().slice(0, 10)}</strong>.</p>
          <p>Renueva ahora para no interrumpir marcaciones, reportes e integraciones:</p>
          <p><a href="${renewalUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px">Renovar plan</a></p>
        </div>
      `,
    });

    await prisma.company.update({
      where: { id: company.id },
      data: { subscriptionRenewalReminderFor: company.subscriptionExpiresAt },
    });
    sent += 1;
  }

  return NextResponse.json({ success: true, matched: companies.length, sent });
}
