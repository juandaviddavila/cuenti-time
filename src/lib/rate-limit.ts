/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window per IP. Not suitable for multi-instance deployments
 * (use Redis in production). Sufficient for single-server or dev.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now();
  Array.from(store.entries()).forEach(([key, entry]) => {
    if (entry.resetAt < now) store.delete(key);
  });
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Max requests in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    // New window
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, entry);
    return { allowed: true, remaining: config.limit - 1, resetAt: entry.resetAt };
  }

  existing.count += 1;
  const allowed = existing.count <= config.limit;
  return {
    allowed,
    remaining: Math.max(0, config.limit - existing.count),
    resetAt: existing.resetAt,
  };
}
