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


/**
 * What families read under the notice, said from `nowIso`:
 *   "Posted 2:40 p.m. by the club · ends tonight"
 *   "Posted Tue, Oct 20 at 2:40 p.m. by the club · ends Fri, Oct 23 at 6:00 p.m."
 * An end at exactly midnight is said as the night before it closes ("tonight", "tomorrow night", "Fri, Oct 23 at
 * midnight"), never as "12:00 a.m." of the next day.
 */
export function noticeSmallLine(n: Pick<NoticeTimes, 'postedAt' | 'endsAt'>, nowIso: string, timeZone: string = ORG_TIME_ZONE): string {
  const today = clubDay(nowIso, timeZone);
  const postedDay = clubDay(n.postedAt, timeZone);
  const posted = postedDay === today
    ? `Posted ${clock(n.postedAt, timeZone)} by the club`
    : `Posted ${formatShortWeekdayDate(postedDay)} at ${clock(n.postedAt, timeZone)} by the club`;

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
