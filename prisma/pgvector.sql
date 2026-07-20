-- Run this after the PostgreSQL database exists.
-- The extension must exist before Prisma can create Unsupported("vector(128)").
CREATE EXTENSION IF NOT EXISTS vector;

-- Run this after `pnpm db:push` creates the Employee table.
-- ivfflat speeds nearest-neighbor search using the `<->` L2 distance operator.
CREATE INDEX IF NOT EXISTS "Employee_faceEmbedding_ivfflat_idx"
ON "Employee" USING ivfflat ("faceEmbedding" vector_l2_ops)
WITH (lists = 100)
WHERE "faceEmbedding" IS NOT NULL;
