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
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
function tzOffsetMinutes(utcDate: Date, timeZone: string): number {
  // One formatter per zone, built once: constructing an Intl.DateTimeFormat is the expensive part, and
  // a list converts every game's wall clock (twice, for the DST re-check) on every read.
  let dtf = offsetFormatters.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    offsetFormatters.set(timeZone, dtf);
  }
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
 * "Times in Eastern time." — the ONE sentence a calendar says about its clock (Club Tier Stage 6c, Ask 10 — standard
 * §11 C10), READ FROM the zone rather than written into a page: the club calendar wrote "Eastern" into its words, which
 * would go on saying it the day a club outside Ontario onboards (S6-13). The zone's generic name in words ("Eastern",
 * "Pacific", "Newfoundland"), lower-cased "time" in the sentence (house style).
 */
export function timesInZoneSentence(timeZone: string = ORG_TIME_ZONE): string {
  return `Times in ${zoneTimeWords(timeZone)}.`;
}

const zoneWordsCache = new Map<string, string>();

/**
 * "Eastern time" — the zone's generic name in words, the half of `timesInZoneSentence` a calendar entry's notes say
 * ("Arrive by 5:30 p.m. (Eastern time)", Club Tier 6d F6). One reading of the zone for both, so a page and a feed can
 * never name the club's clock two ways.
 */
export function zoneTimeWords(timeZone: string = ORG_TIME_ZONE): string {
  // Built once per zone: a calendar feed asks for it on every entry with an arrival, and a formatter is the costly part.
  const known = zoneWordsCache.get(timeZone);
  if (known) return known;
  // A browser without the generic names (pre-2022 engines) throws on 'longGeneric': its 'long' name says the same
  // words with "Standard"/"Daylight" in them, which the strip below drops — the page never fails over a sentence.
  const nameIn = (style: 'longGeneric' | 'long') => new Intl.DateTimeFormat('en-CA', { timeZone, timeZoneName: style })
    .formatToParts(new Date(Date.UTC(2026, 0, 15))).find(p => p.type === 'timeZoneName')?.value;
  let name: string | undefined;
  try { name = nameIn('longGeneric'); } catch { name = nameIn('long'); }
  const words = `${(name ?? timeZone).replace(/ (Standard |Daylight )?Time$/, '')} time`;
  zoneWordsCache.set(timeZone, words);
  return words;
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
 * "Today" · "Tomorrow" · "In 6 days" — the ONE phrasing for a count of calendar days ahead, fed
 * by {@link calendarDaysBetween}. The Overview's next-event card and the Practice plans hub's
 * next-practice card both say it; two hand-rolled ternaries had already drifted on capitalisation
 * (/simplify, 2026-09-14). Callers that render it in an uppercase kicker lose nothing.
 */
export function relativeDayLabel(days: number): string {
  return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
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
  // setUTCFullYear, not Date.UTC: Date.UTC reads years 0–99 as 1900–1999, and a date field passes through "0002-…"
  // while a year is typed into it — the End date followed it to 1902.
  const shifted = new Date(0);
  shifted.setUTCFullYear(y, m - 1, d + days);
  return shifted.toISOString().slice(0, 10);
}

/** A new event's End date and whether the person picked it (`endPicked`), carried in the form beside it. */
export type FollowingEnd = { end: string; endPicked: boolean };

/**
 * A new event's End date as its Start date changes. An End date this filled in (`endPicked` false) FOLLOWS the start,
 * `span` days after it; one the person picked stays while it is on or after the new start, and past it is filled in
 * again (following from then on). While a start is being typed the End date is left exactly as it is: a date field
 * passes through '' when one part of it is cleared, and through 5- and 6-digit years.
 * ⚠ Whether the End was picked is REMEMBERED by the form (`endPicked`, set by the End field), never inferred from the
 * dates. The first rule kept any End on or after the start, so a filled-in End stayed put (walk §290, step 4); the
 * second inferred "filled in" from start + span, and lost that the moment a cleared start went through ''.
 */
export function endDateFollowingStart(prev: FollowingEnd, start: string, span: number): FollowingEnd {
  // Only a well-formed day is ever shifted: the last day a Date can hold (275760-09-13) shifted on is an Invalid Date
  // whose toISOString throws, inside a state updater.
  const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDay(start)) return prev;
  if (prev.endPicked && prev.end >= start) return prev;
  const end = addCalendarDays(start, span);
  return isDay(end) ? { end, endPicked: false } : prev;
}

/**
 * `date` moved by `months` calendar months, KEEPING its day and clamping it to the last day of a shorter month:
 * Oct 31 + 1 is Nov 30, Jan 31 + 1 is Feb 28 (29 in a leap year), Mar 31 − 1 is Feb 28.
 *
 * ⚠ C6-01 (Club Tier Stage 6c, 2026-10-10): the coach's month arrow did `setMonth(getMonth() + 1)` on a device-midnight
 * Date, which OVERFLOWS — Oct 31 + 1 month is "Nov 31", i.e. Dec 1 — so from the 29th to the 31st it skipped a month in
 * every zone, and read back through `toISOString()` it landed a day short east of UTC. Pure arithmetic on the date's
 * own parts: no clock, no zone.
 */
export function addCalendarMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const target = (m - 1) + months;
  const ym = `${y + Math.floor(target / 12)}-${String((((target % 12) + 12) % 12) + 1).padStart(2, '0')}`;
  const last = lastDayOfMonth(ym);
  return `${ym}-${String(Math.min(d, Number(last.slice(8)))).padStart(2, '0')}`;
}

/** The last day of a month (`YYYY-MM` or any date in it), as `YYYY-MM-DD`. From the month's own parts. */
export function lastDayOfMonth(value: string): string {
  const [y, m] = value.split('-').map(Number);
  if (!y || !m) return value;
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * A wall-clock `YYYY-MM-DDTHH:mm` moved by `hours` — plain arithmetic on the wall clock, never through a device's zone
 * (empty in, empty out). The schedule forms' "end = start + 2 hours".
 */
export function addHoursToWallClock(local: string, hours: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + hours, +m[5])).toISOString().slice(0, 16);
}

/**
 * The Monday (`YYYY-MM-DD`) of the week a calendar date falls in — weeks run Monday to Sunday, as every schedule
 * in the product draws them. Pure date arithmetic on the date's own parts: no zone, safe on the client and server.
 */
export function mondayOfDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addCalendarDays(date, -((dow + 6) % 7));
}

/**
 * ⚠ THE WEEK A STORED INSTANT FALLS IN, IN THE ORG'S ZONE (Club Tier Stage 6b, Ask 8 — S6-12). Three schedules used
 * to group by the DEVICE's clock (`new Date(iso).getDay()`) or, on a server page, the SERVER's (UTC on the host),
 * so a Sunday game after 8 p.m. Eastern filed into the next week. Every week grouping reads this instead: the
 * instant's org-zone day first ({@link orgDayKey}), then its Monday.
 */
export function orgWeekKey(iso: string | null | undefined): string {
  const day = orgDayKey(iso);
  return day ? mondayOfDay(day) : '';
}

/** The month (`YYYY-MM`) a stored instant falls in, in the org's zone — the month groupings' one key (Ask 8). */
export function orgMonthKey(iso: string | null | undefined): string {
  return orgDayKey(iso).slice(0, 7);
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

/** `"2026-05"` → `"May"` — the one formatter for a `YYYY-MM` bucket key (Insights P3's monthly
 *  attendance chart). Manual parse, same reason as `parseDateOnlyParts` below: a month key has no
 *  day component to hand `new Date()` safely. */
export function formatMonthKey(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!m) return value ?? '';
  return SHORT_MONTHS[Number(m[2]) - 1] ?? value ?? '';
}

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
 * True for a `YYYY-MM-DD` that is also a REAL calendar day — so `2015-02-30` and `2015-13-01` are
 * rejected, not just misshapen strings. Date-only columns are `date` in Postgres, and a value that
 * merely LOOKS right reaches the driver as an error the caller cannot attribute to a field.
 *
 * ⚠ The `T00:00:00Z` is required and is not the trap this module warns about elsewhere: bare
 * `new Date('2026-07-16')` is the ambiguous form. Stamping Z makes the round trip exact, which is
 * the whole technique — a date the calendar does not have comes back as a different string.
 *
 * Lives HERE beside `parseDateOnlyParts`, which its own note says was extracted to end precisely
 * this duplication; it had been hand-rolled in the Basic-coach roster and again on the coaches'
 * tryout intake.
 */
export function isCalendarDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
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
 * "27 Oct" — an INSTANT's day and month, read in the org's zone, day first. The date column that
 * leads a row list's rows (standard §3.10.4): the two hubs and the lineup picker. Lives here so
 * the two callers cannot spell the same two-call expression apart.
 */
export function formatOrgDayMonth(iso: string): string {
  return `${formatInOrgZone(iso, { day: 'numeric' })} ${formatInOrgZone(iso, { month: 'short' })}`;
}

const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * "Friday, July 31" — a stored date WITH ITS WEEKDAY.
 *
 * The weekday is the thing a person navigates a weekend by, and no other formatter here carries
 * it. Printed schedules are the first caller: a tournament schedule on a fence is read by someone
 * who knows it is Saturday and does not know it is the 1st.
 *
 * Deliberately one shape, with no short/with-year options: nothing needs them today, and this file
 * has one formatter per shape rather than one formatter with switches. Add a variant when a caller
 * asks for it.
 *
 * ⚠ The weekday is derived through `Date.UTC` and read back with `getUTCDay` — constructed and
 * read in the SAME zone, so it cannot drift. `new Date('2026-07-31').getDay()` is the trap this
 * whole file exists to close: UTC midnight rendered in a behind-UTC zone is the previous day, and
 * therefore the previous WEEKDAY.
 */
export function formatWeekdayDate(value: string | null | undefined): string {
  const p = parseDateOnlyParts(value);
  if (!p) return value ?? '';
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return `${LONG_DAYS[dow]}, ${LONG_MONTHS[p.m - 1]} ${p.d}`;
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * "Fri, Jun 12" — `formatWeekdayDate`'s short shape, for a row that names a game's day in a list
 * (the tournament admin's game-day board and Results, Stage 1: an overdue game on a phone read as
 * today's when it carried only "1:00 p.m."). The same UTC construction, for the same reason.
 */
export function formatShortWeekdayDate(value: string | null | undefined): string {
  const p = parseDateOnlyParts(value);
  if (!p) return value ?? '';
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return `${SHORT_DAYS[dow]}, ${SHORT_MONTHS[p.m - 1]} ${p.d}`;
}

/**
 * "October 2026" — a month (`YYYY-MM` or any date in it) as a calendar's date row and a season list's month band
 * name it (Club Tier Stage 6c, standard §11 C8). Built from the string's parts, never a device-midnight Date.
 */
export function formatMonthYear(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(value ?? '');
  if (!m) return value ?? '';
  return `${LONG_MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

/**
 * A WEEK's range, in the calendars' one spelling (Club Tier Stage 6c, standard §11 C8): "Oct 5 – 11, 2026",
 * "Oct 26 – Nov 1, 2026", "Dec 28, 2026 – Jan 3, 2027"; on a phone, without the year ("Oct 5 – 11", "Dec 28 – Jan 3").
 * Spaced en dash — a week is a stretch a reader steps through, where an EVENT's range ({@link formatEventDateRange},
 * "Oct 10–12, 2026") is one thing. From the dates' own parts: no clock, no zone.
 */
export function formatWeekRange(from: string, to: string, withYear = true): string {
  const s = parseDateOnlyParts(from);
  const e = parseDateOnlyParts(to);
  if (!s || !e) return '';
  const sm = SHORT_MONTHS[s.m - 1], em = SHORT_MONTHS[e.m - 1];
  if (s.y !== e.y) return withYear ? `${sm} ${s.d}, ${s.y} – ${em} ${e.d}, ${e.y}` : `${sm} ${s.d} – ${em} ${e.d}`;
  const year = withYear ? `, ${e.y}` : '';
  return s.m === e.m ? `${sm} ${s.d} – ${e.d}${year}` : `${sm} ${s.d} – ${em} ${e.d}${year}`;
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
  /** "October 2–4, 2026" — the long month, for paper (Summary's printed page, Stage 4). */
  opts: { longMonth?: boolean } = {},
): string | null {
  const s = parseDateOnlyParts(start);
  if (!s) return null;
  const e = parseDateOnlyParts(end);
  const MONTHS = opts.longMonth ? LONG_MONTHS : SHORT_MONTHS;
  const year = withYear ? `, ${(e ?? s).y}` : '';
  const sTxt = `${MONTHS[s.m - 1]} ${s.d}`;
  if (!e || (e.y === s.y && e.m === s.m && e.d === s.d)) return `${sTxt}${year}`;
  if (e.y !== s.y) return `${sTxt}, ${s.y} – ${MONTHS[e.m - 1]} ${e.d}, ${e.y}`;
  if (e.m === s.m) return `${MONTHS[s.m - 1]} ${s.d}–${e.d}${year}`;
  return `${sTxt} – ${MONTHS[e.m - 1]} ${e.d}${year}`;
}
