-- Migración one-shot de face-api (128-D, distancia euclidiana) a
-- ArcFace MobileFaceNet (512-D, distancia coseno).
--
-- Prisma NO diffea columnas `Unsupported`, así que `db push` deja intacta la
-- definición de `faceEmbedding`: el cambio de tipo tiene que hacerse aquí.
--
-- ORDEN:
--   1. pnpm db:generate && pnpm db:push        (resto del esquema)
--   2. psql "$DATABASE_URL" -f prisma/migrate-arcface-512.sql
--   3. Reiniciar el proceso next
--   4. Backfill desde fotos en /settings/face-migration
--
-- Postgres no puede convertir un vector(128) en vector(512): la columna debe
-- quedar vacía antes del ALTER. Los embeddings viejos no son recuperables, pero
-- los empleados con foto se reconstruyen con el backfill.

BEGIN;

DROP INDEX IF EXISTS "Employee_faceEmbedding_ivfflat_idx";

-- `faceRegistered` se conserva a propósito: estos empleados ya estaban enrolados
-- y rehacer su embedding es un RE-registro, que el control de cupo permite
-- aunque la empresa esté en el límite. Ponerlo en false los convertiría en altas
-- nuevas y el backfill fallaría con 402 en planes al tope.
UPDATE "Employee"
SET "faceEmbedding" = NULL
WHERE "faceEmbedding" IS NOT NULL;

ALTER TABLE "Employee"
ALTER COLUMN "faceEmbedding" TYPE vector(512);

CREATE INDEX IF NOT EXISTS "Employee_faceEmbedding_ivfflat_idx"
ON "Employee" USING ivfflat ("faceEmbedding" vector_cosine_ops)
WITH (lists = 100)
WHERE "faceEmbedding" IS NOT NULL;

-- Los umbrales de la escala euclidiana no significan lo mismo en coseno.
UPDATE "Company"
SET "faceMatchThreshold" = 0.5;

COMMIT;
