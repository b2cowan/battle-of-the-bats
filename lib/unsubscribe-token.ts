/**
 * Signed unsubscribe tokens for CASL-compliant email opt-out.
 *
 * Format: HMAC-SHA256(orgId + ':' + UNSUBSCRIBE_SECRET), truncated to 32 hex chars.
 * No auth required to unsubscribe — the token IS the authorization.
 *
 * Environment variable: UNSUBSCRIBE_SECRET (32-char hex string minimum).
 * Add to .env.local and Amplify environment variables.
 *
 * WITHOUT THE SECRET THERE IS NO LINK (Signed-in family accounts Stage 1, Part 7). There is no fallback secret: a fixed
 * one in the source would let anyone mint a link that opts any club, coach or family out. Signing returns null, so no
 * unsubscribe link is drawn rather than a forgeable one, and every token is refused ("this link doesn't work").
 */

import { createHmac } from 'crypto';

function getSecret(): string | null {
  // Signed with the value exactly as set (never trimmed): a link already in an inbox must keep its token (/review).
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret?.trim()) {
    console.warn('[unsubscribe-token] UNSUBSCRIBE_SECRET is not set: no unsubscribe link is signed or accepted');
    return null;
  }
  return secret;
}

/** The token for a message, or null when there is no secret. */
function sign(message: string): string | null {
  const secret = getSecret();
  return secret ? createHmac('sha256', secret).update(message).digest('hex').slice(0, 32) : null;
}

/** Constant-time compare of a token against the one expected (null = no secret: never a match). */
function sameToken(expected: string | null, token: string): boolean {
  if (!expected || expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Generate a signed unsubscribe token for an org.
 * Embed in every outgoing marketing email footer.
 */
export function generateUnsubscribeToken(orgId: string): string | null {
  return sign(`${orgId}:unsubscribe`);
}

/**
 * Verify an unsubscribe token received via GET /unsubscribe.
 * Constant-time comparison to prevent timing attacks.
 */
export function verifyUnsubscribeToken(orgId: string, token: string): boolean {
  if (!orgId || !token) return false;
  return sameToken(generateUnsubscribeToken(orgId), token);
}

/**
 * Build the full unsubscribe URL for a given org (null without the secret).
 * Used by email-sender.ts to inject into the email footer.
 */
export function buildUnsubscribeUrl(orgId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const token = generateUnsubscribeToken(orgId);
  if (!token) return null;
  return `${base}/unsubscribe?org=${encodeURIComponent(orgId)}&token=${encodeURIComponent(token)}`;
}

// ── Per-USER unsubscribe (CASL fix — coach-audience campaigns) ─────────────────
// An email sent to an individual (a coach) must unsubscribe THAT PERSON, not the org it
// happens to be attributed to. A distinct HMAC message suffix keeps user tokens and org
// tokens non-interchangeable, so a user token can never flip an org's opt-out and vice versa.

export function generateUserUnsubscribeToken(userId: string): string | null {
  return sign(`${userId}:unsubscribe-user`);
}

export function verifyUserUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  return sameToken(generateUserUnsubscribeToken(userId), token);
}

export function buildUserUnsubscribeUrl(userId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const token = generateUserUnsubscribeToken(userId);
  if (!token) return null;
  return `${base}/unsubscribe?user=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}

// ── Per-GUARDIAN unsubscribe (Chunk D 0.3 — "Email families") ──────────────────
// A guardian on a team roster has no account, so neither existing variant fits: the ORG
// token would opt the whole organization out of its own marketing on one parent's click,
// and the USER token needs a user id that does not exist. This variant is keyed on
// (org, normalized email) — the de-facto family identity — and a third distinct HMAC
// suffix keeps all three token families non-interchangeable, so no guardian link can
// ever flip an org-wide or per-coach opt-out.
//
// Known and accepted property, inherited from the whole rail: these tokens are
// DETERMINISTIC, so a link stays live for as long as the secret does. That is the right
// trade for an unsubscribe — a stale forwarded link can only ever stop mail reaching an
// address, never start it or reveal anything — but it means the address travels in the
// URL. It is the recipient's own address, in their own mail.

/** Normalized inside so a caller passing raw casing can't mint a token that fails to verify. */
function guardianKey(orgId: string, email: string): string {
  return `${orgId}:${email.trim().toLowerCase()}:unsubscribe-guardian`;
}

export function generateGuardianUnsubscribeToken(orgId: string, email: string): string | null {
  return sign(guardianKey(orgId, email));
}

export function verifyGuardianUnsubscribeToken(orgId: string, email: string, token: string): boolean {
  if (!orgId || !email || !token) return false;
  return sameToken(generateGuardianUnsubscribeToken(orgId, email), token);
}

export function buildGuardianUnsubscribeUrl(orgId: string, email: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const normalized = email.trim().toLowerCase();
  const token = generateGuardianUnsubscribeToken(orgId, normalized);
  if (!token) return null;
  return `${base}/unsubscribe?org=${encodeURIComponent(orgId)}&guardian=${encodeURIComponent(normalized)}&token=${encodeURIComponent(token)}`;
}

// ── Per-SECOND-PARENT stop (Signed-in family accounts Stage 3b) ─────────────────
// The "Stop these emails" button on a second parent's copy of a sign-up email. A fourth distinct HMAC suffix, keyed on
// (org, normalised email) like the guardian family but with its own suffix, so the four families stay non-interchangeable:
// a guardian or org unsubscribe link can never stop a second parent's address, and this link can never opt an org or a
// family out of anything. It opens a confirm page (/second-parent-stop); only the POST behind that page writes. Same
// accepted trade as the rest of the file: deterministic, never expires, and the address travels in the URL (the
// recipient's own address, in their own mail). A stale forwarded link can only ever stop mail reaching that address.

function secondParentStopKey(orgId: string, email: string): string {
  return `${orgId}:${email.trim().toLowerCase()}:stop-second-parent`;
}

export function generateSecondParentStopToken(orgId: string, email: string): string | null {
  return sign(secondParentStopKey(orgId, email));
}

export function verifySecondParentStopToken(orgId: string, email: string, token: string): boolean {
  if (!orgId || !email || !token) return false;
  return sameToken(generateSecondParentStopToken(orgId, email), token);
}

/** The link on a second parent's copy, or null when there is no secret (no button is drawn rather than a forgeable one). */
export function buildSecondParentStopUrl(orgId: string, email: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const normalized = email.trim().toLowerCase();
  const token = generateSecondParentStopToken(orgId, normalized);
  if (!token) return null;
  return `${base}/second-parent-stop?org=${encodeURIComponent(orgId)}&email=${encodeURIComponent(normalized)}&token=${encodeURIComponent(token)}`;
}

// ── "Don't send me invitations" on a rep coach's invitation (Signed-in family accounts Stage 4a, Part 5.3) ─────
// A fifth distinct HMAC suffix, keyed on the INVITATION id (not the address): no address rides in this link (Stage 2 ruling 2),
// and the page finds the club and the address from the invitation. Like the rest of the file it is deterministic and never
// expires, and it can only ever STOP invitations reaching that address at that club — never start one or reveal the address
// (the page shows it partly hidden). It opens a confirm page (/invitation-stop); only the POST behind that page writes.

function inviteStopKey(invitationId: string): string {
  return `${invitationId}:stop-family-invitations`;
}

export function generateInviteStopToken(invitationId: string): string | null {
  return sign(inviteStopKey(invitationId));
}

export function verifyInviteStopToken(invitationId: string, token: string): boolean {
  if (!invitationId || !token) return false;
  return sameToken(generateInviteStopToken(invitationId), token);
}

/** The link in a rep coach's invitation email, or null when there is no secret (then the invitation is not sent: the
 *  commercial-message standard needs a working way to refuse). */
export function buildInviteStopUrl(invitationId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const token = generateInviteStopToken(invitationId);
  if (!token) return null;
  return `${base}/invitation-stop?i=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}`;
}
