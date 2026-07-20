import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServerSession } from "@/lib/server-auth";

interface CreateAuditLogOptions {
  request: NextRequest;
  session: ServerSession | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  companyId?: string | null;
}

export async function createAuditLog(options: CreateAuditLogOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: options.companyId ?? options.session?.companyId ?? null,
        userId: options.session?.userId ?? null,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId ?? null,
        oldValues: options.oldValues ? (options.oldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValues: options.newValues ? (options.newValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress:
          options.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          options.request.headers.get("x-real-ip") ??
          null,
        userAgent: options.request.headers.get("user-agent") ?? null,
      },
    });
  } catch (err) {
    console.error("createAuditLog error:", err);
  }
}
