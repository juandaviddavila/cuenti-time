/** Default face-api / pgvector Euclidean distance threshold. */
export const DEFAULT_FACE_MATCH_THRESHOLD = 0.6;

export const FACE_MATCH_THRESHOLD_MIN = 0.2;
export const FACE_MATCH_THRESHOLD_MAX = 1.2;

export function clampFaceMatchThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FACE_MATCH_THRESHOLD;
  return Math.min(
    FACE_MATCH_THRESHOLD_MAX,
    Math.max(FACE_MATCH_THRESHOLD_MIN, value)
  );
}
