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
 * A calendar date somebody CHOSE, as the instant to store in a `timestamptz` column.
 *
 * ⚠⚠ WRITING THE BARE DATE IS AN OFF-BY-ONE DAY, EVERY TIME. Postgres reads `2026-07-04` into a
 * `timestamptz` as UTC midnight, and every reader here turns an instant back into a day through the
 * ORG's clock (`formatStoredDate` → `orgDayKey`). Toronto is behind UTC, so that instant is still
 * July **3rd** locally: the coach picks the 4th, saves, and the row says the 3rd. Nothing errors and
 * the month is usually still right, which is exactly how it would survive review.
 *
 * ⚠ NOON, and the choice is the whole point. A date a coach picked carries no time — we know the
 * day and nothing else — so the stamp has to sit as far from both midnights as it can. Noon is 12
 * hours from either, which no timezone this platform serves can cross. Any hour near an edge
 * reintroduces the same bug for some org, quietly.
 *
 * Use this wherever a chosen DAY is stored as an INSTANT. Where a real time is known, use
 * `zonedWallClockToUtc` with it; where the column is a `date`, store the bare string.
 */
export function orgDayAsStoredInstant(
  date: string,
  timeZone: string = ORG_TIME_ZONE,
): string | null {
  return zonedWallClockToUtc(date, '12:00', timeZone);
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

/** A naive wall-clock timestamp — `YYYY-MM-DDTHH:mm`, optionally with seconds and fractional
 *  seconds, and with NO zone suffix. Fractional seconds are tolerated so a value that has been
 *  through a `Date`-shaped round trip is still recognised as naive rather than falling through
 *  the passthrough and being resolved as UTC. */
const NAIVE_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?$/;

/**
 * Resolve a schedule write's timestamp to a true UTC instant.
 *
 * A write may carry EITHER a naive wall-clock string in the ORG's own clock
 * (`2026-09-08T18:00` — what every `datetime-local` input, the recurrence generator, the
 * schedule importer and the tournament-game mirror all produce) OR a value that already
 * names its zone (`…Z`, `…+00:00`). **Naive is converted; anything already carrying a zone
 * passes through untouched**, so a caller that has already resolved an instant — or a value
 * read back out of Postgres and written straight back — can never be double-converted.
 *
 * This exists because `rep_team_events.starts_at` is `timestamptz`: handing Postgres a naive
 * literal makes it resolve in the SESSION zone (UTC on Supabase), so a coach's 6:00 PM was
 * stored as 18:00Z and rendered back 2:00 PM to them. That is the J3-047 bug class this module
 * was written for, reaching one more surface — see the header. House League already converts on
 * every write; the coach schedule never adopted it.
 *
 * @returns the UTC ISO instant, the input unchanged when it already names a zone, or null.
 */
export function wallClockStringToUtc(
  value: string | null | undefined,
  timeZone: string = ORG_TIME_ZONE,
): string | null {
  if (!value) return null;
  const naive = NAIVE_TIMESTAMP.exec(value.trim());
  if (!naive) return value; // already zoned (…Z / ±HH:MM), or a shape we must not reinterpret
  return zonedWallClockToUtc(naive[1], naive[2], timeZone) ?? value;
}

/**
 * Format a stored instant as a wall clock in the ORG's timezone — never the reader's.
 *
 * A game starts when it starts. A coach travelling, or a grandparent watching from another
 * province, must see the game's LOCAL start time, so every schedule surface formats through
 * here rather than a bare `new Date(iso).toLocaleTimeString()` (which silently renders in
 * whatever zone the device happens to be in).
 */
export function formatInOrgZone(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-CA',
  timeZone: string = ORG_TIME_ZONE,
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(d);
}

/**
 * The calendar day a stored instant falls on **in the org's timezone**, as `YYYY-MM-DD`.
 * Slicing the raw string instead (`iso.slice(0, 10)`) reads the UTC day, which is a different
 * date for every event after 8 PM Eastern.
 */
export function orgDayKey(iso: string | null | undefined): string {
  return utcToZonedInputs(iso).date;
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

/**
 * "Now" as `{ date, time }` wall-clock strings in the tournament timezone
 * (default `America/Toronto`) — the local counterparts to the UTC
 * `new Date().toISOString()` split. `date` is `YYYY-MM-DD`, `time` is `HH:MM:SS`.
 * Use for "has this game's start time passed?" checks so they don't fire 4–5h
 * early from UTC skew (the same trap {@link tournamentToday} documents).
 */
export function tournamentNow(
  now: Date = new Date(),
  timeZone: string = ORG_TIME_ZONE,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}:${get('second')}`,
  };
}

/**
 * Whole calendar days from `from` to `to` as seen in `timeZone` (default Toronto),
 * counting DATE boundaries — NOT a raw `(to − from) / 86_400_000` rolling-24h span.
 * So an event at 9 PM tonight is 0 ("today"), one tomorrow morning is 1 ("tomorrow"),
 * and a past date is negative. Use for "days until X" labels so they read in the org's
 * local calendar, not the viewer's UTC clock (the same trap {@link tournamentToday} fixes).
 */
export function calendarDaysBetween(
  from: Date,
  to: Date,
  timeZone: string = ORG_TIME_ZONE,
): number {
  return daysBetweenDateStrings(tournamentToday(from, timeZone), tournamentToday(to, timeZone));
}

/**
 * Whole calendar days from `from` to `to`, both already `YYYY-MM-DD` strings — the pure
 * date-string primitive under {@link calendarDaysBetween} (which zones its `Date` inputs
 * down to strings first). Positive when `to` is after `from`, negative before, 0 same day;
 * returns 0 if either string is malformed. No timezone: both inputs are already calendar
 * dates, so this is plain UTC-midnight arithmetic — safe to call from client code.
 */
/**
 * `date` (a `YYYY-MM-DD` string) shifted by `days` calendar days, returned as `YYYY-MM-DD`.
 * The counterpart to {@link daysBetweenDateStrings}: anchor on {@link tournamentToday} and step
 * from there, rather than `new Date(Date.now() + n * 86_400_000).toISOString()`, which derives
 * both ends from the RUNTIME zone and so lands a day early every evening on a UTC server.
 * Pure date arithmetic on UTC midnights — no zone involved, safe on the client.
 */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

export function daysBetweenDateStrings(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  if (!ay || !by) return 0;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** For the surfaces a FAMILY reads rather than a coach — the dues reminder email spells it out. */
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Split a `YYYY-MM-DD` (or the date half of a timestamp) into calendar parts.
 *  MANUAL parse on purpose — `new Date('2026-07-16')` is UTC midnight, and rendering that
 *  through `toLocaleDateString` in a behind-UTC zone silently prints the PREVIOUS day. */
export function parseDateOnlyParts(value: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/**
 * "2026-09-30" → "30 Sep". Day first, and no year — for a narrow column heading where the season
 * already supplies the year and every character costs a phone some width.
 *
 * Lives HERE, beside the other date formatters, rather than in the one screen that wanted it: the
 * caller's own instinct was to hand-roll the month array and re-split the string, which is exactly
 * the duplication `parseDateOnlyParts` was extracted to end.
 */
export function formatDayMonth(value: string | null | undefined): string {
  const p = parseDateOnlyParts(value);
  if (!p) return value ?? '';
  return `${p.d} ${SHORT_MONTHS[p.m - 1]}`;
}

/**
 * "May 15, 2026" — the ONE formatter for a date a coach or admin reads out of a money record,
 * and it takes BOTH shapes the database stores, because the caller usually cannot tell them apart.
 *
 * ⚠ THIS EXISTS BECAUSE THREE SCREENS HAND-ROLLED IT AND ALL THREE WERE WRONG (2026-08-14), each
 * in the way its own local shortcut invited:
 *   • `new Date(s + 'T00:00:00')` — correct for a `date` column, but a **timestamptz** already
 *     carries a time, so the concatenation produced a doubled string and printed the literal
 *     words **"Invalid Date"** on every paid row of the player ledger and the By-installment grid.
 *   • `new Date(s)` — correct for a timestamp, but a bare `YYYY-MM-DD` parses as UTC midnight and
 *     renders the PREVIOUS day in every zone behind UTC (the admin allocations schedule showed
 *     every due date one day early).
 * Neither hand-roll is safe on the other's input, and money tables mix the two freely: `due_date`
 * is a date, `paid_at` is a timestamp — often in the SAME ROW.
 *
 * A timestamp resolves through the ORG zone, never a raw slice: a payment recorded after 8 PM
 * Eastern is stored on the next UTC day and would otherwise be reported as arriving tomorrow.
 */
export function formatStoredDate(
  value: string | null | undefined,
  opts: { withYear?: boolean; longMonth?: boolean } = {},
): string {
  if (!value) return '—';
  const parts = parseDateOnlyParts(value.length > 10 ? orgDayKey(value) : value);
  if (!parts) return '—';
  const month = opts.longMonth ? LONG_MONTHS[parts.m - 1] : SHORT_MONTHS[parts.m - 1];
  return `${month} ${parts.d}${opts.withYear === false ? '' : `, ${parts.y}`}`;
}

/**
 * "Aug 14–16" / "Aug 30 – Sep 1" / single-day "Aug 14" (+ ", 2026" when `withYear`).
 * A range crossing a year boundary always shows BOTH years ("Dec 30, 2026 – Jan 2, 2027")
 * so the start year is never silently dropped.
 *
 * The ONE formatter for an event's date range. Lifted out of CoachPortalShell (2026-07-27)
 * because the coach tournament record hand-rolled its own with `new Date(dateOnly)`, which
 * shifted a day behind the shell header on the SAME screen — the portal told a coach two
 * different sets of dates for one tournament. Anything showing an event range calls this.
 */
export function formatEventDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  withYear: boolean,
): string | null {
  const s = parseDateOnlyParts(start);
  if (!s) return null;
  const e = parseDateOnlyParts(end);
  const year = withYear ? `, ${(e ?? s).y}` : '';
  const sTxt = `${SHORT_MONTHS[s.m - 1]} ${s.d}`;
  if (!e || (e.y === s.y && e.m === s.m && e.d === s.d)) return `${sTxt}${year}`;
  if (e.y !== s.y) return `${sTxt}, ${s.y} – ${SHORT_MONTHS[e.m - 1]} ${e.d}, ${e.y}`;
  if (e.m === s.m) return `${SHORT_MONTHS[s.m - 1]} ${s.d}–${e.d}${year}`;
  return `${sTxt} – ${SHORT_MONTHS[e.m - 1]} ${e.d}${year}`;
}
