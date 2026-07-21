import { NextResponse } from "next/server";
import { getPublicBillingConfig } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

/** Público — la landing marketing consulta precios desde aquí. */
export async function GET() {
  try {
    const data = await getPublicBillingConfig();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/billing/config", error);
    return NextResponse.json(
      { error: "No se pudo cargar la configuración de precios" },
      { status: 500 }
    );
  }
}
