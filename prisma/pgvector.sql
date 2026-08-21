-- Run this after the PostgreSQL database exists.
-- The extension must exist before Prisma can create Unsupported("vector(512)").
CREATE EXTENSION IF NOT EXISTS vector;

-- Run this after `pnpm db:push` applies vector(512).
-- ArcFace produce vectores L2-normalizados, así que la métrica nativa es la
-- distancia coseno (`<=>`), no la euclidiana que usaba face-api.
CREATE INDEX IF NOT EXISTS "Employee_faceEmbedding_ivfflat_idx"
ON "Employee" USING ivfflat ("faceEmbedding" vector_cosine_ops)
WITH (lists = 100)
WHERE "faceEmbedding" IS NOT NULL;
