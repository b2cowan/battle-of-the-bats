/**
 * lib/notification-bell-scope.ts — WHICH BELL a list, a count or a live listener reads
 * (Free coach header parity, owner 2026-10-13, B3).
 *
 *   · `org:<id>`   — one club's bell: the admin strip, the paid coach strip, the phone pages. Every
 *                    row of that club for this person, EXCEPT a free coach's own notices.
 *   · `team-coach` — a free coach's bell (the free portal's strip): ONLY their own notices
 *                    (TEAM_COACH_EVENTS), from every host club.
 *
 * The two never overlap, by construction: both sides read the one list in lib/notification-labels.ts.
 * The server's queries (`bellReadFilter`) and the browser's live count (`rowBelongsToBell`) answer from
 * the same rule, so a badge can never count a row its drawer does not list.
 *
 * A string rather than an object so a hook can depend on it directly — an object literal would be a new
 * value on every render. Client-safe: no server imports.
 */
import { NOTIFICATION_CATEGORY, TEAM_COACH_EVENTS, isTeamCoachEvent } from './notification-labels';

export const TEAM_COACH_BELL = 'team-coach' as const;

export type BellSource = `org:${string}` | typeof TEAM_COACH_BELL;

/** One club's bell, or null without a club (the hooks then read nothing). */
export function orgBell(orgId: string | null | undefined): BellSource | null {
  return orgId ? `org:${orgId}` : null;
}

/** The club a bell reads, or null for the free coach's bell (it reads every club). */
function bellOrgId(bell: BellSource): string | null {
  return bell === TEAM_COACH_BELL ? null : bell.slice('org:'.length);
}

/** The bell as `/api/notifications` query parameters — `orgId=…` or `scope=team-coach`. */
export function bellQuery(bell: BellSource): string {
  const orgId = bellOrgId(bell);
  return orgId ? `orgId=${encodeURIComponent(orgId)}` : `scope=${TEAM_COACH_BELL}`;
}

/** The bell as a POST body's fields (Mark all read). */
export function bellBody(bell: BellSource): { orgId: string } | { scope: typeof TEAM_COACH_BELL } {
  const orgId = bellOrgId(bell);
  return orgId ? { orgId } : { scope: TEAM_COACH_BELL };
}

// Chat ("talk") never sits in a bell (Notification Center Rework P3); derived from the category map so a
// future 'talk' kind is excluded too.
const TALK_EVENTS: readonly string[] = Object.entries(NOTIFICATION_CATEGORY)
  .filter(([, cat]) => cat === 'talk')
  .map(([evt]) => evt);

/**
 * What the server reads for a bell, as plain data the route turns into a query:
 *   · `orgId`   — the club to filter on (null: every club — the free coach's bell);
 *   · `only`    — the kinds to read (null: every kind not excluded);
 *   · `exclude` — the kinds never to read.
 * Pure so the rule is unit-tested without a database (tests/unit/team-coach-notices.test.ts).
 */
export function bellReadFilter(bell: BellSource): { orgId: string | null; only: string[] | null; exclude: string[] } {
  const orgId = bellOrgId(bell);
  if (!orgId) return { orgId: null, only: [...TEAM_COACH_EVENTS], exclude: [] };
  return { orgId, only: null, exclude: [...TALK_EVENTS, ...TEAM_COACH_EVENTS] };
}

/** The scope a request names — `?scope=team-coach` / `{ scope }` — or an org bell from its `orgId`. */
export function bellFromRequest(scope: unknown, orgId: unknown): BellSource | null {
  if (scope === TEAM_COACH_BELL) return TEAM_COACH_BELL;
  return typeof orgId === 'string' && orgId ? orgBell(orgId) : null;
}

/**
 * Does a freshly inserted row (a live payload) belong to this bell? The browser's half of
 * `bellReadFilter`: the same rule, so the live +1 never counts a row the list leaves out.
 */
export function rowBelongsToBell(
  bell: BellSource,
  row: { org_id?: string | null; event_type?: string | null } | null | undefined,
): boolean {
  if (!row) return false;
  const orgId = bellOrgId(bell);
  if (!orgId) return isTeamCoachEvent(row.event_type);
  return row.org_id === orgId && !isTeamCoachEvent(row.event_type) && !TALK_EVENTS.includes(row.event_type ?? '');
}
