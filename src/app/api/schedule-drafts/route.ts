import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server-auth";
import {
  createScheduleDraft,
  listScheduleDrafts,
  ScheduleError,
} from "@/lib/scheduling/service";
import { generateDraftSchema } from "@/lib/scheduling/schemas";

/**
 * GET /api/schedule-drafts — borradores del tenant (supervisor: su sucursal).
 * POST /api/schedule-drafts — genera y guarda un borrador (sin aplicarlo).
 */
export async function GET(_request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { drafts } = await listScheduleDrafts(session);
    return NextResponse.json({ drafts });
  } catch (err) {
    if (err instanceof ScheduleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/schedule-drafts error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
  const parsed = generateDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  try {
    const { draft } = await createScheduleDraft(session, parsed.data);
    return NextResponse.json({ draft }, { status: 201 });
  } catch (err) {
    if (err instanceof ScheduleError) {
      return NextResponse.json(
        { error: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error("POST /api/schedule-drafts error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
