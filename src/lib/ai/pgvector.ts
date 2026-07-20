export const FACE_EMBEDDING_DIMENSIONS = 128;

export function normalizeFaceEmbedding(value: number[]) {
  if (value.length !== FACE_EMBEDDING_DIMENSIONS) {
    throw new Error(`El embedding facial debe tener ${FACE_EMBEDDING_DIMENSIONS} dimensiones`);
  }

  return value.map((item) => {
    if (!Number.isFinite(item)) {
      throw new Error("El embedding facial contiene valores inválidos");
    }
    return Number(item);
  });
}

export function toPgVector(value: number[]) {
  return `[${normalizeFaceEmbedding(value).join(",")}]`;
}

export function fromPgVector(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;

  const parsed = trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => Number(item));

  try {
    return normalizeFaceEmbedding(parsed);
  } catch {
    return null;
  }
}
