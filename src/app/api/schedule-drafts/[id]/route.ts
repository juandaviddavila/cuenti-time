import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import {
  approveScheduleDraft,
  discardScheduleDraft,
  getScheduleDraft,
  ScheduleError,
} from "@/lib/scheduling/service";
import { draftActionSchema } from "@/lib/scheduling/schemas";

/**
 * GET /api/schedule-drafts/[id] — detalle de un borrador (tenant + sucursal).
 * POST /api/schedule-drafts/[id] — { action: "approve" | "discard" }.
 *   approve: validación completa contra datos vigentes + creación atómica
 *   de asignaciones. Solo un humano autorizado puede publicar un borrador.
 */
type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { draft } = await getScheduleDraft(session, params.id);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof ScheduleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/schedule-drafts/[id] error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const parsed = draftActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
  try {
    if (parsed.data.action === "approve") {
      const result = await approveScheduleDraft(session, params.id, request);
      return NextResponse.json(result);
    }
    const { draft } = await discardScheduleDraft(session, params.id, request);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof ScheduleError) {
      return NextResponse.json(
        { error: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error("POST /api/schedule-drafts/[id] error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
