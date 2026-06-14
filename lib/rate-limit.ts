/**
 * Minimal in-memory rate limiting for serverless route handlers.
 *
 * Best-effort by design: state is per-Lambda-instance (the same posture as the inlined throttles in
 * app/api/feedback + app/api/client/error-capture). This app has no external store (Redis/Upstash)
 * wired, so a determined attacker spread across many warm instances is bounded by a GLOBAL limiter a
 * caller layers on top, not by the per-identity buckets. Good enough to blunt scripted abuse of an
 * expensive, rarely-legitimate-in-bulk action (e.g. creating a free workspace) during a capped beta.
 *
 * Fixed-window counters (not sliding) keep memory O(active keys) — one small bucket per key, with
 * the oldest bucket evicted when the map exceeds `maxKeys`.
 */

interface Bucket {
  /** Window start (ms epoch). */
  start: number;
  count: number;
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
    private readonly maxKeys = 5000,
  ) {}

  /**
   * Record a hit for `key` and report whether it is still within budget.
   * Returns true when the request is ALLOWED (and the hit is counted), false when `key` has already
   * spent its allowance for the current window. A blocked call does NOT consume further budget.
   */
  take(key: string, now: number = Date.now()): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket || now - bucket.start >= this.windowMs) {
      bucket = { start: now, count: 0 };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= this.max) return false;
    bucket.count += 1;
    this.evictIfFull();
    return true;
  }

  // Drop the single oldest bucket rather than clearing the map (a clear() would reset every key's
  // window and let a flood through). Keeps the map bounded without nullifying rate limiting.
  private evictIfFull(): void {
    if (this.buckets.size <= this.maxKeys) return;
    let oldestKey: string | null = null;
    let oldestStart = Infinity;
    for (const [k, v] of this.buckets) {
      if (v.start < oldestStart) {
        oldestStart = v.start;
        oldestKey = k;
      }
    }
    if (oldestKey !== null) this.buckets.delete(oldestKey);
  }
}

/** Best-effort client IP from proxy headers. Spoofable by a direct caller, so per-IP limits should
 *  always be backed by a global limiter. Mirrors app/api/client/error-capture. */
export function clientIpFrom(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
