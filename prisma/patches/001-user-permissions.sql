-- Ejecutar si `npx prisma db push` no está disponible.
-- Añade campos de permisos de usuario y OTP de login.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bypassGeofence" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canManageIntegrations" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginOtpHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginOtpExpiresAt" TIMESTAMP(3);
