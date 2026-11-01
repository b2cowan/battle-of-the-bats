/**
 * A HOUSE-LEAGUE FAMILY'S "YOUR SIGN-UP" LINK (Club Tier Stage 12b, owner §0e c; replaceable since Signed-in family
 * accounts Stage 1, mig 419). Signed, never stored — the team pay link's scheme (`lib/team-pay-link.ts`) with its own
 * message, so a team token can never be read as a family's.
 *
 *   token = {registration id, base64url, 22} . {HMAC-SHA256 over the message, first 16 bytes, 22} [ . {version} ]
 *   message = "league-pay:{registration id}" at version 0 (every link emailed before Stage 1, unchanged),
 *             "league-pay:{registration id}:v{n}" at version n ≥ 1 (after the club's "Send a new link")
 *   link  = {origin}/{org slug}/league/{season slug}/status/{token}
 *
 * The token names ONE registration (the anchor) and opens that registration's SIGN-UP: every child signed up with it
 * (the same `signup_ref`), or the one registration when it has none (an older sign-up). The version is part of the
 * signature, so a token cannot be edited to a newer one; whether the version is still the row's is a database question,
 * asked by the one door (`lib/league-signup-link.ts` `openSignupLink`) — never read a token anywhere else.
 *
 * Pure (Node's crypto, no database) so the link test reads it straight. The secret is `PAY_LINK_SECRET`, shared with the
 * team link (⚠ rotating it stops every pay link already emailed; a reset never rotates it, it bumps the version).
 * No secret → no link → no button, never a dead one.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { payLinkSecret } from './team-pay-link';

export { payLinkSecret };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})(?:\.([1-9][0-9]{0,5}))?$/;

function signature(registrationId: string, version: number, secret: string): Buffer {
  const message = `league-pay:${registrationId.toLowerCase()}${version > 0 ? `:v${version}` : ''}`;
  return createHmac('sha256', secret).update(message).digest().subarray(0, 16);
}

export function signLeaguePayToken(registrationId: string, secret: string, version = 0): string {
  if (!UUID.test(registrationId)) throw new Error('A pay link needs a registration id.');
  if (!Number.isInteger(version) || version < 0 || version > 999999) throw new Error('A pay link needs a whole version.');
  const id = Buffer.from(registrationId.replace(/-/g, ''), 'hex').toString('base64url');
  return `${id}.${signature(registrationId, version, secret).toString('base64url')}${version > 0 ? `.${version}` : ''}`;
}

/** The registration and version a token names, or null for anything forged, mangled, a team's token, or signed under
 *  another secret. Says nothing about whether the version is still current: that is `openSignupLink`'s question. */
export function readLeaguePayToken(token: string, secret: string): { registrationId: string; version: number } | null {
  const m = TOKEN.exec(token);
  if (!m) return null;
  const hex = Buffer.from(m[1], 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (!UUID.test(id)) return null;
  const version = m[3] ? Number(m[3]) : 0;
  const given = Buffer.from(m[2], 'base64url');
  const want = signature(id, version, secret);
  return given.length === want.length && timingSafeEqual(given, want) ? { registrationId: id, version } : null;
}

/** The family's page path for a sign-up, without the origin. */
export function leaguePayPath(orgSlug: string, seasonSlug: string, token: string): string {
  return `/${encodeURIComponent(orgSlug)}/league/${encodeURIComponent(seasonSlug)}/status/${token}`;
}

/** The token for a registration at its current `link_version`, or null when the environment has no secret. */
export function leaguePayToken(registrationId: string, version: number): string | null {
  const secret = payLinkSecret();
  return secret ? signLeaguePayToken(registrationId, secret, version) : null;
}

/** The whole link at the registration's current `link_version`, or null when the environment has no secret (the caller
 *  then sends no button). */
export function leaguePayUrl(origin: string, at: { orgSlug: string; seasonSlug: string; registrationId: string; version: number }): string | null {
  const token = leaguePayToken(at.registrationId, at.version);
  return token ? `${origin.replace(/\/$/, '')}${leaguePayPath(at.orgSlug, at.seasonSlug, token)}` : null;
}
