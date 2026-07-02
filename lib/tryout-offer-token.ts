import crypto from 'crypto';

/**
 * No-account guardian offer-response links (Phase 2B.5).
 *
 * When a coach/admin extends an offer, the server mints a token that travels ONLY in the email URL
 * the guardian receives. We persist just the SHA-256 hash (`rep_tryout_registrations.offer_token_hash`)
 * — a database read can never reconstruct a live link. On response the server hashes the incoming
 * token and looks the registration up by hash. Same posture as the evaluator token / team_workspace_claims.
 */

/** A fresh, URL-safe offer-response token (32 random bytes → ~43 base64url chars). */
export function generateOfferToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest of a token — the only form we ever store or query by. */
export function hashOfferToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
