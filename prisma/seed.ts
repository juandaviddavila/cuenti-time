import { PrismaClient, UserRole, Status, DocumentType, AttendanceType, ValidationResult } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de FaceAccess SaaS...");

  // ─── Super Admin ────────────────────────────────────────────────────────────
  const superAdminPassword = await bcrypt.hash("Admin2024!", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@cuenti.com" },
    update: { emailVerifiedAt: new Date(), emailVerificationToken: null, emailVerificationExpiresAt: null },
    create: {
      name: "Super Administrador",
      email: "superadmin@cuenti.com",
      password: superAdminPassword,
      role: UserRole.SAAS_SUPER_ADMIN,
      status: Status.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
  console.log("✅ Super admin creado: superadmin@cuenti.com / Admin2024!");

  // ─── Company 1 ─────────────────────────────────────────────────────────────
  const company1 = await prisma.company.upsert({
    where: { taxId: "900123456-7" },
    update: {},
    create: {
      name: "Distribuidora Andina",
      legalName: "Distribuidora Andina S.A.S.",
      taxId: "900123456-7",
      email: "admin.distribuidora@cuenti.com",
      phone: "+57 1 2345678",
      address: "Cra 15 # 93-47",
      city: "Bogotá",
      country: "Colombia",
      status: Status.ACTIVE,
      subscriptionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días de prueba
      maxEmployees: 10,
    },
  });

  // ─── Company 2 ─────────────────────────────────────────────────────────────
  const company2 = await prisma.company.upsert({
    where: { taxId: "800987654-1" },
    update: {},
    create: {
      name: "Textiles del Norte",
      legalName: "Textiles del Norte Ltda.",
      taxId: "800987654-1",
      email: "admin.textiles@cuenti.com",
      phone: "+57 5 6543210",
      address: "Cl 72 # 50-40",
      city: "Barranquilla",
      country: "Colombia",
      status: Status.ACTIVE,
      subscriptionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días de prueba
      maxEmployees: 10,
    },
  });

  console.log("✅ Empresas creadas (7 días de prueba, 10 empleados máx)");

  // ─── Branches Company 1 ────────────────────────────────────────────────────
  const branch1 = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company1.id, code: "BOG-001" } },
    update: {},
    create: {
      companyId: company1.id,
      name: "Sede Principal Bogotá",
      code: "BOG-001",
      address: "Cra 15 # 93-47",
      city: "Bogotá",
      phone: "+57 1 2345678",
      status: Status.ACTIVE,
      latitude: 4.6761,
      longitude: -74.0477,
      radiusMeters: 500,
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company1.id, code: "MED-001" } },
    update: {},
    create: {
      companyId: company1.id,
      name: "Sucursal Medellín",
      code: "MED-001",
      address: "El Poblado, Cl 10 # 42-30",
      city: "Medellín",
      phone: "+57 4 3456789",
      status: Status.ACTIVE,
      latitude: 6.2099,
      longitude: -75.5752,
      radiusMeters: 300,
    },
  });

  const branch3 = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company2.id, code: "BRQ-001" } },
    update: {},
    create: {
      companyId: company2.id,
      name: "Planta Barranquilla",
      code: "BRQ-001",
      address: "Cl 72 # 50-40",
      city: "Barranquilla",
      phone: "+57 5 6543210",
      status: Status.ACTIVE,
      latitude: 10.9878,
      longitude: -74.7889,
      radiusMeters: 400,
    },
  });

  console.log("✅ Sucursales creadas");

  // ─── Users ─────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin2024!", 12);

  const adminC1 = await prisma.user.upsert({
    where: { email: "admin.distribuidora@cuenti.com" },
    update: { emailVerifiedAt: new Date(), emailVerificationToken: null, emailVerificationExpiresAt: null },
    create: {
      companyId: company1.id,
      name: "Ricardo Torres",
      email: "admin.distribuidora@cuenti.com",
      password: adminPassword,
      role: UserRole.COMPANY_ADMIN,
      status: Status.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email: "supervisor.distribuidora@cuenti.com" },
    update: { emailVerifiedAt: new Date(), emailVerificationToken: null, emailVerificationExpiresAt: null },
    create: {
      companyId: company1.id,
      name: "Luisa Fernández",
      email: "supervisor.distribuidora@cuenti.com",
      password: adminPassword,
      role: UserRole.BRANCH_SUPERVISOR,
      status: Status.ACTIVE,
      branchId: branch1.id,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email: "admin.textiles@cuenti.com" },
    update: { emailVerifiedAt: new Date(), emailVerificationToken: null, emailVerificationExpiresAt: null },
    create: {
      companyId: company2.id,
      name: "Jorge Herrera",
      email: "admin.textiles@cuenti.com",
      password: adminPassword,
      role: UserRole.COMPANY_ADMIN,
      status: Status.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("✅ Usuarios creados");
  console.log("   admin.distribuidora@cuenti.com / Admin2024!");
  console.log("   admin.textiles@cuenti.com / Admin2024!");

  // ─── Positions ─────────────────────────────────────────────────────────────
  const company1Positions = new Map<string, string>();
  const company2Positions = new Map<string, string>();
  const allPositionNames = [
    "general",
    "Coordinadora de Ventas", "Analista Contable", "Asistente de Gerencia",
    "Técnico de Soporte", "Coordinadora de Operaciones", "Mensajero",
    "Operaria de Producción", "Supervisor de Planta",
  ];
  for (const name of allPositionNames) {
    const pos1 = await prisma.position.upsert({
      where: { companyId_name: { companyId: company1.id, name } },
      update: {},
      create: { companyId: company1.id, name, active: true },
    });
    company1Positions.set(name, pos1.id);

    const pos2 = await prisma.position.upsert({
      where: { companyId_name: { companyId: company2.id, name } },
      update: {},
      create: { companyId: company2.id, name, active: true },
    });
    company2Positions.set(name, pos2.id);
  }

  // ─── Employees ─────────────────────────────────────────────────────────────
  const employeeData = [
    { fullName: "María Alejandra López", documentNumber: "1020304050", position: "Coordinadora de Ventas", branchId: branch1.id, faceRegistered: true },
    { fullName: "Jorge Esteban Ramírez", documentNumber: "1020304051", position: "Analista Contable", branchId: branch1.id, faceRegistered: true },
    { fullName: "Valentina Castro Ruiz", documentNumber: "1020304052", position: "Asistente de Gerencia", branchId: branch1.id, faceRegistered: false },
    { fullName: "Andrés Felipe Morales", documentNumber: "1020304053", position: "Técnico de Soporte", branchId: branch2.id, faceRegistered: true },
    { fullName: "Diana Sofía Peña", documentNumber: "1020304054", position: "Coordinadora de Operaciones", branchId: branch2.id, faceRegistered: true },
    { fullName: "Carlos Iván Suárez", documentNumber: "1020304055", position: "Mensajero", branchId: branch1.id, faceRegistered: false },
    { fullName: "Natalia Marcela Díaz", documentNumber: "1020304060", position: "Operaria de Producción", branchId: branch3.id, faceRegistered: true },
    { fullName: "Jesús Antonio Vargas", documentNumber: "1020304061", position: "Supervisor de Planta", branchId: branch3.id, faceRegistered: true },
  ];

  const employees = [];
  for (const emp of employeeData) {
    const companyId = emp.branchId === branch3.id ? company2.id : company1.id;
    const positionId = emp.branchId === branch3.id
      ? company2Positions.get(emp.position)
      : company1Positions.get(emp.position);
    const employee = await prisma.employee.upsert({
      where: { companyId_documentNumber: { companyId, documentNumber: emp.documentNumber } },
      update: {},
      create: {
        companyId,
        branchId: emp.branchId,
        fullName: emp.fullName,
        documentType: DocumentType.CC,
        documentNumber: emp.documentNumber,
        positionId,
        email: `${emp.fullName.split(" ")[0].toLowerCase()}@empresa.com`,
        phone: `+57 3${Math.floor(Math.random() * 100000000).toString().padStart(9, "0")}`,
        status: Status.ACTIVE,
        faceRegistered: emp.faceRegistered,
        faceRegisteredAt: emp.faceRegistered ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null,
        biometricConsentAt: emp.faceRegistered ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null,
        hireDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        internalCode: `EMP-${emp.documentNumber.slice(-4)}`,
      },
    });
    employees.push(employee);
  }

  console.log("✅ Empleados creados");

  // ─── Incident Types ────────────────────────────────────────────────────────
  const incidentTypesSeed: Array<{
    name: string;
    countsAsAbsence?: boolean;
    excusesLate?: boolean;
    excusesEarlyLeave?: boolean;
  }> = [
    // Horario especial / catch-all: NO exonera puntualidad (solo overrides de hora).
    { name: "general", excusesLate: false, excusesEarlyLeave: false },
    { name: "General", excusesLate: false, excusesEarlyLeave: false },
    {
      name: "Permiso personal",
      countsAsAbsence: true,
      excusesLate: true,
      excusesEarlyLeave: true,
    },
    {
      name: "Incapacidad",
      countsAsAbsence: true,
      excusesLate: true,
      excusesEarlyLeave: true,
    },
    { name: "Vacaciones", countsAsAbsence: true },
    { name: "Horas extras" },
    { name: "Llegada tarde", excusesLate: true },
    { name: "Salida anticipada", excusesEarlyLeave: true },
    { name: "Capacitación", excusesLate: true, excusesEarlyLeave: true },
    { name: "Día compensatorio", countsAsAbsence: true },
  ];
  for (const item of incidentTypesSeed) {
    const flags = {
      countsAsAbsence: item.countsAsAbsence ?? false,
      excusesLate: item.excusesLate ?? false,
      excusesEarlyLeave: item.excusesEarlyLeave ?? false,
    };
    await prisma.incidentType.upsert({
      where: { companyId_name: { companyId: company1.id, name: item.name } },
      update: flags,
      create: { companyId: company1.id, name: item.name, active: true, ...flags },
    });
    await prisma.incidentType.upsert({
      where: { companyId_name: { companyId: company2.id, name: item.name } },
      update: flags,
      create: { companyId: company2.id, name: item.name, active: true, ...flags },
    });
  }
  console.log("✅ Tipos de novedad creados");

  // ─── Shifts ─────────────────────────────────────────────────────────────────
  const shiftsData = [
    {
      id: "shift-c1-diurno",
      name: "Turno diurno",
      mondayStart: "08:00", mondayEnd: "17:00",
      tuesdayStart: "08:00", tuesdayEnd: "17:00",
      wednesdayStart: "08:00", wednesdayEnd: "17:00",
      thursdayStart: "08:00", thursdayEnd: "17:00",
      fridayStart: "08:00", fridayEnd: "17:00",
    },
    {
      id: "shift-c1-nocturno",
      name: "Turno nocturno",
      mondayStart: "20:00", mondayEnd: "06:00",
      tuesdayStart: "20:00", tuesdayEnd: "06:00",
      wednesdayStart: "20:00", wednesdayEnd: "06:00",
      thursdayStart: "20:00", thursdayEnd: "06:00",
      fridayStart: "20:00", fridayEnd: "06:00",
    },
    {
      id: "shift-c1-medio",
      name: "Medio tiempo",
      mondayStart: "08:00", mondayEnd: "12:00",
      tuesdayStart: "08:00", tuesdayEnd: "12:00",
      wednesdayStart: "08:00", wednesdayEnd: "12:00",
      thursdayStart: "08:00", thursdayEnd: "12:00",
      fridayStart: "08:00", fridayEnd: "12:00",
    },
  ];
  for (const shift of shiftsData) {
    const { id, ...shiftFields } = shift;
    await prisma.shift.upsert({
      where: { id },
      update: {},
      create: { companyId: company1.id, active: true, id, ...shiftFields },
    });
    const id2 = id.replace("c1", "c2");
    await prisma.shift.upsert({
      where: { id: id2 },
      update: {},
      create: { companyId: company2.id, active: true, id: id2, ...shiftFields },
    });
  }
  console.log("✅ Turnos creados");

  // ─── Employee ↔ Shift assignments (requerido por informes RR.HH.) ───────────
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const company1Employees = employees.filter((e) => e.companyId === company1.id);
  const company2Employees = employees.filter((e) => e.companyId === company2.id);

  for (const [index, employee] of company1Employees.entries()) {
    const shiftId =
      index % 3 === 0
        ? "shift-c1-diurno"
        : index % 3 === 1
          ? "shift-c1-nocturno"
          : "shift-c1-medio";
    const existing = await prisma.employeeShift.findFirst({
      where: { employeeId: employee.id, shiftId },
    });
    if (!existing) {
      await prisma.employeeShift.create({
        data: {
          employeeId: employee.id,
          shiftId,
          startDate: startOfYear,
        },
      });
    }
  }
  for (const [index, employee] of company2Employees.entries()) {
    const shiftId =
      index % 3 === 0
        ? "shift-c2-diurno"
        : index % 3 === 1
          ? "shift-c2-nocturno"
          : "shift-c2-medio";
    const existing = await prisma.employeeShift.findFirst({
      where: { employeeId: employee.id, shiftId },
    });
    if (!existing) {
      await prisma.employeeShift.create({
        data: {
          employeeId: employee.id,
          shiftId,
          startDate: startOfYear,
        },
      });
    }
  }
  console.log("✅ Asignaciones de turno creadas");

  // ─── Attendance Records (last 7 days) ──────────────────────────────────────
  const registeredEmployees = employees.filter(
    (e) => e.faceRegistered && [branch1.id, branch2.id, branch3.id].includes(e.branchId)
  );

  for (const employee of registeredEmployees) {
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      // Skip weekends
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // 90% chance of attendance
      if (Math.random() > 0.1) {
        // Check-in (7:45 - 8:30)
        const checkIn = new Date(date);
        checkIn.setHours(7 + Math.floor(Math.random() * 1), 45 + Math.floor(Math.random() * 45), 0, 0);

        await prisma.attendanceRecord.create({
          data: {
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId: employee.id,
            type: AttendanceType.CHECK_IN,
            recordedAt: checkIn,
            validationStatus: ValidationResult.SUCCESS,
            confidenceScore: 0.85 + Math.random() * 0.14,
            livenessScore: 0.80 + Math.random() * 0.19,
            isManual: false,
          },
        });

        // Check-out (16:30 - 18:00)
        const checkOut = new Date(date);
        checkOut.setHours(16 + Math.floor(Math.random() * 2), 30 + Math.floor(Math.random() * 30), 0, 0);

        await prisma.attendanceRecord.create({
          data: {
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId: employee.id,
            type: AttendanceType.CHECK_OUT,
            recordedAt: checkOut,
            validationStatus: ValidationResult.SUCCESS,
            confidenceScore: 0.85 + Math.random() * 0.14,
            livenessScore: 0.80 + Math.random() * 0.19,
            isManual: false,
          },
        });
      }
    }
  }

  console.log("✅ Registros de asistencia creados (últimos 7 días)");

  // ─── Failed validations ────────────────────────────────────────────────────
  const failReasons = ["LOW_CONFIDENCE", "LIVENESS_FAILED", "SPOOFING_DETECTED", "FACE_NOT_FOUND"];
  for (let i = 0; i < 15; i++) {
    await prisma.faceValidationLog.create({
      data: {
        companyId: Math.random() > 0.5 ? company1.id : company2.id,
        branchId: Math.random() > 0.5 ? branch1.id : branch2.id,
        result: failReasons[Math.floor(Math.random() * failReasons.length)] as ValidationResult,
        reason: "Validación facial fallida en intento de marcación",
        confidenceScore: Math.random() * 0.5,
        livenessScore: Math.random() * 0.5,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log("✅ Logs de validación fallida creados");
  console.log("\n🎉 Seed completado exitosamente!");
  console.log("\n📋 Credenciales de acceso:");
  console.log("   Super Admin: superadmin@cuenti.com / Admin2024!");
  console.log("   Admin Empresa 1: admin.distribuidora@cuenti.com / Admin2024!");
  console.log("   Admin Empresa 2: admin.textiles@cuenti.com / Admin2024!");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
