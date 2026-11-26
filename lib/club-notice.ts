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
import { formatTime } from './utils';
import { stripSentence, type StripClosure } from './place-closures';

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

// ── The closure strip (Club Website Stage 2, Session 2C; K3, K4, K16; drawing tab 4) ─────────────────────────────────

/** One line of the strip, and when it takes itself down (midnight after its Until). */
export interface ClosureStripLine {
  sentence: string;
  endsAt: string;
}

/** The strip's box: a line per closed place in the order closed, then one small line in the notice's own words. */
export interface ClosureStrip {
  lines: ClosureStripLine[];
  smallLine: string;
}

/** Past four lines the box keeps three and says how many more (the drawing: "a club rarely closes more than two or three"). */
export const CLOSURE_STRIP_MAX_LINES = 4;

/**
 * The strip families read above the club's own notice (K4: its own box; a closure never ends or replaces the notice):
 *   "Lions Park is closed today." / "Diamond 2 at Alder Fields is closed today."
 *   "Posted 7:10 a.m. and 7:25 a.m. by the club · both end tonight"
 * Fixed words over place words, days and two instants only (K16). The small line says "ends tonight" only when every
 * line ends at tonight's midnight; otherwise the sentences already say the days ("closed tomorrow (Sat, Nov 28).",
 * "closed through Sun, Nov 29."). Three or more posting times read "Posted by the club". Null when nothing is closed.
 */
export function closureStrip(closures: readonly StripClosure[], nowIso: string, timeZone: string = ORG_TIME_ZONE): ClosureStrip | null {
  const showing = closures.filter(c => Date.parse(c.endsAt) > Date.parse(nowIso));
  if (!showing.length) return null;
  const today = clubDay(nowIso, timeZone);

  // The same sentence twice (one place pressed twice for the same days) is one line, ending at the later of the two.
  const lines: ClosureStripLine[] = [];
  for (const c of showing) {
    const sentence = stripSentence(c, today, formatShortWeekdayDate);
    const same = lines.find(l => l.sentence === sentence);
    if (same) { if (Date.parse(c.endsAt) > Date.parse(same.endsAt)) same.endsAt = c.endsAt; }
    else lines.push({ sentence, endsAt: c.endsAt });
  }
  if (lines.length > CLOSURE_STRIP_MAX_LINES) {
    const rest = lines.splice(CLOSURE_STRIP_MAX_LINES - 1);
    const lastEnd = rest.reduce((a, l) => (Date.parse(l.endsAt) > Date.parse(a) ? l.endsAt : a), rest[0].endsAt);
    lines.push({ sentence: `And ${rest.length} more places are closed.`, endsAt: lastEnd });
  }

  const times = [...new Set(showing.map(c => postedWhen(c.showsFrom, today, timeZone)))];
  const posted = times.length <= 2 ? `Posted ${times.join(' and ')} by the club` : 'Posted by the club';
  const tonight = noticeEndsAt({ kind: 'tonight' }, nowIso, timeZone);
  const allTonight = !!tonight && showing.every(c => Date.parse(c.endsAt) === Date.parse(tonight));
  const ends = !allTonight ? '' : lines.length === 1 ? ' · ends tonight' : lines.length === 2 ? ' · both end tonight' : ' · all end tonight';
  return { lines, smallLine: `${posted}${ends}` };
}
