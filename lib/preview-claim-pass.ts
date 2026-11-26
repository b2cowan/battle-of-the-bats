/**
 * lib/preview-claim-pass.ts — what a right claim code hands the next steps, and the visitor a wrong code is counted
 * against (Club Website Track P, Session P3; T7). Pure node (no database), so a test signs and checks it.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { payLinkSecret } from './team-pay-link';
import { CLAIM_PASS_HOURS, isClaimCodeShape } from './preview-claim';

// ── The pass: what a right code hands the next steps ──────────────────────────────────────────────────────────────────
// A right code returns a pass that carries the claim through the account step and its confirm email (any device, tab
// 6.1). It is bound to the club AND the code, so New code kills every pass made from the old one, and it lapses after
// CLAIM_PASS_HOURS. It never holds the code itself. Signed with the pay-link secret under its own prefix.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function passSignature(orgId: string, code: string, expires: number, secret: string): Buffer {
  return createHmac('sha256', secret).update(`preview-claim:${orgId.toLowerCase()}:${code}:${expires}`).digest().subarray(0, 18);
}

export function signClaimPass(orgId: string, code: string, now = Date.now()): string | null {
  const secret = payLinkSecret();
  if (!secret || !UUID.test(orgId) || !isClaimCodeShape(code)) return null;
  const expires = Math.floor(now / 1000) + CLAIM_PASS_HOURS * 3600;
  return `${expires.toString(36)}.${passSignature(orgId, code, expires, secret).toString('base64url')}`;
}

/** True when the pass was made for this club from its CURRENT code and has not lapsed. */
export function claimPassMatches(pass: string | null | undefined, orgId: string, currentCode: string | null, now = Date.now()): boolean {
  const secret = payLinkSecret();
  if (!secret || !pass || !currentCode) return false;
  const m = /^([0-9a-z]{1,10})\.([A-Za-z0-9_-]{24})$/.exec(pass);
  if (!m) return false;
  const expires = parseInt(m[1], 36);
  if (!Number.isFinite(expires) || expires * 1000 < now) return false;
  const given = Buffer.from(m[2], 'base64url');
  const want = passSignature(orgId, currentCode, expires, secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

/** A visitor, as the wrong-try count keys it: a one-way hash of the address, never the address. */
export function claimVisitorKey(req: Request): string {
  return claimVisitorKeyFromIp(claimVisitorIp(req.headers));
}

/** The visitor's address the way `lib/rate-limit.ts` `clientIpFrom` reads it (the first forwarded hop), from headers. */
export function claimVisitorIp(headers: { get(name: string): string | null }): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

/** The same key from an address a page read from its own headers (a page has no Request). */
export function claimVisitorKeyFromIp(ip: string): string {
  // No fixed fallback salt (/legal P3 item 8): an unsalted hash of an IPv4 address can be reversed.
  const salt = payLinkSecret();
  if (!salt) throw new Error('[preview-claim] no visitor salt (PAY_LINK_SECRET)');
  return createHash('sha256').update(`preview-claim-visitor:${salt}:${ip}`).digest('base64url').slice(0, 32);
}
