/**
 * Signed unsubscribe tokens for CASL-compliant email opt-out.
 *
 * Format: HMAC-SHA256(orgId + ':' + UNSUBSCRIBE_SECRET), truncated to 32 hex chars.
 * No auth required to unsubscribe — the token IS the authorization.
 *
 * Environment variable: UNSUBSCRIBE_SECRET (32-char hex string minimum).
 * Add to .env.local and Amplify environment variables.
 */

import { createHmac } from 'crypto';

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    // Fallback for local dev without the env var set — NOT for production.
    // In production, Amplify will have the real secret.
    console.warn('[unsubscribe-token] UNSUBSCRIBE_SECRET not set — using insecure fallback');
    return 'insecure-dev-fallback-do-not-use-in-production';
  }
  return secret;
}

/**
 * Generate a signed unsubscribe token for an org.
 * Embed in every outgoing marketing email footer.
 */
export function generateUnsubscribeToken(orgId: string): string {
  const secret = getSecret();
  return createHmac('sha256', secret)
    .update(`${orgId}:unsubscribe`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Verify an unsubscribe token received via GET /unsubscribe.
 * Constant-time comparison to prevent timing attacks.
 */
export function verifyUnsubscribeToken(orgId: string, token: string): boolean {
  if (!orgId || !token) return false;
  const expected = generateUnsubscribeToken(orgId);
  // Constant-time compare (both are 32 hex chars)
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Build the full unsubscribe URL for a given org.
 * Used by email-sender.ts to inject into the email footer.
 */
export function buildUnsubscribeUrl(orgId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const token = generateUnsubscribeToken(orgId);
  return `${base}/unsubscribe?org=${encodeURIComponent(orgId)}&token=${encodeURIComponent(token)}`;
}
