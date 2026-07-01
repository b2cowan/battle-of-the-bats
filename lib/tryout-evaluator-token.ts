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

/** A fresh, URL-safe evaluator link token (32 random bytes → ~43 base64url chars). */
export function generateEvaluatorToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest of a token — the only form we ever store or query by. */
export function hashEvaluatorToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
