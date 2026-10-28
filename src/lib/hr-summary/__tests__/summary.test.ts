import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePeriod,
  type EmployeeDayContext,
} from "../../hr/day-evaluation";
import { buildExecutiveSummary } from "../summary";
import { canViewHrSummaries } from "../permissions";

const COMPANY_ID = "1";

function employee(
  id: string,
  fullName: string,
  branchId = "b1",
  branchName = "Principal"
): EmployeeDayContext {
  return {
    id,
    fullName,
    documentNumber: `DOC-${id}`,
    branchId,
    branchName,
    positionName: "General",
    companyId: COMPANY_ID,
  };
}

/** Turno Lunes–Viernes 08:00–17:00. */
const OFFICE_SHIFT = {
  id: "s1",
  name: "Oficina",
  mondayStart: "08:00",
  mondayEnd: "17:00",
  tuesdayStart: "08:00",
  tuesdayEnd: "17:00",
  wednesdayStart: "08:00",
  wednesdayEnd: "17:00",
  thursdayStart: "08:00",
  thursdayEnd: "17:00",
  fridayStart: "08:00",
  fridayEnd: "17:00",
  saturdayStart: null,
  saturdayEnd: null,
  sundayStart: null,
  sundayEnd: null,
};

/** Semana laboral de referencia: Lun 2026-01-05 a Vie 2026-01-09. */
const DAYS = [
  new Date(2026, 0, 5),
  new Date(2026, 0, 6),
  new Date(2026, 0, 7),
  new Date(2026, 0, 8),
  new Date(2026, 0, 9),
];

function assignmentsFor(...employeeIds: string[]) {
  return employeeIds.map((id) => ({
    employeeId: id,
    shiftId: "s1",
    startDate: new Date(2025, 11, 1),
    endDate: null,
    shift: OFFICE_SHIFT,
  }));
}

function mark(employeeId: string, day: Date, time: string, type: string) {
  const [h, m] = time.split(":").map(Number);
  return { employeeId, type, recordedAt: new Date(day.setHours(h, m, 0, 0)) };
}

describe("buildExecutiveSummary", () => {
  it("produce totales deterministas sobre tardanzas, ausencias y anomalías", () => {
    const employees = [employee("1", "Ana Ríos"), employee("2", "Bruno Paz")];
    const records = [
      // Ana: puntual toda la semana
      ...DAYS.flatMap((d) => [mark("1", d, "07:55", "CHECK_IN"), mark("1", d, "17:05", "CHECK_OUT")]),
      // Bruno: 10 min tarde cada día (tolerancia 10)
      ...DAYS.flatMap((d) => [mark("2", d, "08:20", "CHECK_IN"), mark("2", d, "17:00", "CHECK_OUT")]),
    ];

    const evaluations = evaluatePeriod({
      employees,
      days: DAYS,
      assignments: assignmentsFor("1", "2"),
      records,
      novelties: [],
      toleranceByCompany: new Map([[COMPANY_ID, 10]]),
    });

    const summary = buildExecutiveSummary(evaluations);

    assert.deepEqual(summary.totals, {
      workDays: 10,
      present: 10,
      late: 5,
      absent: 0,
      justifiedAbsent: 0,
      earlyLeave: 0,
      openDays: 0,
      totalLateMinutes: 50,
      totalEarlyLeaveMinutes: 0,
      punctualityRate: 50,
    });
    assert.deepEqual(summary.topLateEmployees, [
      {
        employeeId: "2",
        employeeName: "Bruno Paz",
        branchId: "b1",
        branchName: "Principal",
        days: 5,
        minutes: 50,
      },
    ]);
    assert.deepEqual(summary.topAbsentEmployees, []);
    assert.deepEqual(summary.anomalies, []);
    assert.deepEqual(summary.byBranch, [
      {
        branchId: "b1",
        branchName: "Principal",
        late: 5,
        absent: 0,
        justifiedAbsent: 0,
        earlyLeave: 0,
        openDays: 0,
        totalLateMinutes: 50,
      },
    ]);
  });

  it("detecta ausencias y anomalías (entrada sin salida) de forma determinista", () => {
    const employees = [
      employee("1", "Ana Ríos"),
      employee("2", "Bruno Paz"),
      employee("3", "Carla Luz"),
    ];
    const records = [
      ...DAYS.flatMap((d) => [mark("1", d, "07:55", "CHECK_IN"), mark("1", d, "17:05", "CHECK_OUT")]),
      // Bruno: marca entrada y salida Lunes–Jueves; el viernes solo entra
      ...DAYS.slice(0, 4).flatMap((d) => [mark("2", d, "08:20", "CHECK_IN"), mark("2", d, "17:00", "CHECK_OUT")]),
      mark("2", DAYS[4], "08:20", "CHECK_IN"),
      // Carla solo asiste el lunes
      mark("3", DAYS[0], "07:50", "CHECK_IN"),
      mark("3", DAYS[0], "17:00", "CHECK_OUT"),
    ];

    const evaluations = evaluatePeriod({
      employees,
      days: DAYS,
      assignments: assignmentsFor("1", "2", "3"),
      records,
      novelties: [],
      toleranceByCompany: new Map([[COMPANY_ID, 10]]),
    });

    const summary = buildExecutiveSummary(evaluations);

    assert.equal(summary.totals.workDays, 15);
    assert.equal(summary.totals.absent, 4);
    assert.equal(summary.totals.openDays, 1);
    assert.equal(summary.totals.late, 5);
    // 15 días laborales − 4 ausencias − 5 tardanzas = 6/15
    assert.equal(summary.totals.punctualityRate, 40);
    assert.deepEqual(summary.topAbsentEmployees, [
      {
        employeeId: "3",
        employeeName: "Carla Luz",
        branchId: "b1",
        branchName: "Principal",
        days: 4,
        minutes: 0,
      },
    ]);
    assert.deepEqual(summary.anomalies, [
      {
        employeeId: "2",
        employeeName: "Bruno Paz",
        branchName: "Principal",
        date: "2026-01-09",
        kind: "SIN_SALIDA",
        label: "Sin salida",
      },
    ]);

    // Determinismo: mismo input → mismo output estable
    const again = buildExecutiveSummary(evaluations);
    assert.equal(JSON.stringify(again), JSON.stringify(summary));
  });

  it("ordena destacados por métrica descendente y desempata por nombre", () => {
    const employees = [
      employee("1", "Zulma Andrade"),
      employee("2", "Álvaro Peña"),
    ];
    const records = [
      ...DAYS.flatMap((d) => [mark("1", d, "08:15", "CHECK_IN"), mark("1", d, "17:00", "CHECK_OUT")]),
      ...DAYS.flatMap((d) => [mark("2", d, "08:15", "CHECK_IN"), mark("2", d, "17:00", "CHECK_OUT")]),
    ];

    const evaluations = evaluatePeriod({
      employees,
      days: DAYS,
      assignments: assignmentsFor("1", "2"),
      records,
      novelties: [],
      toleranceByCompany: new Map([[COMPANY_ID, 10]]),
    });

    const summary = buildExecutiveSummary(evaluations);
    // Mismos 5 min de tardanza: orden alfabético es estable (Álvaro antes que Zulma en "es")
    assert.deepEqual(
      summary.topLateEmployees.map((e) => e.employeeName),
      ["Álvaro Peña", "Zulma Andrade"]
    );
  });
});

describe("canViewHrSummaries", () => {
  it("autoriza roles con acceso a reportes y rechaza FACE_REGISTRAR", () => {
    assert.equal(canViewHrSummaries("FACE_REGISTRAR"), false);
    assert.equal(canViewHrSummaries("REPORT_VIEWER"), true);
    assert.equal(canViewHrSummaries("BRANCH_SUPERVISOR"), true);
    assert.equal(canViewHrSummaries("COMPANY_ADMIN"), true);
    assert.equal(canViewHrSummaries("DEVELOPER"), true);
    assert.equal(canViewHrSummaries("SAAS_SUPER_ADMIN"), true);
  });
});
