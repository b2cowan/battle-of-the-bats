/**
 * lib/coach-calendar-link.ts — A COACH'S CALENDAR LINK: SIGNED, NEVER STORED (Club Tier Stage 6d, Ask 8, ruled 2026-10-11).
 *
 * A link that is a credential is SHOWN AGAIN until Reset (the design log's 2026-10-11 Stage 6d entry, ruling 3). The
 * family feed's links are kept only as a fingerprint, so a link could be shown once — which is why its door made a new
 * one on every press and silently stopped the old (S6D-02). A coach's link is instead the membership's id, the
 * membership's link generation (`rep_team_staff_memberships.calendar_link_generation`, mig 323) and an HMAC of the two
 * under a server secret: the server rebuilds the same link every time the window opens, and a database read alone
 * can't. Reset bumps the generation, and so does removal (a trigger, in the same write that revokes), so an old link
 * answers an EMPTY calendar — never a revived one.
 *
 *   token = {membership id, base64url, 22} . {generation, base 36} . {HMAC-SHA256, first 16 bytes, base64url, 22}
 *   link  = {origin}/api/calendar/coach/{token}.ics        (webcal:// for the Apple door, https:// for Outlook)
 *
 * ⚠ The address is under /api, not the hub's drawn `/cal/t/…`: every top-level segment is a club's address
 * (`/[orgSlug]`), so a `/cal` route would take a club called "cal" off the air. Recorded as a departure (plan §6 6d).
 *
 * Pure (Node's crypto, no database, no `server-only`) so the link test reads it straight; the secret is passed in.
 * `calendarLinkSecret()` is the one reader of the environment, and it refuses to invent one.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { resolveCoachCapabilities, type AssistantCapabilityGrants } from './coach-capabilities';

/** Where a coach's feed is served. One home for the path — the route lives at `app/api/calendar/coach/[token]`. */
const COACH_FEED_PATH = '/api/calendar/coach';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^([A-Za-z0-9_-]{22})\.([0-9a-z]{1,7})\.([A-Za-z0-9_-]{22})$/;

/**
 * The signing secret. ⚠ ROTATING IT STOPS EVERY COACH'S LINK (each would answer "not found", and the calendars that
 * hold one freeze on their last copy) — set it once per environment (`.env.local`; Amplify before the 6d promote,
 * MANUAL_PROD_STEPS.json) and leave it. No fallback: a link signed with a made-up secret would stop the day the real
 * one arrived, so a missing secret is a refusal the caller reports.
 */
export function calendarLinkSecret(): string | null {
  const s = process.env.CALENDAR_LINK_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

function uuidToB64(id: string): string {
  return Buffer.from(id.replace(/-/g, ''), 'hex').toString('base64url');
}

function b64ToUuid(s: string): string | null {
  const hex = Buffer.from(s, 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return UUID.test(id) ? id : null;
}

function signature(membershipId: string, generation: number, secret: string): Buffer {
  return createHmac('sha256', secret).update(`coach-calendar:${membershipId.toLowerCase()}:${generation}`).digest().subarray(0, 16);
}

/** The token for a membership at a generation. */
export function signCoachCalendarToken(membershipId: string, generation: number, secret: string): string {
  if (!UUID.test(membershipId) || !Number.isInteger(generation) || generation < 0) {
    throw new Error('A calendar link needs a membership id and a whole, non-negative generation.');
  }
  return `${uuidToB64(membershipId)}.${generation.toString(36)}.${signature(membershipId, generation, secret).toString('base64url')}`;
}

/**
 * Read a token from the URL. Null for a bad shape or a bad signature — "not found", a link we never issued. A good
 * signature returns what it names; whether that link still answers (its generation, the membership's state) is the
 * feed's question, and its answer when stopped is an empty calendar, never "not found".
 */
export function verifyCoachCalendarToken(
  raw: string,
  secret: string,
): { membershipId: string; generation: number } | null {
  const m = TOKEN.exec(raw.replace(/\.ics$/i, ''));
  if (!m) return null;
  const membershipId = b64ToUuid(m[1]);
  const generation = parseInt(m[2], 36);
  if (!membershipId || !Number.isSafeInteger(generation)) return null;
  const given = Buffer.from(m[3], 'base64url');
  const expected = signature(membershipId, generation, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  // One spelling per link: base64url's spare bits and a generation's leading zeros would otherwise let one link answer
  // under several addresses (/review 2026-10-11 — not a forgery, but no per-address purge could ever catch them all).
  if (`${uuidToB64(membershipId)}.${generation.toString(36)}.${expected.toString('base64url')}` !== m[0]) return null;
  return { membershipId, generation };
}

/** The coach's feed address on an origin. */
export function coachFeedUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}${COACH_FEED_PATH}/${token}.ics`;
}

/**
 * "Read by your calendar today" is recorded AT MOST ONCE A DAY (the owner's cost ruling, Ask 8 revised): a good read
 * writes only when the stored day is before today on the club's clock. Two reads on one day → one write.
 */
export function shouldRecordCalendarRead(lastReadOn: string | null | undefined, today: string): boolean {
  return !lastReadOn || lastReadOn < today;
}

/**
 * Why a link with a GOOD signature has stopped, or null when it still answers — the membership's half of the feed's
 * question (the team, the club, the entitlement and the season are the feed's other half). Every reason here answers
 * an EMPTY calendar under the team's name (Ask 9), never "not found":
 *   gone         the membership no longer exists (its team was deleted);
 *   removed      the coach was taken off the team (revoked) — and stays stopped if they are re-added, because removal
 *                bumped the generation (mig 323's trigger), so the old token names a generation that no longer exists;
 *   reset        the coach (or a removal) moved the link to a new generation;
 *   no_schedule  their schedule access was taken away (an assistant's `schedule` grant off).
 */
export type CoachLinkStop = 'gone' | 'removed' | 'reset' | 'no_schedule';

export function coachLinkStopReason(
  link: {
    status: 'active' | 'revoked';
    generation: number;
    coachRole: 'head_coach' | 'assistant_coach';
    capabilities: AssistantCapabilityGrants | null;
  } | null,
  tokenGeneration: number,
): CoachLinkStop | null {
  if (!link) return 'gone';
  if (link.status !== 'active') return 'removed';
  if (link.generation !== tokenGeneration) return 'reset';
  if (!resolveCoachCapabilities(link.coachRole, link.capabilities).schedule) return 'no_schedule';
  return null;
}
