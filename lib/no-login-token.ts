import 'server-only';
import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

/**
 * lib/no-login-token.ts — ONE home for the no-login token convention.
 *
 * Four surfaces independently re-implemented the same three lines (discovery G4):
 * `lib/tryout-offer-token.ts` (since DELETED — the tryout offer email and its family
 * Accept/Decline loop were retired 2026-08-26), `lib/tryout-evaluator-token.ts`,
 * `lib/assistant-invite-token.ts`, and the team-workspace claim flow. The convention
 * they share is sound — 32 random bytes → base64url in the URL, SHA-256 hex in the
 * database, so a database read can never reconstruct a live link. What none of them
 * had was RATE LIMITING.
 *
 * That gap matters more for Chunk D than it did for the others. Entropy makes GUESSING
 * a token hopeless, but it does nothing about two other things a family surface invites:
 * a caller hammering a token they already hold, and a caller hammering the request
 * endpoint itself. So the shared helper carries the limiter, and every new rail gets it
 * by construction rather than by remembering.
 *
 * The existing four rails are deliberately left alone here — retro-fitting them is a
 * behaviour change to shipped flows (a coach on a hotel wifi sharing an IP with a
 * tryout weekend's worth of evaluators would start seeing 429s), and it belongs in its
 * own change with its own QA. They can adopt `checkNoLoginRateLimit` one at a time.
 */

/** A fresh, URL-safe token (32 random bytes → ~43 base64url chars). */
export function generateNoLoginToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest — the only form ever stored or queried by. */
export function hashNoLoginToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time-ish guard for tokens arriving from a URL. A token whose SHAPE is wrong
 * never reaches the database — this keeps malformed input (and the odd path-traversal
 * probe) out of a query that would otherwise run for every scan of the endpoint.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,64}$/;

export function isPlausibleNoLoginToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_SHAPE.test(token);
}

// ── Rate limiting ──────────────────────────────────────────────────────────────

/** Which rail is being hit — keeps one abusive surface from exhausting another's budget. */
export type NoLoginRail =
  | 'family_join_view'      // GET the request page's team card
  | 'family_join_request'   // POST an access request
  | 'calendar_refused';     // a calendar feed read that was REFUSED — never a good one (see below)

interface RailPolicy {
  limit: number;
  windowSeconds: number;
}

/**
 * Deliberately generous — this is an abuse ceiling, not a usage cap. A real family
 * opening a link, reading it, signing in and coming back sits in single digits. A
 * calendar app polling a feed is the one rail with legitimately repetitive traffic,
 * so it gets a much higher ceiling over a longer window.
 */
const POLICIES: Record<NoLoginRail, RailPolicy> = {
  family_join_view:    { limit: 60,  windowSeconds: 600 },
  family_join_request: { limit: 10,  windowSeconds: 3600 },
  calendar_refused:    { limit: 600, windowSeconds: 3600 },
};

/**
 * ⚠⚠ A CALENDAR FEED COUNTS ONLY ITS REFUSED READS (Club Tier Stage 6d, A4; S6D-03 — the owner's cost ruling,
 * 2026-10-11). The feed used to count EVERY read, by caller address, across every feed: one budget of 240 an hour.
 * Google and iCloud fetch subscriptions from shared servers, so one of their servers polling many teams' feeds would
 * exhaust that budget and every feed it reads would stop — the calendars simply freeze, with nothing to tell anyone —
 * and the counter wrote a row on every read. Now a good read touches nothing here: no read, no write. Only a read we
 * refuse (a link we never issued: a bad shape, a bad signature, an unknown family token, an unknown team) is counted,
 * and past the ceiling it is answered "too many" instead of "not found". A stopped link is not a refusal — it answers
 * an empty calendar, deliberately, and is never counted. The ceiling is generous because a shared calendar server
 * polling a mistyped address on behalf of many people is still one address.
 */
export async function countRefusedCalendarRead(request: Request): Promise<RateLimitVerdict> {
  return checkNoLoginRateLimit('calendar_refused', request);
}

/**
 * Hash the caller's IP before it becomes a database key. We need to COUNT a caller,
 * not identify one — and a rate-limit table that accumulates raw IPs against family
 * surfaces is a new personal-data store nobody asked for.
 */
function subjectKey(request: Request, extra?: string): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return crypto.createHash('sha256').update(`${ip}:${extra ?? ''}`).digest('hex').slice(0, 32);
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds a caller should wait — surfaced as Retry-After so a well-behaved client backs off. */
  retryAfterSeconds: number;
}

/**
 * Count this request against the rail's budget.
 *
 * FAILS OPEN. If the counter itself is unavailable, a family trying to reach their
 * team's schedule should not be locked out by our own infrastructure — the token
 * remains the real credential, and this is defence in depth, not the defence.
 */
export async function checkNoLoginRateLimit(
  rail: NoLoginRail,
  request: Request,
  extra?: string,
): Promise<RateLimitVerdict> {
  const policy = POLICIES[rail];
  try {
    const { data, error } = await supabaseAdmin.rpc('bump_no_login_rate_limit', {
      p_rail: rail,
      p_subject: subjectKey(request, extra),
      p_window_seconds: policy.windowSeconds,
    });
    if (error) throw error;
    const attempts = typeof data === 'number' ? data : Number(data ?? 0);
    return {
      allowed: attempts <= policy.limit,
      retryAfterSeconds: policy.windowSeconds,
    };
  } catch (err) {
    console.error(`[no-login-token] rate-limit check failed for ${rail}; allowing (fail-open):`, err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/** Standard 429 for a rail that ran out of budget. Deliberately says nothing about
 *  whether the token was valid — a rate-limit response must not become an oracle. */
export function tooManyRequests(verdict: RateLimitVerdict): Response {
  return new Response(
    JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Please try again shortly.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(verdict.retryAfterSeconds || 60),
      },
    },
  );
}
