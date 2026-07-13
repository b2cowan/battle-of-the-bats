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

// ── Per-USER unsubscribe (CASL fix — coach-audience campaigns) ─────────────────
// An email sent to an individual (a coach) must unsubscribe THAT PERSON, not the org it
// happens to be attributed to. A distinct HMAC message suffix keeps user tokens and org
// tokens non-interchangeable, so a user token can never flip an org's opt-out and vice versa.

export function generateUserUnsubscribeToken(userId: string): string {
  const secret = getSecret();
  return createHmac('sha256', secret)
    .update(`${userId}:unsubscribe-user`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyUserUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  const expected = generateUserUnsubscribeToken(userId);
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

export function buildUserUnsubscribeUrl(userId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const token = generateUserUnsubscribeToken(userId);
  return `${base}/unsubscribe?user=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}
