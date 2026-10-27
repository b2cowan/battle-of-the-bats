/**
 * league-club-schedule.ts — THE LEAGUE ADMIN IN THE CLUB'S SCHEDULE (Club Tier Stage 11b Part 3, drawings tab 5; ruled
 * 2026-10-27 card 11). Client-safe, pure. A league admin reads one club schedule's week — opened only from House league's
 * time, never the rail — and changes what house league does with ONE date of a house-league slot.
 *
 * ⚖ AN ALLOW-LIST PROJECTION, never the club's `scheduleView` passed through (lib/league-club-schedule-server.ts builds it
 * from the raw rows): each slot's day, clock, place and holder — house league (with its use), a rep team, or open — and
 * nothing else. No bill, pricing, asks, replies, sends or money. REP TEAM NAMES ARE STRIPPED here, server-side, unless the
 * viewer can open Rep teams ("A rep team"). tests/unit/league-club-schedule.test.ts pins the keys.
 */
import { formatTime } from './utils.ts';
import { formatWeekRange } from './timezone.ts';
import { keyOfUse, type LeagueTimeDivision, type LeagueTimePractice, type LeagueUse } from './league-time.ts';

/** Who holds a slot, as a league admin may know it. `teams` null = names withheld (no Rep teams for this viewer). */
export type LeagueClubHolder =
  | { kind: 'house_league'; use: LeagueUse | null; otherSeason: boolean }
  | { kind: 'rep'; teams: string[] | null }
  | { kind: 'open' };

export interface LeagueClubSlot {
  id: string;
  venueId: string;
  facilityId: string | null;
  /** The club day (YYYY-MM-DD), the slot's start as an instant (cell order), and its clocks in the club's zone. */
  day: string;
  startsAt: string;
  startClock: string;
  endClock: string;
  holder: LeagueClubHolder;
  /** This season can change this one date: house league's, this season's or not given, final, still to come, in the
   *  season's dates. Whether the VIEWER may is the page's (`run` on the season, and a computer). */
  canUse: boolean;
  /** "Every Tuesday at 6:00 p.m., Jun 1 – Aug 31" — the same weekday, clock, place and holder across the schedule. */
  repeats: string | null;
}

export interface LeagueClubSchedule {
  schedule: { id: string; name: string; startsOn: string; endsOn: string };
  /** The places the schedule's slots stand on, as the grid's rows read them. */
  places: { venueId: string; venueName: string; facilities: { id: string; name: string }[] }[];
  /** Every place the schedule's live slots stand on, so the grid's rows hold still from week to week (/review). */
  placesUsed: { venueId: string; facilityId: string | null }[];
  /** The week's slots only (Monday to Sunday of `week`). */
  week: string;
  slots: LeagueClubSlot[];
  divisions: LeagueTimeDivision[];
  /** Practices still to come on the week's house-league slots (the one-date Use asks first when it would remove them). */
  practices: LeagueTimePractice[];
}

/** The raw slot the server reads, before the projection. */
export interface RawClubSlot {
  id: string; venueId: string; facilityId: string | null; startsAt: string; day: string; weekday: number;
  startClock: string; endClock: string; teamIds: string[]; houseLeague: boolean; removed: boolean;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The settled Repeats sentence (SCHEDULE_SCREEN_WORDS.slotRepeats). */
const repeatsWords = (weekday: number, clock: string, first: string, last: string) =>
  `Every ${DAY_NAMES[weekday]} at ${formatTime(clock)}, ${formatWeekRange(first, last, false)}`;

/**
 * THE PROJECTION. `teamName` is null when the viewer can't open Rep teams: no rep team's name is ever read into the
 * answer then. `week` narrows the slots answered; Repeats reads every live slot of the schedule.
 */
export function projectClubSlots(p: {
  slots: readonly RawClubSlot[];
  week: { from: string; to: string };
  seasonId: string;
  uses: ReadonlyMap<string, { seasonId: string; use: LeagueUse }>;
  teamName: ReadonlyMap<string, string> | null;
  final: boolean;
  now: string;
  inSeason: (day: string) => boolean;
}): LeagueClubSlot[] {
  const live = p.slots.filter(s => !s.removed);
  const holderKey = (s: RawClubSlot) => (s.houseLeague ? 'house_league' : s.teamIds.length ? [...s.teamIds].sort().join(',') : 'open');
  const runs = new Map<string, string[]>();
  for (const s of live) {
    const k = `${s.weekday}|${s.startClock}|${s.venueId}|${s.facilityId ?? ''}|${holderKey(s)}`;
    runs.set(k, [...(runs.get(k) ?? []), s.day]);
  }
  return live
    .filter(s => s.day >= p.week.from && s.day <= p.week.to)
    .map((s): LeagueClubSlot => {
      const u = p.uses.get(s.id);
      const otherSeason = !!u && u.seasonId !== p.seasonId;
      const holder: LeagueClubHolder = s.houseLeague
        ? { kind: 'house_league', use: u && !otherSeason ? u.use : null, otherSeason }
        : s.teamIds.length
          ? { kind: 'rep', teams: p.teamName ? s.teamIds.map(id => p.teamName!.get(id) ?? '').filter(Boolean) : null }
          : { kind: 'open' };
      const days = [...(runs.get(`${s.weekday}|${s.startClock}|${s.venueId}|${s.facilityId ?? ''}|${holderKey(s)}`) ?? [])].sort();
      return {
        id: s.id, venueId: s.venueId, facilityId: s.facilityId, day: s.day, startsAt: s.startsAt,
        startClock: s.startClock, endClock: s.endClock, holder,
        canUse: s.houseLeague && !otherSeason && p.final && s.startsAt > p.now && p.inSeason(s.day),
        repeats: days.length > 1 ? repeatsWords(s.weekday, s.startClock, days[0], days[days.length - 1]) : null,
      };
    });
}

/** The radio's value for a use. */
export const useValue = (u: LeagueUse | null) => keyOfUse(u);
