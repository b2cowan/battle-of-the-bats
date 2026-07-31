import crypto from 'crypto';

/**
 * No-account evaluator scoring links (Phase 2B.2).
 *
 * The head coach mints a link per co-coach; the raw token travels only in the URL
 * the coach shares. We persist ONLY the SHA-256 hash (`rep_tryout_evaluator_sessions.token_hash`),
 * so a database read can never reconstruct a live link — the same posture as
 * `team_workspace_claims`. On each score write the server hashes the incoming token
 * and looks the session up by hash.
 */

/** Evaluator links live for 48 hours — long enough for a multi-session tryout weekend. ONE home
 *  for the number: the mint route and the reissue route must never drift apart on it. */
export const EVALUATOR_LINK_TTL_MS = 48 * 60 * 60 * 1000;

/** A fresh, URL-safe evaluator link token (32 random bytes → ~43 base64url chars). */
export function generateEvaluatorToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest of a token — the only form we ever store or query by. */
export function hashEvaluatorToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Deterministic identity key for a coach scoring AS THEMSELVES (Chunk E, WI-1).
 *
 * The self-score route needs to find "this coach's own evaluator session for this tryout"
 * across visits and devices, and the table deliberately has no user column. So the self
 * session's `token_hash` is derived from (tryoutId, userId) — same row every time, one
 * scoring identity per coach per tryout.
 *
 * Why this is safe WITHOUT a secret: a stored hash is never a credential. The public
 * route hashes the PRESENTED 43-char token and looks that up — a `self:`-prefixed value
 * can never equal `sha256(token)` (wrong length, wrong alphabet), so no URL can ever
 * reach a self session; the only door to it is the session-authenticated coach route.
 * Knowing the row's key gets an attacker nothing they can present anywhere.
 *
 * The prefix is load-bearing in every place that separates links from self sessions (the
 * link-listing db query, the scoreboard's "(you)" flag, the reissue/revoke IDOR guards) —
 * ONE constant so no surface can re-type it.
 */
export const SELF_TOKEN_HASH_PREFIX = 'self:';

export function selfEvaluatorTokenHash(tryoutId: string, userId: string): string {
  return SELF_TOKEN_HASH_PREFIX + crypto.createHash('sha256').update(`tryout-self:${tryoutId}:${userId}`).digest('hex');
}
