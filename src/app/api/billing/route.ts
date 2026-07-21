import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server-auth";
import {
  BillingConflictError,
  BillingValidationError,
  buildQuote,
  createCheckout,
  getCompanyBillingStatus,
  listInvoices,
} from "@/lib/billing/service";
import { stringToBigint } from "@/lib/bigint";

const quoteSchema = z.object({
  targetEmployeeSlots: z.number().int().min(1).max(5000),
  currency: z.enum(["COP", "USD"]),
});

const checkoutSchema = quoteSchema.extend({
  billingCustomer: z.object({
    nombre_cliente: z.string().min(1).max(200),
    identificacion: z.string().min(3).max(50),
    telefono1: z.string().min(5).max(30),
    id_tipo_persona: z.union([z.literal(1), z.literal(2)]),
  }),
});

async function requireCompanyAdmin() {
  const session = await requireSession();
  if (!session.companyId || session.role === "SAAS_SUPER_ADMIN") {
    throw new Response(
      JSON.stringify({
        error: "Debes iniciar sesión con una cuenta de empresa",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  if (session.role !== "COMPANY_ADMIN" && session.role !== "DEVELOPER") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

function mapBillingError(error: unknown) {
  if (error instanceof BillingConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof BillingValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Response) return error;
  console.error("billing route error", error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

export async function GET() {
  try {
    const session = await requireCompanyAdmin();
    const status = await getCompanyBillingStatus(stringToBigint(session.companyId!));
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    return mapBillingError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCompanyAdmin();
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "checkout";

    const company = await prisma.company.findUnique({
      where: { id: stringToBigint(session.companyId!) },
    });
    if (!company) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }

    if (action === "quote") {
      const parsed = quoteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
      }
      const quote = await buildQuote(company, parsed.data);
      return NextResponse.json({ success: true, data: quote });
    }

    if (action === "checkout") {
      const parsed = checkoutSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Datos inválidos", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const invoice = await createCheckout(company, stringToBigint(session.userId), parsed.data);
      return NextResponse.json({ success: true, data: invoice }, { status: 201 });
    }

    if (action === "invoices") {
      const invoices = await listInvoices(stringToBigint(session.companyId!));
      return NextResponse.json({ success: true, data: invoices });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (error) {
    return mapBillingError(error);
  }
}
