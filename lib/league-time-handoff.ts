/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOUSE LEAGUE'S TIME, HANDED BETWEEN PEOPLE (Club Tier Stage 13d, Session A — build prompt
 * docs/projects/active/CLUB_TIER_STAGE13D_BUILD_PROMPT.md; drawing tabs 2, 3 and 7; owner rulings Ask 14 A, C6 A, 13d-1/-2/-6/-7 A).
 *
 * Two hand-offs, said out loud:
 *   · TIME GIVEN → the league admin's bell. Finalize and send, or Send the changes when house league's time grows or shrinks,
 *     tells everyone who runs house league (owners, admins, league admins; never the sender), one bell per season the time
 *     falls in. Bell only: the email copy is off by default, like every notice (13d-1 A). The Send window's WHO IS TOLD names
 *     who hears it ("House league · Jules Moreau, league admin: 2 hours a week to divide · bell").
 *   · NO TIME → "Ask for time". A league admin's one quiet button where the no-time sentence sits (the season line, House
 *     league's time, Generate games), on a live or getting-ready season. It never gives: only an owner or an admin gives time.
 *     The ask waits on the owner's and the admins' This morning (Accounting or not: giving time isn't money) until the
 *     season has time or finishes, and the owner gets one bell when it is made (13d-2 A). No names on the league admin's
 *     screen (C6 A). Once per season; asking again is allowed after 7 days.
 *
 * Pure and client-safe: the words, the 7-day rule and the card's door. The server half is lib/league-time-handoff-server.ts.
 * Every `[marketing]` string waits for the one /marketing pass before the walk.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { formatStoredDate } from './timezone';
import { joinWithAnd, pluralize, possessive } from './utils';
import { hoursAWeek } from './league-time';
import { dayRange } from './club-hand-back-words';

/** Asking again is allowed this many days after an ask (drawing tab 3, note 2). */
export const ASK_AGAIN_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since an ask, by the clock (an ask made 7 × 24 hours ago may be made again). */
export const daysSinceAsked = (askedAt: string, now: number = Date.now()) => Math.floor((now - Date.parse(askedAt)) / DAY_MS);

/** May the season ask (again)? Never asked, or asked at least 7 days ago. */
export const canAskAgain = (askedAt: string | null, now: number = Date.now()) => !askedAt || daysSinceAsked(askedAt, now) >= ASK_AGAIN_DAYS;

/** Some given or taken-back time, as the bell and the Send window say it. `minutes` is House league's time window's own
 *  figure (a week's minutes, the parts summed: "Hours add up across facilities"), so the two never disagree. */
export interface TimePiece { minutes: number; detail: string; firstDay: string; lastDay: string }

const range = (p: TimePiece) => dayRange([p.firstDay, p.lastDay]);

export const TIME_HANDOFF_WORDS = {
  /** The league admin's bell (drawing tab 2, notes 1-2). The row opens the reader; the reader's door names House league's time. */
  bell: {
    givenTitle: 'The club gave house league time',
    /** [marketing] Send the changes took more than it gave. */
    takenTitle: 'The club took back house league time',
    /** `grows`: the season's week gained hours (a send that gives and takes the same hours tells nobody). */
    body: (p: { schedule: string; season: string; grows: boolean; given: TimePiece | null; taken: TimePiece | null }) => {
      const gives = p.given ? `${hoursAWeek(p.given.minutes)}: ${p.given.detail}, ${range(p.given)}` : '';
      const takes = p.taken ? `${hoursAWeek(p.taken.minutes)}: ${p.taken.detail}, ${range(p.taken)}` : '';
      if (p.grows) {
        // [marketing] the second sentence only when the same send also took some back.
        return `“${p.schedule}” gives ${p.season} ${gives}. ${p.taken ? `It takes back ${takes}. ` : ''}Divide it into games and practices.`;
      }
      return `“${p.schedule}” takes back ${takes} from ${p.season}.${p.given ? ` It gives ${gives}.` : ''}`;
    },
  },
  /** The Send window's WHO IS TOLD line (drawing tab 2, note 3). Names the league admins (the sender's own window, not the
   *  league admin's: C6's "no names" is about the league admin's screen). */
  whoTold: {
    title: 'House league',
    who: (leagueAdmins: readonly string[]) => (leagueAdmins.length
      ? `${joinWithAnd([...leagueAdmins])}, ${leagueAdmins.length === 1 ? 'league admin' : 'league admins'}`
      : 'owners and admins'),
    /** "2 hours a week to divide" · [marketing] "1 hour a week taken back". */
    what: (givenMinutes: number, takenMinutes: number) => [
      givenMinutes > 0 ? `${hoursAWeek(givenMinutes)} to divide` : '',
      takenMinutes > 0 ? `${hoursAWeek(takenMinutes)} taken back` : '',
    ].filter(Boolean).join(', '),
    how: 'bell',
    /** With no league admin: "House league: owners and admins, by a bell" (the build prompt's words). */
    byBell: 'by a bell',
  },
  /** The ask, on the league admin's screens (drawing tab 3, notes 1-2). */
  ask: {
    button: 'Ask for time',
    /** [marketing] the same button, 7 days after an ask that is still waiting. */
    again: 'Ask again',
    asking: 'Asking…',
    failed: 'The ask didn’t go. Try again.',
    asked: (askedAt: string) => `Asked ${formatStoredDate(askedAt, { withYear: false })}.`,
    seen: 'The owner and admins see it on their Overview.',
    /** [marketing] The ask found time already given (since the page loaded): never "Try again". */
    given: 'The club has given this season time. Reload to see it.',
  },
  /** The owner's and the admins' This morning card (drawing tab 3, note 3). */
  card: {
    label: 'House league asks for time',
    sub: (seasons: readonly { name: string; askedAt: string }[], noPermit: boolean, now: number = Date.now()) => {
      const oldest = seasons.reduce((a, s) => (Date.parse(s.askedAt) < Date.parse(a) ? s.askedAt : a), seasons[0].askedAt);
      const days = daysSinceAsked(oldest, now);
      const when = days >= ASK_AGAIN_DAYS ? `asked ${pluralize(days, 'day')} ago` : `asked ${formatStoredDate(oldest, { withYear: false })}`;
      const who = seasons.length === 1 ? seasons[0].name : `${pluralize(seasons.length, 'season')} · oldest`;
      if (noPermit) return `${who} · ${when} · add a permit to give time`;
      return seasons.length === 1 ? `${who} · ${when} by its league admin` : `${who} ${when}`;
    },
  },
  /** The owner's one bell when an ask is made (13d-2 A). [marketing] */
  askBell: {
    title: 'House league asks for time',
    body: (season: string) => `${possessive(season)} league admin asked for house league time. It waits on your Overview until the season has some.`,
  },
} as const;

/** WHO IS TOLD's house league line, as the preview hands it to the Send window (no money in it). */
export interface LeagueTimeLine { leagueAdmins: string[]; givenMinutes: number; takenMinutes: number }

/** Where an ask opens, for someone who gives time (drawing tab 3, note 3): New schedule on the club's one permit when the
 *  club has one permit and no schedule; Permits when it has no permit; Schedules otherwise. */
export type TimeAskDoor = { kind: 'schedules' } | { kind: 'new'; permitId: string } | { kind: 'permits' };

export function timeAskDoor(p: { permitIds: readonly string[]; schedules: number }): TimeAskDoor {
  if (!p.permitIds.length) return { kind: 'permits' };
  if (p.permitIds.length === 1 && p.schedules === 0) return { kind: 'new', permitId: p.permitIds[0] };
  return { kind: 'schedules' };
}

/** The door's address under `/{org}/admin` (`?new=1&permit=` opens New schedule on that permit, as a permit's own door does). */
export function timeAskHref(base: string, door: TimeAskDoor): string {
  if (door.kind === 'permits') return `${base}/permits`;
  if (door.kind === 'new') return `${base}/schedules?new=1&permit=${encodeURIComponent(door.permitId)}`;
  return `${base}/schedules`;
}

/** What the This morning card reads (the brief's `timeAsks`). Present only for an owner or an admin on a plan with the
 *  club's schedule, and only while a live season asks and has no time. */
export interface TimeAsksCard { seasons: { name: string; askedAt: string }[]; door: TimeAskDoor }
