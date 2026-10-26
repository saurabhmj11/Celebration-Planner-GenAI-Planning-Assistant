/**
 * In-memory sliding-window rate limiter.
 *
 * Protects serverless AI endpoints from abuse (cost control + DoS hardening).
 * Uses a fixed-window counter per client key with lazy cleanup, which keeps the
 * memory footprint O(active clients) and requires zero external infrastructure.
 *
 * Notes:
 * - Suitable for single-instance deployments (Vercel serverless / dev server).
 * - For multi-instance production, swap the store for Redis/Upstash — the
 *   public API of `checkRateLimit` stays identical.
 */

interface RateLimitEntry {
  /** Reset timestamp (epoch ms) for the current window. */
  resetAt: number;
  /** Requests consumed inside the current window. */
  count: number;
}

interface RateLimitOptions {
  /** Unique bucket name (e.g. "ai:themes"). */
  key: string;
  /** Max requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the window resets (only meaningful when blocked). */
  resetAt: number;
  /** Seconds until the window resets (only meaningful when blocked). */
  retryAfterSec: number;
}

const buckets = new Map<string, RateLimitEntry>();
const MAX_TRACKED_KEYS = 10_000;

/** Lazily evict expired/overflowing entries to keep memory bounded. */
function sweep(now: number): void {
  // Fast path: only scan for expired entries once the map grows.
  if (buckets.size < MAX_TRACKED_KEYS / 2) return;

  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
  // Hard cap: if still oversized, drop the oldest half defensively.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const keys = Array.from(buckets.keys());
    for (let i = 0; i < keys.length / 2; i++) buckets.delete(keys[i]);
  }
}

/**
 * Check (and consume) one request slot for the given bucket + client key.
 * Pure side-effect on an in-process store — safe to call on every request.
 */
export function checkRateLimit(
  clientKey: string,
  { key, limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const mapKey = `${key}:${clientKey}`;
  const entry = buckets.get(mapKey);

  // No entry, or the previous window already elapsed -> open a fresh window.
  if (!entry || entry.resetAt <= now) {
    buckets.set(mapKey, { resetAt: now + windowMs, count: 1 });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs, retryAfterSec: 0 };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: entry.resetAt,
      retryAfterSec: 0,
    };
  }

  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfterSec };
}

/** Test-only helper: wipe all tracked buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Derive a best-effort client identifier from request headers.
 * `x-forwarded-for` is respected behind proxies (Vercel, Caddy); falls back to
 * a constant so local dev never blocks itself.
 */
export function getClientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local-client";
}
