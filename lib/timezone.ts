/**
 * Timezone helpers — wall-clock ⇄ UTC for league scheduling (J3-047).
 *
 * The platform serves Canadian sports organizations and standardizes on
 * `America/Toronto` for all orgs (V1) — the same convention already used by the
 * ICS export (`lib/export/ics.ts`) and tournament setup
 * (`app/api/admin/setup-tournament/route.ts`). When a non-Ontario org onboards,
 * promote ORG_TIME_ZONE to a per-org column and thread it through these helpers;
 * every caller already passes through here, so that becomes a one-line change.
 *
 * The bug these fix (J3-047): game/practice times were stored by doing
 * `new Date(`${date}T${time}`).toISOString()` on the SERVER — parsed in the Node
 * runtime's zone (Toronto on a dev box, UTC on Amplify), so a 6:00 PM game stored
 * as 18:00Z and rendered 2:00 PM to families. Practices were worse: naive strings
 * went straight into `timestamptz`, interpreted in the DB session zone (UTC).
 *
 * The fix converts a wall-clock date+time, INTERPRETED IN `America/Toronto`, to the
 * correct UTC instant — DST-aware (EDT −4 in summer, EST −5 in winter) — without a
 * third-party tz library.
 */

/** The org timezone for V1. All Canadian orgs schedule in Toronto local time. */
export const ORG_TIME_ZONE = 'America/Toronto';

/**
 * Signed offset (in minutes) of `timeZone` relative to UTC at a given UTC instant:
 * (zone wall-clock) − (UTC wall-clock). NEGATIVE when the zone is behind UTC
 * (e.g. Toronto = −240 in summer / −300 in winter). To convert a wall-clock in the
 * zone to UTC, SUBTRACT this offset (UTC = wall − offset).
 *
 * Works by formatting the instant in the target zone and comparing the rendered
 * wall-clock to the same instant's UTC wall-clock.
 */
function tzOffsetMinutes(utcDate: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(utcDate);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0; // Intl can emit hour 24 for midnight in some engines
  // The instant rendered as wall-clock in `timeZone`, treated as if it were UTC.
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return (asUTC - utcDate.getTime()) / 60000;
}

/**
 * Convert a wall-clock date + time (interpreted in `timeZone`, default
 * `America/Toronto`) into a UTC ISO-8601 string (`…Z`), DST-correct.
 *
 * @param date  `YYYY-MM-DD`
 * @param time  `HH:MM` or `HH:MM:SS`
 * @returns     UTC ISO string, e.g. `2026-07-01T22:00:00.000Z` for `2026-07-01` `18:00`
 *              (Toronto EDT −4); or null if either input is missing/malformed.
 */
export function zonedWallClockToUtc(
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone: string = ORG_TIME_ZONE,
): string | null {
  if (!date || !time) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, y, mo, d] = dateMatch;
  const [, h, mi, s] = timeMatch;
  // First guess: treat the wall-clock as if it were UTC.
  const naiveUtcMs = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  // The real UTC instant is the naive guess MINUS the zone's signed offset
  // (UTC = wall − offset, since offset is zone − UTC). Compute the offset at the naive
  // instant, then re-check at the corrected instant to stay correct across a DST
  // boundary (the offset can differ by an hour there).
  const offset1 = tzOffsetMinutes(new Date(naiveUtcMs), timeZone);
  const corrected1 = naiveUtcMs - offset1 * 60000;
  const offset2 = tzOffsetMinutes(new Date(corrected1), timeZone);
  const finalMs = offset1 === offset2 ? corrected1 : naiveUtcMs - offset2 * 60000;
  return new Date(finalMs).toISOString();
}

/**
 * Inverse of {@link zonedWallClockToUtc}: render a UTC instant as the date + time
 * `<input>` values an admin would see in `timeZone` (default `America/Toronto`).
 * Use to prefill reschedule forms so the round-trip (display → edit → save) is
 * stable and zone-consistent regardless of the viewer's browser zone (J3-047).
 *
 * @returns `{ date: 'YYYY-MM-DD', time: 'HH:MM' }`, or empty strings if `iso` is null/invalid.
 */
export function utcToZonedInputs(
  iso: string | null | undefined,
  timeZone: string = ORG_TIME_ZONE,
): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` };
}

/**
 * "Today" as a `YYYY-MM-DD` string in the tournament timezone (default
 * `America/Toronto`), NOT the server/browser UTC date. Fan surfaces must use this
 * instead of `new Date().toISOString().split('T')[0]`: that UTC form rolls over to
 * tomorrow at ~8 PM Eastern, which made the live ticker vanish mid-game, "Today's
 * Games" go empty, and the dock die on championship evening (J6-056).
 */
export function tournamentToday(
  now: Date = new Date(),
  timeZone: string = ORG_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
