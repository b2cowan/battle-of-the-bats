/**
 * club-calendar-view.ts — the CLUB CALENDAR's pure half (Club Tier Stage 6b, Asks 6–7, ratified 2026-10-08 — hub
 * K4MPu4ni53Ct7yrDcmWJd9 v64, Mockups → Stage 6 → specimen 5; design log 2026-10-09 (1)–(3)). Client-safe and
 * React-free: what a booking IS on the page, the filters, the clash count, the date ranges, the words and the export's
 * rows. The server half (`lib/club-calendar.ts`) reads the three programs and runs 6a's one clash rule; the page draws
 * what this module decides.
 *
 * ⚖ ONE CLOCK, SAID ONCE: every day is the org's (`orgDayKey`), every time is read in the platform zone, and the page
 *   says so once ("Times in Eastern time."). A per-club zone is a platform item (S6-13), not this page's.
 * ⚖ A BOOKING'S COLOUR IS ITS TEAM (design log (3)): the portal's one-team schedule colours by kind; a club page's
 *   question is who. House league and tournaments carry no team colour and say their program in words.
 * ⚖ THE CLASH COUNT IS PAIRS (the drawing's "3 clashes" over six marked bookings): two bookings that hold one facility at
 *   once are ONE clash, said once, however many of its sides are on screen. "Busy then" (a facility unset on one side) is
 *   drawn dashed and is not counted: it MAY clash.
 */
import { formatInOrgZone, mondayOfDay, addCalendarDays, utcToZonedInputs } from './timezone.ts';
import { formatTimeRange, formatTime, pluralize } from './utils.ts';
import { orgClock } from './club-board-view.ts';
import { facilityWords } from './venue-clash-words.ts';
import type { ClashBookingKind } from './venue-clash.ts';
import type { ICSInstantEventInput } from './export/ics.ts';

export type CalendarProgram = 'rep' | 'league' | 'tournament';
export type CalendarKind = 'practice' | 'game' | 'tryout' | 'team_event' | 'tournament_day';
export type CalendarView = 'list' | 'week' | 'month';

/** The other side of a clash, as the read window says it. `key` is that booking's calendar key (a tournament game's is
 *  its day's). `contact`: a team's head coach (only when the reader can open rep teams), a season or a tournament. */
export interface CalendarOther {
  key: string;
  program: CalendarProgram;
  kind: ClashBookingKind;
  /** "14U AA practice", "a 2026 Fall House League game" — 6a's words (`clashOtherName`). */
  label: string;
  startMs: number;
  endMs: number;
  /** The facility (the sport's word), or the venue when the other side set none. */
  where: string;
  contact: string | null;
  clash: 'booked_by' | 'busy_then';
}

/** Where a booking is: one of the club's venues (compared), or a team's own place / typed words (shown as they are). */
export interface CalendarWhere {
  venueId: string | null;
  venueName: string | null;
  facility: string | null;
  address: string | null;
  /** The booking's own words when it isn't on a club venue ("Eastview Park", "Westfield School — back field"). */
  text: string | null;
}

export interface CalendarDoor {
  label: string;
  href: string;
  /** A tournament door sets the admin's current tournament before it opens it. */
  tournamentId?: string;
}

export interface CalendarBooking {
  /** Stable: `rep_event:…`, `tryout_session:…`, `league_game:…`, `league_practice:…`, `tday:<tournament>:<day>`. */
  key: string;
  program: CalendarProgram;
  kind: CalendarKind;
  /** The org-zone day it falls on (YYYY-MM-DD). */
  day: string;
  startMs: number;
  endMs: number;
  /** A stored end exists (a booking with none is drawn by its start alone; the rule still gives it 90 minutes). */
  hasEnd: boolean;
  /** A tournament day whose games have no time yet. */
  allDay: boolean;
  teamId: string | null;
  /** The team, the house-league season, the tournament. */
  ownerName: string;
  /** A rep team's colour — the booking's edge. Null for house league and tournaments. */
  colour: string | null;
  /** "13U AAA" · "Reds vs Blues" · "UAT Rep Club Invitational 2026". */
  who: string;
  /** "Practice" · "vs Northside Thunder" · "U9 Rookie" · "15U · 8 games". */
  what: string;
  /** The program's sport — the facility's word. */
  sport: string | null;
  where: CalendarWhere;
  headCoach: string | null;
  clash: 'booked_by' | 'busy_then' | null;
  clashesWith: CalendarOther[];
  door: CalendarDoor | null;
}

export interface CalendarRead {
  from: string;
  to: string;
  /** The programs this reader can open — the only ones on the page. */
  programs: CalendarProgram[];
  bookings: CalendarBooking[];
  /** The club's venues by their CURRENT names — the Venue filter's rows (a booking's own words may be older). */
  venues: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export const PROGRAM_WORD: Record<CalendarProgram, string> = { rep: 'Rep teams', league: 'House league', tournament: 'Tournaments' };
/** The program's word ON a booking (house league and tournaments say theirs; a team's colour says it for a team). */
export const PROGRAM_TAG: Record<CalendarProgram, string | null> = { rep: null, league: 'House league', tournament: 'Tournament' };

export const KIND_EYEBROW: Record<CalendarKind, string> = {
  practice: 'Practice', game: 'Game', tryout: 'Tryout', team_event: 'Team event', tournament_day: 'Tournament',
};

export const CALENDAR_WORDS = {
  title: 'Calendar',
  /** The date row's one line about the clock (Ask 7). */
  timesNote: 'Times in Eastern time.',
  clashes: (n: number) => pluralize(n, 'clash', 'clashes'),
  /** The Venue filter's last row: bookings on a team's own place or typed words. */
  elsewhere: 'Places the club doesn’t own',
  loadFailed: 'We couldn’t load the club’s calendar.',
  nothingThisWeek: 'Nothing is booked this week.',
  nothingMatches: 'Nothing here matches the filters.',
  noPrograms: 'The calendar shows the programs you can open, and your role opens none of them.',
  clashesWithHeading: 'Clashes with',
  mayClashHeading: 'Busy then',
  /** The read window's door words (/marketing). */
  doorTeam: (team: string) => `Open ${team}’s schedule`,
  doorPortal: 'Open in the Coaches Portal',
  doorTryouts: (team: string) => `Open ${team}’s tryouts`,
  doorSeason: (season: string) => `Open ${season}’s schedule`,
  doorTournament: (name: string) => `Open ${name}`,
  /** Export's one line (/marketing): the range, the filters, the count — "what the page shows". */
  exportHolds: (range: string, filters: readonly string[], n: number) =>
    [range, ...filters, `${pluralize(n, 'booking')}, as shown`].join(' · '),
} as const;

/** An instant's wall clock in the org's zone, "18:00" — what the house clock formatters take. */
const hm = (ms: number) => utcToZonedInputs(new Date(ms).toISOString()).time;

/** A clock label for an instant, in the org's zone: "6:00 p.m." (the club board's `orgClock`). */
export const clockOf = (ms: number): string => orgClock(new Date(ms).toISOString());

/** "5:30–7:30 p.m." — a booking's time; its start alone when it holds no end; "All day" for an untimed tournament day. */
export function timeWords(b: Pick<CalendarBooking, 'startMs' | 'endMs' | 'hasEnd' | 'allDay'>): string {
  if (b.allDay) return 'All day';
  return b.hasEnd ? formatTimeRange(hm(b.startMs), hm(b.endMs)) : formatTime(hm(b.startMs));
}

/** "5:30–7:30 p.m." for the other side of a clash (its length is always known: the rule's). */
export const otherTimeWords = (o: Pick<CalendarOther, 'startMs' | 'endMs'>): string => formatTimeRange(hm(o.startMs), hm(o.endMs));

/** "Lions Park · Diamond 2" — a club venue and its facility (the sport's word for a bare "2"); a team's own words as they are. */
export function whereWords(b: Pick<CalendarBooking, 'where' | 'sport'>): string {
  const w = b.where;
  if (w.venueName) {
    const fac = facilityWords(b.sport, w.facility);
    return fac ? `${w.venueName} · ${fac}` : w.venueName;
  }
  return w.text ?? '';
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** The Venue filter's id for bookings on a place the club doesn't own. */
export const ELSEWHERE = '__elsewhere';

export interface CalendarFilters {
  /** Empty = every venue. A venue id, or `ELSEWHERE`. */
  venues: ReadonlySet<string>;
  programs: ReadonlySet<CalendarProgram>;
  teams: ReadonlySet<string>;
  clashesOnly: boolean;
}

export const NO_FILTERS: CalendarFilters = { venues: new Set(), programs: new Set(), teams: new Set(), clashesOnly: false };

const venueKeyOf = (b: CalendarBooking) => b.where.venueId ?? ELSEWHERE;

/** One booking against the filters. A Team filter keeps only rep bookings — house league and tournaments have no team. */
export function matchesFilters(b: CalendarBooking, f: CalendarFilters): boolean {
  if (f.venues.size && !f.venues.has(venueKeyOf(b))) return false;
  if (f.programs.size && !f.programs.has(b.program)) return false;
  if (f.teams.size && !(b.teamId && f.teams.has(b.teamId))) return false;
  if (f.clashesOnly && b.clash !== 'booked_by') return false;
  return true;
}

/** Each choice's count, at its row's end (the 2026-10-05 rule): the bookings in the range it would show, alone. */
export function filterOptions(bookings: readonly CalendarBooking[], venueNames?: ReadonlyMap<string, string>): {
  venues: { id: string; label: string; count: number }[];
  programs: { id: CalendarProgram; label: string; count: number }[];
  teams: { id: string; label: string; count: number }[];
} {
  const venues = new Map<string, { label: string; count: number }>();
  const programs = new Map<CalendarProgram, number>();
  const teams = new Map<string, { label: string; count: number }>();
  let elsewhere = 0;
  for (const b of bookings) {
    if (b.where.venueId) {
      const v = venues.get(b.where.venueId) ?? { label: venueNames?.get(b.where.venueId) ?? b.where.venueName ?? 'A venue', count: 0 };
      v.count += 1;
      venues.set(b.where.venueId, v);
    } else elsewhere += 1;
    programs.set(b.program, (programs.get(b.program) ?? 0) + 1);
    if (b.teamId) {
      const t = teams.get(b.teamId) ?? { label: b.ownerName, count: 0 };
      t.count += 1;
      teams.set(b.teamId, t);
    }
  }
  const byLabel = <T extends { label: string }>(a: T, b: T) => a.label.localeCompare(b.label, 'en-CA', { numeric: true });
  return {
    venues: [
      ...[...venues].map(([id, v]) => ({ id, ...v })).sort(byLabel),
      ...(elsewhere ? [{ id: ELSEWHERE, label: CALENDAR_WORDS.elsewhere, count: elsewhere }] : []),
    ],
    programs: (['rep', 'league', 'tournament'] as const).filter(p => programs.has(p)).map(p => ({ id: p, label: PROGRAM_WORD[p], count: programs.get(p)! })),
    teams: [...teams].map(([id, t]) => ({ id, ...t })).sort(byLabel),
  };
}

/**
 * The clash count — PAIRS, each once (see the header): every `booked_by` pair with at least one side among `shown`.
 * The other side may be off screen (another program the reader can't open, a filter): it is still one clash.
 */
export function clashPairCount(shown: readonly CalendarBooking[]): number {
  const pairs = new Set<string>();
  for (const b of shown) {
    for (const o of b.clashesWith) {
      if (o.clash !== 'booked_by') continue;
      pairs.add(b.key < o.key ? `${b.key}|${o.key}` : `${o.key}|${b.key}`);
    }
  }
  return pairs.size;
}

// ---------------------------------------------------------------------------
// Ranges
// ---------------------------------------------------------------------------

/** The days a view reads: Week and List read the cursor's week (Monday–Sunday), Month its calendar month. */
/** The first day of the month after a day's month ("2026-11-17" → "2026-12-01"): the 28th plus a week is always next month. */
const nextMonthFirst = (day: string) => `${addCalendarDays(`${day.slice(0, 7)}-28`, 7).slice(0, 7)}-01`;

export function rangeFor(view: CalendarView, cursor: string): { from: string; to: string } {
  if (view === 'month') return { from: `${cursor.slice(0, 7)}-01`, to: addCalendarDays(nextMonthFirst(cursor), -1) };
  const from = mondayOfDay(cursor);
  return { from, to: addCalendarDays(from, 6) };
}

/** Earlier / Later: a week, or a month. */
export function stepCursor(view: CalendarView, cursor: string, dir: -1 | 1): string {
  if (view !== 'month') return addCalendarDays(cursor, 7 * dir);
  return dir < 0 ? `${addCalendarDays(`${cursor.slice(0, 7)}-01`, -1).slice(0, 7)}-01` : nextMonthFirst(cursor);
}

const md = (day: string, opts: Intl.DateTimeFormatOptions) => formatInOrgZone(`${day}T12:00:00Z`, opts);

/** "Nov 2 – 8, 2026" · "Oct 26 – Nov 1, 2026" · "Dec 28, 2026 – Jan 3, 2027" · "November 2026". */
export function rangeWords(view: CalendarView, cursor: string): string {
  if (view === 'month') return md(`${cursor.slice(0, 7)}-15`, { month: 'long', year: 'numeric' });
  const { from, to } = rangeFor(view, cursor);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  if (sameMonth) return `${md(from, { month: 'short', day: 'numeric' })} – ${Number(to.slice(8))}, ${to.slice(0, 4)}`;
  if (sameYear) return `${md(from, { month: 'short', day: 'numeric' })} – ${md(to, { month: 'short', day: 'numeric' })}, ${to.slice(0, 4)}`;
  return `${md(from, { month: 'short', day: 'numeric', year: 'numeric' })} – ${md(to, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** The phone's short range ("Nov 2 – 8") — the year is the page's. */
export function rangeWordsShort(view: CalendarView, cursor: string): string {
  if (view === 'month') return md(`${cursor.slice(0, 7)}-15`, { month: 'long', year: 'numeric' });
  const { from, to } = rangeFor(view, cursor);
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${md(from, { month: 'short', day: 'numeric' })} – ${Number(to.slice(8))}`
    : `${md(from, { month: 'short', day: 'numeric' })} – ${md(to, { month: 'short', day: 'numeric' })}`;
}

/** The seven days of a week. */
export function weekDays(cursor: string): string[] {
  const from = mondayOfDay(cursor);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(from, i));
}

/** A month as Monday-first weeks: each cell a day of the month, or null padding. */
export function monthCells(cursor: string): (string | null)[] {
  const { from, to } = rangeFor('month', cursor);
  const dow = new Date(`${from}T12:00:00Z`).getUTCDay();
  const cells: (string | null)[] = Array((dow + 6) % 7).fill(null);
  for (let d = from; d <= to; d = addCalendarDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** "Mon 2" — a day as a week column / the phone stack names it. "Monday, November 2" — as a List band names it. */
export const dayShort = (day: string) => md(day, { weekday: 'short', day: 'numeric' });
export const dayLong = (day: string) => md(day, { weekday: 'long', month: 'long', day: 'numeric' });
export const weekdayShort = (day: string) => md(day, { weekday: 'short' });

/** Bookings by day, each day in time order (an untimed tournament day first). */
export function byDay(bookings: readonly CalendarBooking[]): Map<string, CalendarBooking[]> {
  const out = new Map<string, CalendarBooking[]>();
  const sorted = [...bookings].sort((a, b) => (a.day === b.day ? (a.allDay === b.allDay ? a.startMs - b.startMs : a.allDay ? -1 : 1) : a.day.localeCompare(b.day)));
  for (const b of sorted) out.set(b.day, [...(out.get(b.day) ?? []), b]);
  return out;
}

/** "Clashes with 13U AAA practice" — the List's line under the place, and the phone card's. */
export function clashLineWords(b: CalendarBooking): string | null {
  const exact = b.clashesWith.filter(o => o.clash === 'booked_by');
  if (exact.length) return `Clashes with ${exact.map(o => o.label).join(', ')}`;
  const busy = b.clashesWith.filter(o => o.clash === 'busy_then');
  return busy.length ? `Busy then: ${busy.map(o => o.label).join(', ')}` : null;
}

// ---------------------------------------------------------------------------
// Export — what the page shows
// ---------------------------------------------------------------------------

export interface CalendarExportRow {
  date: string; time: string; program: string; who: string; what: string; venue: string; facility: string; clash: string;
}

export function exportRows(bookings: readonly CalendarBooking[]): CalendarExportRow[] {
  return [...byDay(bookings).values()].flat().map(b => ({
    date: b.day,
    time: timeWords(b),
    program: PROGRAM_WORD[b.program],
    who: b.who,
    what: b.what,
    venue: b.where.venueName ?? b.where.text ?? '',
    facility: b.where.venueName ? facilityWords(b.sport, b.where.facility) : '',
    clash: clashLineWords(b) ?? '',
  }));
}

export const EXPORT_COLUMNS: { key: keyof CalendarExportRow; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'program', label: 'Program' },
  { key: 'who', label: 'Who' },
  { key: 'what', label: 'What' },
  { key: 'venue', label: 'Venue' },
  { key: 'facility', label: 'Facility' },
  { key: 'clash', label: 'Clash' },
];

/** The Calendar (.ics) file's entries — instants anchored in UTC (the coach schedule's rule), what the page shows. */
export function icsEntries(bookings: readonly CalendarBooking[]): ICSInstantEventInput[] {
  return bookings.map(b => ({
    uid: b.key.replace(/[^a-zA-Z0-9-]/g, '-'),
    title: `${b.who} · ${b.what}`,
    startsAtIso: new Date(b.startMs).toISOString(),
    endsAtIso: new Date(b.endMs).toISOString(),
    location: whereWords(b) || undefined,
    description: clashLineWords(b) ?? undefined,
  }));
}
