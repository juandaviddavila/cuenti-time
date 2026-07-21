import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";
import { fromPgVector } from "@/lib/ai/pgvector";
import {
  clampFaceMatchThreshold,
  DEFAULT_FACE_MATCH_THRESHOLD,
} from "@/lib/face-match-threshold";
import { stringToBigint } from "@/lib/bigint";

interface FaceDescriptorRow {
  employeeId: string;
  fullName: string;
  position: string | null;
  photo: string | null;
  branchId: string;
  descriptor: string | null;
}

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyFilter = getCompanyFilter(session);
  const companyWhere = companyFilter.companyId
    ? Prisma.sql`AND e."companyId" = ${companyFilter.companyId}`
    : Prisma.empty;

  const employees = await prisma.$queryRaw<FaceDescriptorRow[]>`
    SELECT
      e."id"::text AS "employeeId",
      e."fullName",
      p."name" AS "position",
      e."photo",
      e."branchId"::text,
      e."faceEmbedding"::text AS "descriptor"
    FROM "Employee" e
    LEFT JOIN "Position" p ON p."id" = e."positionId"
    WHERE e."status" = 'ACTIVE'
      ${companyWhere}
      AND (e."faceEmbedding" IS NOT NULL OR e."photo" IS NOT NULL)
  `;

  let faceMatchThreshold = DEFAULT_FACE_MATCH_THRESHOLD;
  if (session.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: stringToBigint(session.companyId) },
      select: { faceMatchThreshold: true },
    });
    faceMatchThreshold = clampFaceMatchThreshold(
      company?.faceMatchThreshold ?? DEFAULT_FACE_MATCH_THRESHOLD
    );
  }

  return NextResponse.json({
    faceMatchThreshold,
    data: employees.map((e) => ({
      employeeId: e.employeeId,
      fullName: e.fullName,
      position: e.position,
      photo: e.photo,
      branchId: e.branchId,
      descriptor: fromPgVector(e.descriptor),
    })),
  });
}
