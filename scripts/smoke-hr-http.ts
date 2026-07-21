/**
 * HTTP smoke: carga .env (sin imprimir secretos),
 * firma JWT y prueba endpoints + páginas de informes.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env opcional si ya hay env vars
  }
}

loadDotEnv();

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:7578";
const prisma = new PrismaClient();

async function mintCookie() {
  const user = await prisma.user.findUnique({
    where: { email: "admin.distribuidora@cuenti.com" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
    },
  });
  if (!user) throw new Error("user not found");
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  const token = await new SignJWT({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  return `access-token=${token}`;
}

async function main() {
  const cookie = await mintCookie();
  const from = "2026-07-01";
  const to = "2026-07-20";
  const reports = [
    "absences",
    "lates",
    "early_leaves",
    "open_days",
    "employee_summary",
    "branch_summary",
    "daily",
  ] as const;

  const results: Array<Record<string, unknown>> = [];

  for (const report of reports) {
    const res = await fetch(
      `${BASE}/api/reports/hr?report=${report}&from=${from}&to=${to}`,
      { headers: { Cookie: cookie } }
    );
    const json = (await res.json()) as {
      data?: unknown[];
      error?: string;
    };
    const rows = Array.isArray(json.data) ? json.data.length : -1;
    const issues: string[] = [];
    if (!res.ok) issues.push(`HTTP ${res.status}: ${json.error ?? "?"}`);
    if (res.ok && !Array.isArray(json.data)) issues.push("data not array");

    if (report === "lates" && Array.isArray(json.data)) {
      for (const row of json.data as Array<{
        lateMinutes: number;
        novelty?: { excusesLate?: boolean };
      }>) {
        if (row.lateMinutes <= 0) issues.push("lateMinutes<=0");
        if (row.novelty?.excusesLate) issues.push("excusesLate in lates");
      }
    }
    if (report === "absences" && Array.isArray(json.data)) {
      for (const row of json.data as Array<{ outcome: string }>) {
        if (!["AUSENTE", "AUSENCIA_JUSTIFICADA"].includes(row.outcome)) {
          issues.push(`bad outcome ${row.outcome}`);
        }
      }
    }
    if (report === "open_days" && Array.isArray(json.data)) {
      for (const row of json.data as Array<{ outcome: string }>) {
        if (row.outcome !== "SIN_SALIDA") issues.push(`bad ${row.outcome}`);
      }
    }

    results.push({
      report,
      status: res.status,
      rows,
      ok: res.ok && issues.length === 0,
      issues,
    });
  }

  // novelty excusesLate: tomar una fila real de tardanzas y excusarla
  {
    const latesRes = await fetch(
      `${BASE}/api/reports/hr?report=lates&from=${from}&to=${to}`,
      { headers: { Cookie: cookie } }
    );
    const latesJson = (await latesRes.json()) as {
      data: Array<{ employeeId: string; date: string; lateMinutes: number }>;
    };
    const sample = latesJson.data?.[0];
    const company = await prisma.company.findFirst({
      where: { users: { some: { email: "admin.distribuidora@cuenti.com" } } },
    });
    const lateType = company
      ? await prisma.incidentType.findFirst({
          where: { companyId: company.id, excusesLate: true },
        })
      : null;

    if (sample && company && lateType) {
      const [y, m, d] = sample.date.split("-").map(Number);
      const day = new Date(y, m - 1, d, 12, 0, 0, 0);
      const incident = await prisma.incident.create({
        data: {
          companyId: company.id,
          employeeId: BigInt(sample.employeeId),
          incidentTypeId: lateType.id,
          date: day,
          reason: "smoke-test excuse",
        },
      });
      const res = await fetch(
        `${BASE}/api/reports/hr?report=lates&from=${sample.date}&to=${sample.date}&employeeId=${sample.employeeId}`,
        { headers: { Cookie: cookie } }
      );
      const json = (await res.json()) as { data: unknown[] };
      const leaked = (json.data || []).length > 0;
      results.push({
        report: "lates_with_excusesLate_novelty",
        status: res.status,
        rows: (json.data || []).length,
        ok: res.ok && !leaked,
        issues: leaked
          ? ["employee still appears in lates despite excusesLate novelty"]
          : [],
      });
      await prisma.incident.delete({ where: { id: incident.id } });
    } else {
      results.push({
        report: "lates_with_excusesLate_novelty",
        ok: false,
        issues: ["no late sample or excusesLate type to test"],
      });
    }
  }

  const pages = [
    "/reports",
    "/reports/absences",
    "/reports/lates",
    "/reports/early-leaves",
    "/reports/open-days",
    "/reports/employee-summary",
    "/reports/branch-summary",
    "/reports/daily",
    "/reports/no-existe",
  ];
  for (const path of pages) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    const expect404 = path.includes("no-existe");
    const ok = expect404 ? res.status === 404 : res.status === 200;
    results.push({
      report: `PAGE ${path}`,
      status: res.status,
      ok,
      issues: ok ? [] : [`status ${res.status}`],
    });
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(
    (r) => !r.ok || (Array.isArray(r.issues) && (r.issues as string[]).length)
  );
  console.log("FAILED", failed.length);
  if (failed.length) {
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
