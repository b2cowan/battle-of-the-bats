/**
 * A SPONSORSHIP DEAL'S LINK (Board Ready Stage 6, Part 2; round 1 tab 3 "One link per deal, like the team pay link"). Signed,
 * never stored: the deal's id and an HMAC of it under the pay-link secret, with its OWN message prefix so a team's or a
 * family's token can never open a deal (and the other way round). Scoped to ONE deal: it opens only that deal's page — the
 * package, the business's own details and answers, how to pay — never another deal or business (/legal §2).
 *
 *   token   = {deal id, base64url, 22} . {HMAC-SHA256 over the message, first 16 bytes, base64url, 22} [ . {version} ]
 *   message = "sponsor-deal:{deal id}" at version 0, "sponsor-deal:{deal id}:v{n}" at version n ≥ 1
 *   link    = {origin}/{org slug}/sponsorship/{token}
 *
 * "Send the link again" bumps the deal's `link_version` (mig 526), which stops the old link: whether a version is still the
 * deal's is a database question, asked by the one door (`dealFromLinkToken` in lib/sponsor-deal-view.ts) — never read a token
 * anywhere else. Under the club's own address, never a top-level segment (every top-level segment is a club's address).
 *
 * Pure (Node's crypto, no database, no `server-only`) so the guard test reads it straight. Its secret is `PAY_LINK_SECRET`
 * (`payLinkSecret`, the team pay link's): no fallback secret — without one, no link is made (the window says so) rather than
 * a forgeable one.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { isUuid } from './utils';
export { payLinkSecret } from './team-pay-link';

const TOKEN = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})(?:\.([1-9][0-9]{0,5}))?$/;

/** The deal link's own message prefix (the guard test pins it; never the team's "team-pay:" or a family's). */
export const SPONSOR_DEAL_PREFIX = 'sponsor-deal:';

function signature(dealId: string, version: number, secret: string): Buffer {
  const message = `${SPONSOR_DEAL_PREFIX}${dealId.toLowerCase()}${version > 0 ? `:v${version}` : ''}`;
  return createHmac('sha256', secret).update(message).digest().subarray(0, 16);
}

export function signSponsorDealToken(dealId: string, secret: string, version = 0): string {
  if (!isUuid(dealId)) throw new Error('A sponsorship link needs a deal id.');
  if (!Number.isInteger(version) || version < 0 || version > 999999) throw new Error('A sponsorship link needs a whole version.');
  const id = Buffer.from(dealId.replace(/-/g, ''), 'hex').toString('base64url');
  return `${id}.${signature(dealId, version, secret).toString('base64url')}${version > 0 ? `.${version}` : ''}`;
}

/** The deal and version a token names, or null for anything forged, mangled, a team's or family's token, or signed under
 *  another secret. Says nothing about whether the version is still current: that is the one door's question. */
export function readSponsorDealToken(token: string, secret: string): { dealId: string; version: number } | null {
  const m = TOKEN.exec(token);
  if (!m) return null;
  const hex = Buffer.from(m[1], 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  const dealId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (!isUuid(dealId)) return null;
  const version = m[3] ? Number(m[3]) : 0;
  const given = Buffer.from(m[2], 'base64url');
  const want = signature(dealId, version, secret);
  return given.length === want.length && timingSafeEqual(given, want) ? { dealId, version } : null;
}

export function sponsorDealPath(orgSlug: string, token: string): string {
  return `/${encodeURIComponent(orgSlug)}/sponsorship/${token}`;
}

/** The whole link at the deal's CURRENT `link_version` (required, so no caller can mint a link "Send the link again" has
 *  already stopped), or null when the environment has no secret. */
export function sponsorDealUrl(origin: string, at: { orgSlug: string; dealId: string; version: number }, secret: string | null): string | null {
  if (!secret) return null;
  return `${origin.replace(/\/$/, '')}${sponsorDealPath(at.orgSlug, signSponsorDealToken(at.dealId, secret, at.version))}`;
}
