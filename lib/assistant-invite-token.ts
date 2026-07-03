import crypto from 'crypto';

/** Assistant-coach invite token: a high-entropy URL token whose SHA-256 hash is stored server-side
 *  (the raw token lives only in the emailed link). Mirrors lib/tryout-offer-token.ts. */
export function generateAssistantInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashAssistantInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
