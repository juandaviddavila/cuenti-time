import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { toPgVector } from "@/lib/ai/pgvector";
import {
  clampFaceMatchThreshold,
  DEFAULT_FACE_MATCH_THRESHOLD,
} from "@/lib/face-match-threshold";
import { stringToBigint } from "@/lib/bigint";

const searchFaceSchema = z.object({
  descriptor: z.array(z.number()).length(128),
  branchId: z.coerce.bigint().positive().optional(),
});

interface FaceSearchRow {
  employeeId: string;
  fullName: string;
  position: string | null;
  photo: string | null;
  branchId: string;
  distance: number;
}

async function resolveCompanyThreshold(
  companyId: bigint | null | undefined
): Promise<number> {
  if (!companyId) return DEFAULT_FACE_MATCH_THRESHOLD;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { faceMatchThreshold: true },
  });
  return clampFaceMatchThreshold(
    company?.faceMatchThreshold ?? DEFAULT_FACE_MATCH_THRESHOLD
  );
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

  const parsed = searchFaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const companyFilter = getCompanyFilter(session);
  const threshold = await resolveCompanyThreshold(session.companyId ? stringToBigint(session.companyId) : null);

  const companyWhere = companyFilter.companyId
    ? Prisma.sql`AND e."companyId" = ${companyFilter.companyId}`
    : Prisma.empty;
  const branchWhere = parsed.data.branchId
    ? Prisma.sql`AND e."branchId" = ${parsed.data.branchId}`
    : Prisma.empty;
  const queryVector = toPgVector(parsed.data.descriptor);

  const matches = await prisma.$queryRaw<FaceSearchRow[]>`
    SELECT
      e."id"::text AS "employeeId",
      e."fullName",
      p."name" AS "position",
      e."photo",
      e."branchId"::text,
      (e."faceEmbedding" <-> ${queryVector}::vector) AS "distance"
    FROM "Employee" e
    LEFT JOIN "Position" p ON p."id" = e."positionId"
    WHERE e."status" = 'ACTIVE'
      ${companyWhere}
      ${branchWhere}
      AND e."faceEmbedding" IS NOT NULL
    ORDER BY e."faceEmbedding" <-> ${queryVector}::vector
    LIMIT 1
  `;

  const best = matches[0];
  if (!best || best.distance > threshold) {
    return NextResponse.json({ match: null, threshold });
  }

  return NextResponse.json({
    match: {
      employeeId: best.employeeId,
      fullName: best.fullName,
      position: best.position,
      photo: best.photo,
      branchId: best.branchId,
      distance: best.distance,
    },
    threshold,
  });
}
