/**
 * A TOURNAMENT TEAM'S PAY LINK (Club Tier Stage 12a). Signed, never stored: the team's id and an HMAC of it under a
 * server secret, so the server rebuilds the same link for every email (acceptance, reminder, "Email the pay link", the
 * receipt) and a database read alone cannot forge one. Scoped to ONE team; it never expires on its own (build prompt
 * Part 3). It opens only that team's pay page — what is owed, Pay, and the receipts — never the team's record.
 *
 *   token = {team id, base64url, 22} . {HMAC-SHA256 over "team-pay:{team id}", first 16 bytes, base64url, 22}
 *   link  = {origin}/{org slug}/{tournament slug}/pay/{token}
 *
 * ⚠ Under the tournament's own address, never a top-level `/pay`: every top-level segment is a club's address
 * (`/[orgSlug]`), so `/pay` would take a club called "pay" off the air. It also gives the page the tournament's theme.
 *
 * Pure (Node's crypto, no database, no `server-only`) so the link test reads it straight. The `lib/coach-calendar-link.ts`
 * pattern; its own secret, `PAY_LINK_SECRET` (at least 32 characters, one per environment). ⚠ ROTATING IT STOPS EVERY
 * PAY LINK ALREADY EMAILED. No fallback secret: a link signed with a made-up one would stop the day the real one arrived.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})$/;

export function payLinkSecret(): string | null {
  const s = process.env.PAY_LINK_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

function signature(teamId: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`team-pay:${teamId.toLowerCase()}`).digest().subarray(0, 16);
}

export function signTeamPayToken(teamId: string, secret: string): string {
  if (!UUID.test(teamId)) throw new Error('A pay link needs a team id.');
  const id = Buffer.from(teamId.replace(/-/g, ''), 'hex').toString('base64url');
  return `${id}.${signature(teamId, secret).toString('base64url')}`;
}

/** The team a token names, or null for anything forged, mangled or signed under another secret. */
export function readTeamPayToken(token: string, secret: string): string | null {
  const m = TOKEN.exec(token);
  if (!m) return null;
  const hex = Buffer.from(m[1], 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  const teamId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (!UUID.test(teamId)) return null;
  const given = Buffer.from(m[2], 'base64url');
  const want = signature(teamId, secret);
  return given.length === want.length && timingSafeEqual(given, want) ? teamId : null;
}

/** The page's path for a team, without the origin. */
export function teamPayPath(orgSlug: string, tournamentSlug: string, token: string): string {
  return `/${encodeURIComponent(orgSlug)}/${encodeURIComponent(tournamentSlug)}/pay/${token}`;
}

/** The whole link, or null when the environment has no secret (the caller then sends no Pay button — never a dead one). */
export function teamPayUrl(origin: string, at: { orgSlug: string; tournamentSlug: string; teamId: string }): string | null {
  const secret = payLinkSecret();
  if (!secret) return null;
  return `${origin.replace(/\/$/, '')}${teamPayPath(at.orgSlug, at.tournamentSlug, signTeamPayToken(at.teamId, secret))}`;
}
