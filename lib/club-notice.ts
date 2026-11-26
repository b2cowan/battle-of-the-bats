/**
 * lib/club-notice.ts — THE CLUB NOTICE'S CLOCK (Club Tier Stage 4c-1, Ask 16; words CLUB_TIER_STAGE4C1_COPY.md §F).
 *
 * One short line a club owner or admin posts ("All diamonds are closed tonight"), shown at the top of every public page
 * and team page until it ends. Pure, so the edges are tested (tests/unit/club-stage4c1.test.ts):
 *   · when a chosen "Ends" lands, in the club's zone (tonight = the coming midnight; never "forever");
 *   · whether a notice is showing — not ended, its end still ahead (one at a time is a READ rule, mig 343; the read
 *     itself, newest showing row first, is `getLiveClubNotice`);
 *   · the small line families read: "Posted 2:40 p.m. by the club · ends tonight".
 * The product never writes a notice and never posts one by itself.
 */
import { ORG_TIME_ZONE, addCalendarDays, formatShortWeekdayDate, utcToZonedInputs, zonedWallClockToUtc } from './timezone';
import { formatTime, joinWithAnd } from './utils';
import { stripWhen, uncoveredClosures, type StripClosure } from './place-closures';

export const NOTICE_MAX = 80;
export const NOTICE_DETAIL_MAX = 200;

export type NoticeEnds =
  | { kind: 'tonight' }
  | { kind: 'tomorrow' }
  | { kind: 'at'; date: string; time: string };

export interface NoticeTimes {
  postedAt: string;
  endsAt: string;
  endedAt: string | null;
}

/** The club's calendar day of an instant, YYYY-MM-DD. */
function clubDay(iso: string, timeZone: string): string {
  return utcToZonedInputs(iso, timeZone).date;
}

/**
 * The instant a notice ends. "Tonight at midnight" is the 00:00 that closes the club's today; "Tomorrow at midnight"
 * the one after it; a picked date and time is read in the club's zone. Null when the pick is malformed or not after
 * `nowIso` (the route refuses it: "Pick a time that hasn't passed yet.").
 */
export function noticeEndsAt(ends: NoticeEnds, nowIso: string, timeZone: string = ORG_TIME_ZONE): string | null {
  const today = clubDay(nowIso, timeZone);
  if (!today) return null;
  let at: string | null;
  if (ends.kind === 'tonight') at = zonedWallClockToUtc(addCalendarDays(today, 1), '00:00', timeZone);
  else if (ends.kind === 'tomorrow') at = zonedWallClockToUtc(addCalendarDays(today, 2), '00:00', timeZone);
  else at = zonedWallClockToUtc(ends.date, ends.time, timeZone);
  if (!at || Date.parse(at) <= Date.parse(nowIso)) return null;
  return at;
}

/** Showing now: not ended by hand and its end still ahead. Its clock ends it without a write (dictionary gotcha 2). */
export function noticeIsShowing(n: NoticeTimes, nowIso: string): boolean {
  return !n.endedAt && Date.parse(n.endsAt) > Date.parse(nowIso);
}

function clock(iso: string, timeZone: string): string {
  return formatTime(utcToZonedInputs(iso, timeZone).time);
}

/** "2:40 p.m." today, "Tue, Oct 20 at 2:40 p.m." before it: the "Posted …" words of the notice and the closure strip. */
function postedWhen(postedAt: string, today: string, timeZone: string): string {
  const day = clubDay(postedAt, timeZone);
  return day === today ? clock(postedAt, timeZone) : `${formatShortWeekdayDate(day)} at ${clock(postedAt, timeZone)}`;
}

/**
 * What families read under the notice, said from `nowIso`:
 *   "Posted 2:40 p.m. by the club · ends tonight"
 *   "Posted Tue, Oct 20 at 2:40 p.m. by the club · ends Fri, Oct 23 at 6:00 p.m."
 * An end at exactly midnight is said as the night before it closes ("tonight", "tomorrow night", "Fri, Oct 23 at
 * midnight"), never as "12:00 a.m." of the next day.
 */
export function noticeSmallLine(n: Pick<NoticeTimes, 'postedAt' | 'endsAt'>, nowIso: string, timeZone: string = ORG_TIME_ZONE): string {
  const today = clubDay(nowIso, timeZone);
  const posted = `Posted ${postedWhen(n.postedAt, today, timeZone)} by the club`;

  const end = utcToZonedInputs(n.endsAt, timeZone);
  let ends: string;
  if (end.time === '00:00') {
    const night = addCalendarDays(end.date, -1);
    if (night === today) ends = 'ends tonight';
    else if (night === addCalendarDays(today, 1)) ends = 'ends tomorrow night';
    else ends = `ends ${formatShortWeekdayDate(night)} at midnight`;
  } else if (end.date === today) {
    ends = `ends ${formatTime(end.time)}`;
  } else if (end.date === addCalendarDays(today, 1)) {
    ends = `ends tomorrow at ${formatTime(end.time)}`;
  } else {
    ends = `ends ${formatShortWeekdayDate(end.date)} at ${formatTime(end.time)}`;
  }
  return `${posted} · ${ends}`;
}

// ── The closure strip (Club Website Stage 2, Session 2C; K3, K4, K16; summarized by S1–S3, owner 2026-11-26) ────────

/** A park's row under a day's heading: "**Lions Park**: Diamond 1 and Diamond 2" · "**Alder Fields**: all diamonds" ·
 *  "**Riverside Gym**" (a place that isn't all diamonds: its name alone). Only the park is bold. */
export interface ClosureStripRow {
  park: string;
  what: string | null;
}

/** One day's closed places (S2), and when they take themselves down (midnight after their Until). One place is one
 *  sentence; two or more are a heading and a row per park. */
export type ClosureStripGroup =
  | { endsAt: string; sentence: string }
  | { endsAt: string; heading: string; rows: ClosureStripRow[] };

/** The strip's box: the day groups, earliest first, then one small line in the notice's own words. Words only (K16). */
export interface ClosureStrip {
  groups: ClosureStripGroup[];
  smallLine: string;
}

/** S3: up to five rows all show; past five, four show and the rest open in place. */
export const CLOSURE_STRIP_ALL_ROWS = 5;
export const CLOSURE_STRIP_FOLDED_ROWS = 4;
/** The fold's button, shut ("Show fewer" when open: `SHOW_FEWER`, the club site's one word for it). */
export const closureShowMore = (n: number) => `Show ${n} more places`;

/** The rows a group takes: a sentence is one, a heading's group one per park. */
const groupRows = (g: ClosureStripGroup) => ('sentence' in g ? 1 : g.rows.length);
export const stripRowCount = (groups: readonly ClosureStripGroup[]) => groups.reduce((n, g) => n + groupRows(g), 0);

/**
 * S3, the strip's one shortening rule, shared by the site and the Close a place window's preview: every group while the
 * rows number five or fewer, or while open; else the first four rows (a heading stays over the rows of its group that
 * show). `fold` is null when there is nothing to fold; else how many rows the button opens.
 */
export function stripShown(groups: readonly ClosureStripGroup[], open: boolean): { groups: ClosureStripGroup[]; fold: number | null } {
  const total = stripRowCount(groups);
  if (total <= CLOSURE_STRIP_ALL_ROWS) return { groups: [...groups], fold: null };
  const fold = total - CLOSURE_STRIP_FOLDED_ROWS;
  if (open) return { groups: [...groups], fold };
  const out: ClosureStripGroup[] = [];
  let left = CLOSURE_STRIP_FOLDED_ROWS;
  for (const g of groups) {
    if (left <= 0) break;
    if ('sentence' in g) { out.push(g); left -= 1; continue; }
    out.push({ ...g, rows: g.rows.slice(0, left) });
    left -= Math.min(left, g.rows.length);
  }
  return { groups: out, fold };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Names in their natural order ("Diamond 2" before "Diamond 10", "Park 2" before "Park 10"). */
const byName = (a: string, b: string) => a.localeCompare(b, 'en-CA', { numeric: true });

/** One park within a day: every place, the whole park, or some of its diamonds. */
interface ParkDay { all: boolean; whole: boolean; name: string; allDiamonds: boolean; diamonds: string[] }

/** The one sentence of a day with one place: today's words, and several diamonds of one park said once. */
function parkSentence(p: ParkDay, when: string): string {
  if (p.all) return `All our fields are ${when}.`;
  if (p.whole || !p.diamonds.length) return `${p.name} is ${when}.`;
  return `${joinWithAnd(p.diamonds)} at ${p.name} ${p.diamonds.length === 1 ? 'is' : 'are'} ${when}.`;
}

function parkRow(p: ParkDay): ClosureStripRow {
  if (p.all) return { park: 'All our fields', what: null };
  if (p.whole || !p.diamonds.length) return { park: p.name, what: p.allDiamonds ? 'all diamonds' : null };
  return { park: p.name, what: joinWithAnd(p.diamonds) };
}

/**
 * The strip families read above the club's own notice (K4: its own box; a closure never ends or replaces the notice).
 * S1: a closure a wider one covers is left off (`uncoveredClosures`). S2: what is left is grouped by its WHEN
 * (`stripWhen`), earliest first; a day with one place is today's sentence ("Diamond 1 and Diamond 2 at Lions Park are
 * closed today."), a day with more is a heading ("Closed today") and a row per park, every place first, then by name.
 *   "Posted 7:10 a.m. and 7:25 a.m. by the club · both end tonight"
 * Fixed words over place words, days and two instants only (K16): the place ids stay here. The small line reads the
 * closures families SEE, and says "ends tonight" / "both" / "all" by the rows only when every one ends at tonight's
 * midnight; otherwise the words already say the days. Three or more posting times read "Posted by the club". Null when
 * nothing is closed.
 */
export function closureStrip(closures: readonly StripClosure[], nowIso: string, timeZone: string = ORG_TIME_ZONE): ClosureStrip | null {
  const today = clubDay(nowIso, timeZone);
  const showing = uncoveredClosures(closures.filter(c => Date.parse(c.endsAt) > Date.parse(nowIso)), today);
  if (!showing.length) return null;

  const days = new Map<string, { first: string; last: string; endsAt: string; parks: Map<string, ParkDay> }>();
  for (const c of showing) {
    const when = stripWhen(c, today, formatShortWeekdayDate);
    const day = days.get(when) ?? days.set(when, { first: c.firstDay < today ? today : c.firstDay, last: c.lastDay, endsAt: c.endsAt, parks: new Map() }).get(when)!;
    if (Date.parse(c.endsAt) > Date.parse(day.endsAt)) day.endsAt = c.endsAt;
    // A park by its id (a place renamed since is still one park); a closure whose place is gone, by its words.
    const key = c.scope === 'all' ? 'all' : c.venueId ?? `name:${c.placeName ?? ''}`;
    const park = day.parks.get(key) ?? day.parks.set(key, {
      all: c.scope === 'all', whole: false, name: c.placeName ?? '', allDiamonds: false, diamonds: [],
    }).get(key)!;
    if (c.scope === 'place') { park.whole = true; park.allDiamonds = c.allDiamonds; park.diamonds = []; }
    else if (c.scope === 'diamond' && !park.whole && c.facilityName && !park.diamonds.includes(c.facilityName)) park.diamonds.push(c.facilityName);
  }

  const groups: ClosureStripGroup[] = [...days.entries()]
    .sort(([, a], [, b]) => a.first.localeCompare(b.first) || a.last.localeCompare(b.last))
    .map(([when, d]) => {
      const parks = [...d.parks.values()].sort((a, b) => Number(b.all) - Number(a.all) || byName(a.name, b.name));
      for (const p of parks) p.diamonds.sort(byName);
      return parks.length === 1
        ? { endsAt: d.endsAt, sentence: parkSentence(parks[0], when) }
        : { endsAt: d.endsAt, heading: cap(when), rows: parks.map(parkRow) };
    });

  const rows = stripRowCount(groups);
  const times = [...new Set(showing.map(c => postedWhen(c.showsFrom, today, timeZone)))];
  const posted = times.length <= 2 ? `Posted ${times.join(' and ')} by the club` : 'Posted by the club';
  const tonight = noticeEndsAt({ kind: 'tonight' }, nowIso, timeZone);
  const allTonight = !!tonight && showing.every(c => Date.parse(c.endsAt) === Date.parse(tonight));
  const ends = !allTonight ? '' : rows === 1 ? ' · ends tonight' : rows === 2 ? ' · both end tonight' : ' · all end tonight';
  return { groups, smallLine: `${posted}${ends}` };
}
