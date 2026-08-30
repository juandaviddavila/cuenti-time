-- Backfill idempotente: una plantilla 'frontal' por empleado con embedding
-- y sin plantillas previas. Correr una vez tras crear la tabla FaceTemplate.
INSERT INTO "FaceTemplate" ("employeeId", "label", "createdAt", "embedding")
SELECT e."id", 'frontal', NOW(), e."faceEmbedding"
FROM "Employee" e
WHERE e."faceEmbedding" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "FaceTemplate" t WHERE t."employeeId" = e.id
  );
