import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, getCompanyFilter } from "@/lib/server-auth";

interface BackfillCandidateRow {
  employeeId: string;
  fullName: string;
  photo: string;
  branchName: string | null;
}

interface BackfillStatsRow {
  total: bigint;
  withEmbedding: bigint;
  pending: bigint;
  withoutPhoto: bigint;
}

/**
 * Empleados cuyo embedding se puede reconstruir desde su foto tras la migración
 * a ArcFace 512-D. `Employee.photo` guarda el JPEG en base64, así que el cliente
 * puede generar el vector sin descargar nada más.
 */
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

  const candidates = await prisma.$queryRaw<BackfillCandidateRow[]>`
    SELECT
      e."id"::text AS "employeeId",
      e."fullName",
      e."photo",
      b."name" AS "branchName"
    FROM "Employee" e
    LEFT JOIN "Branch" b ON b."id" = e."branchId"
    WHERE e."status" = 'ACTIVE'
      ${companyWhere}
      AND e."faceEmbedding" IS NULL
      AND e."photo" IS NOT NULL
    ORDER BY e."fullName"
  `;

  const [stats] = await prisma.$queryRaw<BackfillStatsRow[]>`
    SELECT
      count(*) AS "total",
      count(e."faceEmbedding") AS "withEmbedding",
      count(*) FILTER (
        WHERE e."faceEmbedding" IS NULL AND e."photo" IS NOT NULL
      ) AS "pending",
      count(*) FILTER (
        WHERE e."faceEmbedding" IS NULL AND e."photo" IS NULL
      ) AS "withoutPhoto"
    FROM "Employee" e
    WHERE e."status" = 'ACTIVE'
      ${companyWhere}
  `;

  return NextResponse.json({
    stats: {
      total: Number(stats?.total ?? 0),
      withEmbedding: Number(stats?.withEmbedding ?? 0),
      pending: Number(stats?.pending ?? 0),
      withoutPhoto: Number(stats?.withoutPhoto ?? 0),
    },
    candidates,
  });
}
