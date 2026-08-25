/**
 * lib/tryout-session-label.ts
 * How a tryout session is named on screen and on paper — ONE home.
 *
 * ⚠⚠ A SESSION IS A REAL MOMENT, READ IN THE CLUB'S ZONE (owner ruling 2026-08-24). It used to be
 * read by SLICING the raw stored text, which is why this file existed at all — and that was wrong
 * in a way that hid itself: the save path stored the typed clock without converting it, so the two
 * errors cancelled and the coach saw the right time. The coach DEMO writes its sessions correctly,
 * through the platform's normal wall-clock→UTC helper, and the slicing readers showed those four
 * hours late on a public page — a 9:00 a.m. tryout reading 1:00 p.m.
 *
 * Both halves are fixed together: the API converts on write, everything here formats through
 * `formatInOrgZone`. ⚠ Never re-introduce a slicing reader — a session now means what it says.
 *
 * Split out of `TryoutDayCard` when the printed check-in sheet started naming its session too — a
 * second copy of this arithmetic is exactly how one surface ends up saying 9:00 and another 1:00.
 */
import { formatInOrgZone, orgDayKey } from './timezone';

/** The club-local calendar day a session falls on, as `YYYY-MM-DD` — for day/month bucketing. */
export function tryoutSessionDay(stored: string): string {
  return orgDayKey(stored);
}

export function formatTryoutSessionTime(stored: string): string {
  return formatInOrgZone(stored, { hour: 'numeric', minute: '2-digit' });
}

interface SessionWhen {
  startsAt: string;
  endsAt?: string | null;
}

/** "Sat, Sep 12 · 9:00 a.m.–12:00 p.m." — the on-screen receipt. */
export function formatTryoutSessionWhen(session: SessionWhen): string {
  const date = formatInOrgZone(session.startsAt, { weekday: 'short', month: 'short', day: 'numeric' });
  if (!date) return session.startsAt;
  let s = `${date}  ·  ${formatTryoutSessionTime(session.startsAt)}`;
  if (session.endsAt) {
    const end = formatTryoutSessionTime(session.endsAt);
    if (end) s += `–${end}`;
  }
  return s;
}

interface SessionWhere extends SessionWhen {
  label?: string | null;
  location?: string | null;
  fieldNumber?: string | null;
}

/**
 * The fuller line a PRINTED sheet carries: the coach's own label for the session, when it runs,
 * and where. Includes the YEAR, because a sheet outlives the week it was printed in.
 */
export function describeTryoutSession(session: SessionWhere): string {
  const date = formatInOrgZone(session.startsAt, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const end = session.endsAt ? formatTryoutSessionTime(session.endsAt) : '';
  const when = date
    ? `${date}  ·  ${formatTryoutSessionTime(session.startsAt)}${end ? `–${end}` : ''}`
    : session.startsAt;
  const where = [session.location, session.fieldNumber].filter(Boolean).join(', ');
  return [session.label || null, when, where || null].filter(Boolean).join('  ·  ');
}
