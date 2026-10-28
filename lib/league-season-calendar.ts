/**
 * league-season-calendar.ts — A HOUSE-LEAGUE SEASON'S SCHEDULE AS THE CALENDAR'S BOOKINGS (House League Stage 9d-2a; ruling
 * 9d2·12, frames b1–b4, drawings TdXm5jmTEJ9qPvR3T5H9qU v4; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Stage 9d-2a"). Client-safe,
 * pure.
 *
 * ⚖ ONE CALENDAR, NOT A FOURTH. The season's Schedule screen draws the club calendar's views (components/admin/kit/club/
 * ClubCalendarViews.tsx) over the club calendar's booking (`CalendarBooking`, lib/club-calendar-view.ts) — the club calendar,
 * the coach's schedule and the tournament's day already share one recipe (TABLE_AND_LIST_STANDARD §11.1), and a season page
 * with its own booking shape would be the fourth spelling of a day, a week and a state. This module is the season's side of
 * that shape: its games and practices, with the season's own facts the club page never needed —
 *   - a POSTPONED game leaves its week for "Needs a new date" (9d2·10) — it is not in `bookings` at all, so no view can
 *     draw it as on, and it waits in `needsDate` by the date it had;
 *   - a CANCELLED game stays in its week, struck through with its word (C9 — nothing hidden);
 *   - a played game says its result ("Final 7–4");
 *   - "Time from {schedule}" (b4): a game says it only when it sits EXACTLY on one of its division's game-time slots — the
 *     same start, on the same facility. There is no link on a game (mig 392's header: 9d-2b adds it), so the rule is a
 *     match, and a game that matches no slot (moved by hand, typed place, the time taken back) SAYS NOTHING: a guess would
 *     name a schedule the game no longer comes from. A club practice says its own slot's schedule (its link is real).
 *   - a night of practices folds into one List row (9d2·12): one division's practices on one day, two or more of them.
 * The postponed game keeps the date it had (`scheduled_at` is never cleared by Postpone), which is the "Was …" line.
 * ⚖ NO "MOVED" IN 9d-2a (owner 2026-10-27): a game holds one date and no history, so a postponed game given a new date reads
 * as an ordinary game in its new week. "Moved" comes with 9d-2b's change record.
 */
import { mondayOfDay, orgDayKey } from './timezone.ts';
import { DEFAULT_BOOKING_MINUTES } from './booking-length.ts';
import { pluralize } from './utils.ts';
import type { CalendarBooking, CalendarWhere } from './club-calendar-view.ts';
import type { PermitOutside } from './permit-words.ts';
import type { LeagueGame, LeaguePractice } from './types.ts';

/** A slot of a division's game time, as the season page matches its games to it. */
export interface SeasonGameSlot {
  slotId: string;
  divisionId: string;
  startsAt: string;
  venueId: string;
  facilityId: string | null;
  scheduleId: string;
  scheduleName: string;
}

/** A club venue's current words, by id. */
export interface SeasonPlace { venue: string | null; facility: string | null; address: string | null }

export interface SeasonCalendarInput {
  seasonName: string;
  sport: string | null;
  games: readonly LeagueGame[];
  practices: readonly LeaguePractice[];
  teamName: ReadonlyMap<string, string>;
  divisionName: ReadonlyMap<string, string>;
  /** A club venue's words (null for a place the club doesn't hold). */
  placeOf: (venueId: string, facilityId: string | null) => SeasonPlace | null;
  /** The season's game-time slots (every division's), for "Time from". */
  gameSlots?: readonly SeasonGameSlot[];
  /** A club practice's schedule, by its slot. */
  practiceSchedule?: ReadonlyMap<string, { scheduleId: string; scheduleName: string }>;
  /** The reader opens the club's schedules (the schedule's name is a door). */
  canOpenSchedules?: boolean;
  /** The server's clash read, by booking key (`league_game:…`, `league_practice:…`). */
  clashes?: ReadonlyMap<string, Pick<CalendarBooking, 'clash' | 'clashesWith'>>;
  /** The server's permit read, by booking key. */
  permits?: ReadonlyMap<string, PermitOutside>;
}

/** A booking the season page draws, with the season's own facts. */
export interface SeasonBooking extends CalendarBooking {
  divisionId: string | null;
  /** "Final 7–4" on a played game. */
  result: string | null;
  /** The game or practice row it came from. */
  source: { kind: 'game'; game: LeagueGame } | { kind: 'practice'; practice: LeaguePractice };
}

export interface SeasonCalendar {
  /** Everything with a date that isn't postponed, by start. */
  bookings: SeasonBooking[];
  /** Postponed games (and any game with no date), by the date they had. */
  needsDate: SeasonBooking[];
}

const MIN = 60_000;

/** "Final 7–4" — a played game's result (both scores in). */
export function resultWords(g: Pick<LeagueGame, 'status' | 'homeScore' | 'awayScore'>): string | null {
  if (g.status !== 'completed' || g.homeScore == null || g.awayScore == null) return null;
  return `Final ${g.homeScore}–${g.awayScore}`;
}

/** A game on one of its division's game-time slots: the same division, start and facility. Otherwise nothing. */
export function gameSlotOf(g: Pick<LeagueGame, 'divisionId' | 'scheduledAt' | 'orgVenueId' | 'orgVenueFacilityId'>, slots: readonly SeasonGameSlot[]): SeasonGameSlot | null {
  if (!g.scheduledAt || !g.orgVenueId) return null;
  const at = Date.parse(g.scheduledAt);
  return slots.find(s => s.divisionId === g.divisionId && Date.parse(s.startsAt) === at
    && s.venueId === g.orgVenueId && (s.facilityId ?? null) === (g.orgVenueFacilityId ?? null)) ?? null;
}

export function seasonCalendar(input: SeasonCalendarInput): SeasonCalendar {
  const where = (venueId: string | null, facilityId: string | null, location: string | null): CalendarWhere => {
    const club = venueId ? input.placeOf(venueId, facilityId) : null;
    return club
      ? { venueId, venueName: club.venue, facility: club.facility, address: club.address, text: null }
      : { venueId: null, venueName: null, facility: null, address: null, text: location || null };
  };
  const span = (startIso: string, endIso: string | null) => {
    const startMs = Date.parse(startIso);
    const endParsed = endIso ? Date.parse(endIso) : NaN;
    const hasEnd = endParsed > startMs;
    return { startMs, endMs: hasEnd ? endParsed : startMs + DEFAULT_BOOKING_MINUTES * MIN, hasEnd, allDay: false };
  };
  const team = (id: string) => input.teamName.get(id) ?? 'A team';
  const common = (key: string) => ({
    program: 'league' as const, teamId: null, ownerName: input.seasonName, colour: null, sport: input.sport, headCoach: null,
    door: null, clash: input.clashes?.get(key)?.clash ?? null, clashesWith: input.clashes?.get(key)?.clashesWith ?? [],
    permit: input.permits?.get(key) ?? null,
  });

  const bookings: SeasonBooking[] = [];
  const needsDate: SeasonBooking[] = [];
  for (const g of input.games) {
    const key = `league_game:${g.id}`;
    const slot = gameSlotOf(g, input.gameSlots ?? []);
    const b: SeasonBooking = {
      ...common(key), key, kind: 'game',
      day: g.scheduledAt ? orgDayKey(g.scheduledAt) : '',
      ...(g.scheduledAt ? span(g.scheduledAt, g.endsAt) : { startMs: 0, endMs: 0, hasEnd: false, allDay: false }),
      who: `${team(g.homeTeamId)} vs ${team(g.awayTeamId)}`,
      what: input.divisionName.get(g.divisionId) ?? '',
      where: where(g.orgVenueId, g.orgVenueFacilityId, g.location),
      state: g.status === 'cancelled' ? 'cancelled' : g.status === 'postponed' ? 'postponed' : null,
      clubSchedule: slot ? { slotId: slot.slotId, scheduleId: slot.scheduleId, scheduleName: slot.scheduleName, canOpen: !!input.canOpenSchedules } : null,
      divisionId: g.divisionId,
      result: resultWords(g),
      source: { kind: 'game', game: g },
    };
    // A postponed game (or one with no date) leaves its week: it is never drawn as on (9d2·10).
    if (g.status === 'postponed' || !g.scheduledAt) {
      needsDate.push({ ...b, clash: null, clashesWith: [] });
    } else {
      bookings.push(b);
    }
  }
  for (const p of input.practices) {
    if (!p.scheduledAt) continue;
    const key = `league_practice:${p.id}`;
    const from = p.clubScheduleSlotId ? input.practiceSchedule?.get(p.clubScheduleSlotId) : undefined;
    bookings.push({
      ...common(key), key, kind: 'practice',
      day: orgDayKey(p.scheduledAt),
      ...span(p.scheduledAt, p.endsAt),
      teamId: p.teamId,
      who: team(p.teamId),
      what: 'Practice',
      where: where(p.orgVenueId, p.orgVenueFacilityId, p.location),
      state: p.status === 'cancelled' ? 'cancelled' : null,
      clubSchedule: p.clubScheduleSlotId && from
        ? { slotId: p.clubScheduleSlotId, scheduleId: from.scheduleId, scheduleName: from.scheduleName, canOpen: !!input.canOpenSchedules }
        : null,
      divisionId: p.divisionId,
      result: null,
      source: { kind: 'practice', practice: p },
    });
  }
  const byStart = (a: SeasonBooking, b: SeasonBooking) =>
    a.startMs - b.startMs || (a.kind === b.kind ? 0 : a.kind === 'game' ? -1 : 1) || a.who.localeCompare(b.who, 'en-CA', { numeric: true }) || a.key.localeCompare(b.key);
  bookings.sort(byStart);
  needsDate.sort(byStart);
  return { bookings, needsDate };
}

/** One List row: a booking, or a night of one division's practices folded (9d2·12). */
export type SeasonListRow =
  | { kind: 'one'; booking: SeasonBooking }
  | { kind: 'night'; key: string; day: string; startMs: number; endMs: number; divisionId: string | null; practices: SeasonBooking[] };

/**
 * A night of practices folds into one row: one division's practices on one day that are on (a cancelled one stays its own
 * struck row), two or more of them. The row sits where its first practice would and opens to each team's hour.
 */
export function foldNights(bookings: readonly SeasonBooking[]): SeasonListRow[] {
  const nights = new Map<string, SeasonBooking[]>();
  for (const b of bookings) {
    if (b.kind !== 'practice' || b.state) continue;
    const k = `${b.day}|${b.divisionId ?? ''}`;
    nights.set(k, [...(nights.get(k) ?? []), b]);
  }
  const rows: SeasonListRow[] = [];
  const done = new Set<string>();
  for (const b of bookings) {
    const k = `${b.day}|${b.divisionId ?? ''}`;
    const night = b.kind === 'practice' && !b.state ? nights.get(k)! : null;
    if (!night || night.length < 2) { rows.push({ kind: 'one', booking: b }); continue; }
    if (done.has(k)) continue;
    done.add(k);
    rows.push({
      kind: 'night', key: `night:${k}`, day: b.day, divisionId: b.divisionId,
      startMs: Math.min(...night.map(x => x.startMs)), endMs: Math.max(...night.map(x => x.endMs)), practices: night,
    });
  }
  return rows;
}

/** A night's places: "Maple Grove Park · Diamonds 1, 2" is the view's to say; this is the distinct facilities in order. */
export const nightPlaces = (night: { practices: readonly SeasonBooking[] }) =>
  [...new Map(night.practices.map(p => [`${p.where.venueId ?? ''}|${p.where.facility ?? p.where.text ?? ''}`, p.where])).values()];

/** A week as a list heads it: its Monday and what falls in it, by start. */
export interface SeasonWeek<B> { monday: string; bookings: B[] }

/**
 * The weeks a season list draws (g1, b1): it opens on this week, and the weeks before it fold behind "Show {n} earlier
 * weeks". A season wholly behind today folds nothing — there is no this-week to open on, and the whole season is the
 * record. The week is the club's (C2): `day` is already the org-zone day (`orgDayKey`), so its Monday is the org's week.
 */
export function seasonWeeks<B extends { day: string }>(bookings: readonly B[], today: string): { earlier: SeasonWeek<B>[]; ahead: SeasonWeek<B>[] } {
  const byMonday = new Map<string, B[]>();
  for (const b of bookings) {
    const monday = mondayOfDay(b.day);
    const week = byMonday.get(monday);
    if (week) week.push(b); else byMonday.set(monday, [b]);
  }
  const weeks = [...byMonday].sort(([a], [b]) => a.localeCompare(b)).map(([monday, bs]) => ({ monday, bookings: bs }));
  const at = weeks.findIndex(w => w.monday >= mondayOfDay(today));
  return at <= 0 ? { earlier: [], ahead: weeks } : { earlier: weeks.slice(0, at), ahead: weeks.slice(at) };
}

/**
 * Where the "Today · Thu, Jun 17" line sits in a week (C7): before its first booking on or after today, or after the last
 * when the week's bookings are all behind today; null in any week but this one.
 */
export function todayLineAt(week: SeasonWeek<{ day: string }>, today: string): number | null {
  if (week.monday !== mondayOfDay(today)) return null;
  const at = week.bookings.findIndex(b => b.day >= today);
  return at < 0 ? week.bookings.length : at;
}

/** The public schedule's own words (g1, g2). Settled: HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Stage 9d-2a" g. */
export const SEASON_PUBLIC_WORDS = {
  /** "Was Sat, Jun 12" — a postponed game's old day; its clock follows. */
  was: (day: string) => `Was ${day}`,
  postponed: 'Postponed · new date to come',
  /** A game that has never had a date (the admin can save one without): nothing to say it "was". */
  dateToCome: 'Date to come',
  noGames: 'No games scheduled yet.',
} as const;

/** Words. Settled: HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Stage 9d-2a" (b1–b4). */
export const SEASON_SCHEDULE_WORDS = {
  needsDate: 'Needs a new date',
  nightTitle: (teams: number) => `Practices · ${pluralize(teams, 'team')}`,
  earlierWeeks: (n: number) => `Show ${pluralize(n, 'earlier week')}`,
  thisWeek: 'this week',
  emptyDivision: (division: string) => `${division} has no games or practices yet.`,
  emptyDivisionHint: 'Add one, or generate the season’s games.',
  emptyWeek: 'Nothing is scheduled this week.',
  emptyMonth: (month: string) => `Nothing is scheduled in ${month}.`,
  nothingMatches: 'Nothing here matches the filters.',
  addTitle: 'Add to the schedule',
  addGame: 'A game',
  addPractice: 'A practice',
} as const;
