/**
 * A HOUSE-LEAGUE FAMILY'S PAY LINK (Club Tier Stage 12b, owner §0e c). Signed, never stored, never expiring — the team
 * pay link's scheme (`lib/team-pay-link.ts`) with its own message, so a team token can never be read as a family's.
 *
 *   token = {registration id, base64url, 22} . {HMAC-SHA256 over "league-pay:{registration id}", first 16 bytes, 22}
 *   link  = {origin}/{org slug}/league/{season slug}/status/{token}
 *
 * The token names ONE registration (the anchor) and opens that registration's SIGN-UP: every child signed up with it
 * (the same `signup_ref`), or the one registration when it has none (an older sign-up). It opens the family's status
 * page already unlocked — what the email and the reference open — so "Ask to withdraw a child" comes with it.
 *
 * Pure (Node's crypto, no database) so the link test reads it straight. The secret is `PAY_LINK_SECRET`, shared with the
 * team link (⚠ rotating it stops every pay link already emailed). No secret → no link → no Pay button, never a dead one.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { payLinkSecret } from './team-pay-link';

export { payLinkSecret };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})$/;

function signature(registrationId: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`league-pay:${registrationId.toLowerCase()}`).digest().subarray(0, 16);
}

export function signLeaguePayToken(registrationId: string, secret: string): string {
  if (!UUID.test(registrationId)) throw new Error('A pay link needs a registration id.');
  const id = Buffer.from(registrationId.replace(/-/g, ''), 'hex').toString('base64url');
  return `${id}.${signature(registrationId, secret).toString('base64url')}`;
}

/** The registration a token names, or null for anything forged, mangled, a team's token, or signed under another secret. */
export function readLeaguePayToken(token: string, secret: string): string | null {
  const m = TOKEN.exec(token);
  if (!m) return null;
  const hex = Buffer.from(m[1], 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (!UUID.test(id)) return null;
  const given = Buffer.from(m[2], 'base64url');
  const want = signature(id, secret);
  return given.length === want.length && timingSafeEqual(given, want) ? id : null;
}

/** The registration a pay link names, under this environment's secret, or null. */
export function registrationFromPayToken(token: string): string | null {
  const secret = payLinkSecret();
  return secret ? readLeaguePayToken(token, secret) : null;
}

/** The status page's path for a sign-up, without the origin. */
export function leaguePayPath(orgSlug: string, seasonSlug: string, token: string): string {
  return `/${encodeURIComponent(orgSlug)}/league/${encodeURIComponent(seasonSlug)}/status/${token}`;
}

/** The token for a registration, or null when the environment has no secret. */
export function leaguePayToken(registrationId: string): string | null {
  const secret = payLinkSecret();
  return secret ? signLeaguePayToken(registrationId, secret) : null;
}

/** The whole link, or null when the environment has no secret (the caller then sends no Pay button). */
export function leaguePayUrl(origin: string, at: { orgSlug: string; seasonSlug: string; registrationId: string }): string | null {
  const token = leaguePayToken(at.registrationId);
  return token ? `${origin.replace(/\/$/, '')}${leaguePayPath(at.orgSlug, at.seasonSlug, token)}` : null;
}
