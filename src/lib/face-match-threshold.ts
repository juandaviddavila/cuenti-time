/**
 * Umbrales de match facial en escala de DISTANCIA COSENO (operador `<=>` de
 * pgvector) sobre embeddings ArcFace de 512 dimensiones ya normalizados.
 *
 * Solo identidad: no reutilizar estos umbrales para comparación de prendas
 * (ver `docs/clothing-checkout-alert.md`).
 *
 * distancia = 1 - similitud coseno, así que el rango útil es [0, 2] y en la
 * práctica ArcFace deja la misma persona por debajo de ~0.45 y personas distintas
 * por encima de ~0.7.
 *
 * Los valores de la etapa anterior (face-api 128-D, distancia euclidiana) NO son
 * comparables con estos.
 */
export const DEFAULT_FACE_MATCH_THRESHOLD = 0.5;

export const FACE_MATCH_THRESHOLD_MIN = 0.2;
export const FACE_MATCH_THRESHOLD_MAX = 1.0;

/**
 * Margen mínimo absoluto entre 1.º y 2.º (dist2 - dist1).
 * Con ArcFace un match legítimo supera al segundo candidato con holgura;
 * un margen estrecho delata dos personas parecidas.
 */
export const DEFAULT_FACE_MATCH_MARGIN = 0.1;

/**
 * Techo duro de calidad: aunque el umbral de empresa sea más alto,
 * no aceptar distancias peores que esto (evita "casi parecido").
 */
export const FACE_MATCH_HARD_MAX_DISTANCE = 0.55;

/** El 2.º debe estar al menos 20% más lejos que el 1.º. */
export const FACE_MATCH_MIN_SECOND_RATIO = 1.2;

export function clampFaceMatchThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FACE_MATCH_THRESHOLD;
  return Math.min(
    FACE_MATCH_THRESHOLD_MAX,
    Math.max(FACE_MATCH_THRESHOLD_MIN, value)
  );
}

/** true si el mejor candidato supera claramente al segundo (margen absoluto). */
export function isFaceMatchUnambiguous(
  bestDistance: number,
  secondDistance: number | null | undefined,
  margin: number = DEFAULT_FACE_MATCH_MARGIN
): boolean {
  if (secondDistance == null || !Number.isFinite(secondDistance)) return true;
  return secondDistance - bestDistance >= margin;
}

export type FaceMatchDecisionReason =
  | "match"
  | "no_match"
  | "ambiguous"
  | "weak_match";

export interface FaceMatchDecision {
  ok: boolean;
  reason: FaceMatchDecisionReason;
  /** Umbral efectivo aplicado (min empresa + techo duro). */
  effectiveThreshold: number;
  margin: number;
}

/**
 * Reglas estrictas anti-confusión:
 * 1) dist1 < min(umbralEmpresa, techo duro)
 * 2) margen absoluto vs 2.º
 * 3) ratio dist2/dist1 >= 1.2 cuando hay 2.º
 */
export function decideFaceMatch(input: {
  bestDistance: number;
  secondDistance?: number | null;
  companyThreshold: number;
  margin?: number;
}): FaceMatchDecision {
  const margin = input.margin ?? DEFAULT_FACE_MATCH_MARGIN;
  const companyThreshold = clampFaceMatchThreshold(input.companyThreshold);
  const effectiveThreshold = Math.min(
    companyThreshold,
    FACE_MATCH_HARD_MAX_DISTANCE
  );
  const best = input.bestDistance;
  const second = input.secondDistance;

  if (!Number.isFinite(best) || best >= effectiveThreshold) {
    return {
      ok: false,
      reason: best < companyThreshold ? "weak_match" : "no_match",
      effectiveThreshold,
      margin,
    };
  }

  if (!isFaceMatchUnambiguous(best, second, margin)) {
    return { ok: false, reason: "ambiguous", effectiveThreshold, margin };
  }

  if (
    second != null &&
    Number.isFinite(second) &&
    best > 0 &&
    second / best < FACE_MATCH_MIN_SECOND_RATIO
  ) {
    return { ok: false, reason: "ambiguous", effectiveThreshold, margin };
  }

  return { ok: true, reason: "match", effectiveThreshold, margin };
}
