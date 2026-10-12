/**
 * lib/export/schedule-document.ts
 *
 * How a TOURNAMENT schedule becomes PAPER — the day headings, the words, and which columns earn
 * their width.
 *
 * ⚖ THE DAY GROUPING IS SHARED — `buildDayDocument` (Club Tier Stage 11a, part B, 2026-10-11: the
 * club's schedule was the first other caller, and this header asked whichever came first to make the
 * columns and the per-row cell builder parameters rather than fork the shared rules). It groups items
 * by day (and, where a caller needs it, by a section inside the day), heads each group with the weekday
 * date and the caller's facts, and builds each row with the caller's cells; a section may carry its
 * own column headings. The TOURNAMENT's rules — the venue lift, the status collapse, the Status column
 * that survives only when it speaks — are `buildScheduleDocument`'s, written on top of it and
 * unchanged. The club scheduler's columns (its fields across) live in `lib/club-schedule-document.ts`.
 * The league season schedule and the coach team schedule, when they get their PDFs, are callers of
 * `buildDayDocument` too (a league season carries a score; a coach's team carries arrival, uniform and
 * event type) — never a fork.
 *
 * ⚠ This is a PRINT shape, not a data shape. The spreadsheet and calendar exports keep every
 * column and every raw value; nothing here touches them. Decided from rendered paper with the
 * owner, PDF Export Quality Phase 2, pass 5 (2026-08-25):
 *
 *   • The definition of good is "the whole weekend, at a glance, on a wall". Nobody reads a
 *     schedule top to bottom — they hunt one row. Findability beats completeness.
 *   • Games GROUP BY DAY, and the day heading names the weekday. The screen's own Date column
 *     printed a stored `2026-07-31` on every row and the word "Friday" appeared nowhere on a
 *     document whose entire job is a weekend.
 *   • A column that says the same thing on every row is not a column. The day's single venue
 *     rises into its heading; the status word is printed only where it is an EXCEPTION.
 *   • A CANCELLED game must be unmissable. It loses its clock — the Time column says so — because
 *     a status word at the far right edge of a landscape page is not a warning, and somebody
 *     drives to that diamond.
 */
import { formatWeekdayDate } from '../timezone';
import { pluralize } from '../utils';
import { scheduleStatusWord } from '../tournament-schedule-status';

/** One game, as a schedule screen holds it. Values are already display-formatted except `date`. */
export interface ScheduleGame {
  /** `YYYY-MM-DD`. Games are expected in the order the reader should see them (date, then time). */
  date: string;
  /** Formatted clock ("8:00 AM"), or empty when the game has no time yet. */
  time: string;
  division: string;
  homeTeam: string;
  awayTeam: string;
  /** Full location as the screen shows it — "Riverdale Memorial Park - Diamond 1". */
  location: string;
  /** The stored status word (`scheduled` / `completed` / `cancelled`). */
  status: string;
}

export interface ScheduleDocument {
  headers: string[];
  /** A group may carry its own column headings (a venue's fields); without them it reads the document's `headers`. */
  groups: { label: string; headers?: string[]; rows: string[][] }[];
}

/** The day heading's separator, wide enough to read across a landscape page. */
export const DAY_HEADING_SEP = '   ·   ';

/**
 * THE SHARED DAY DOCUMENT's contract: `prepare` works a group's context out ONCE (the tournament's
 * lifted venue and its uniform status), `facts` says what the heading adds after the weekday date,
 * `headersOf` gives a section its own columns, and `cells` builds one row.
 */
export interface DayDocumentSpec<T, C> {
  /** The item's day, `YYYY-MM-DD` (an empty or unparseable one heads its group with `noDate`). */
  dateOf: (item: T) => string;
  /** A day splits into a section per key (a schedule over two venues reads a section per venue a day). */
  sectionOf?: (item: T) => string;
  /** The day heading's weekday date. */
  dayWords: (date: string) => string;
  /** The heading for items with no date yet. */
  noDate?: string;
  prepare: (items: T[]) => C;
  facts: (items: T[], ctx: C) => string[];
  headersOf?: (items: T[], ctx: C) => string[];
  cells: (item: T, ctx: C) => string[];
}

/** Groups by day (and section) in the order the items arrive: a day appears where its first item does. */
export function buildDayDocument<T, C>(items: readonly T[], headers: string[], spec: DayDocumentSpec<T, C>): ScheduleDocument {
  const bySection = new Map<string, T[]>();
  for (const it of items) {
    const key = `${spec.dateOf(it)}|${spec.sectionOf ? spec.sectionOf(it) : ''}`;
    const list = bySection.get(key);
    if (list) list.push(it);
    else bySection.set(key, [it]);
  }
  const groups = [...bySection.values()].map(list => {
    const ctx = spec.prepare(list);
    const label = [spec.dayWords(spec.dateOf(list[0])) || spec.noDate || '', ...spec.facts(list, ctx)].filter(Boolean).join(DAY_HEADING_SEP);
    const own = spec.headersOf?.(list, ctx);
    return { label, ...(own ? { headers: own } : {}), rows: list.map(it => spec.cells(it, ctx)) };
  });
  return { headers, groups };
}

/** "Riverdale Memorial Park - Diamond 1" → ['Riverdale Memorial Park', 'Diamond 1']. */
function splitVenue(location: string): [string, string] {
  const i = location.indexOf(' - ');
  return i < 0 ? [location, ''] : [location.slice(0, i), location.slice(i + 3)];
}

/** The clock cell. A cancelled game gives its slot up, where the reader is already looking. */
const CANCELLED_CLOCK = 'CANCELLED';
const NO_TIME = 'Time TBD';

/**
 * The heading for games that have no date yet — a normal state, not a fault: playoff games exist
 * before anyone knows when they are played, and the games API returns them with a null date.
 *
 * ⚠ Without this the heading built to "   ·   3 games" — opening with the separator dots and never
 * naming a day, on a document whose entire job is weekday findability (/review, 2026-08-25, found
 * independently by two lenses). Postgres sorts a null date last, so this group lands at the end of
 * the document on its own, which is where an organizer wants it.
 */
const NO_DATE = 'Date TBD';

interface GameDay { split: Map<ScheduleGame, [string, string]>; oneVenue: string | null; uniform: string | null }

/**
 * Turn games into the day-grouped document the exporter prints.
 *
 * The Status column is built LAST and kept only if something in it speaks: on a schedule printed
 * before the weekend every game is scheduled and the column is 21 blank cells, so it comes off
 * and the paper is quieter for it.
 */
export function buildScheduleDocument(games: ScheduleGame[]): ScheduleDocument {
  const headers = ['Time', 'Division', 'Home Team', 'Away Team', 'Location', 'Status'];
  const doc = buildDayDocument<ScheduleGame, GameDay>(games, headers, {
    dateOf: g => g.date,
    dayWords: formatWeekdayDate,
    noDate: NO_DATE,
    prepare: dayGames => {
      // A day played entirely at one park says so ONCE, in its heading. "Riverdale Memorial Park - "
      // was printing ahead of the only part that differed — the diamond number — on every row.
      //
      // ⚠ Only when every game has a FIELD to leave behind. A venue stored without one ("The Dome")
      // has nothing to strip, so lifting it printed the same name in the heading AND on every row —
      // the repetition this rule exists to kill, doubled.
      const split = new Map(dayGames.map(g => [g, splitVenue(g.location)] as const));
      const venues = new Set([...split.values()].map(([venue]) => venue));
      const oneVenue = venues.size === 1 && [...split.values()].every(([, field]) => field !== '')
        ? [...venues][0]
        : null;
      // A day where every game shares a status says it in the heading instead of down the column —
      // but never for `scheduled`, which is what a schedule means and is worth no ink at all.
      const kinds = new Set(dayGames.map(g => g.status));
      const uniform = kinds.size === 1 ? [...kinds][0] : null;
      return { split, oneVenue, uniform };
    },
    facts: (dayGames, day) => [
      pluralize(dayGames.length, 'game'),
      ...(day.oneVenue ? [day.oneVenue] : []),
      ...(day.uniform && day.uniform !== 'scheduled' ? [`all ${scheduleStatusWord(day.uniform).toLowerCase()}`] : []),
    ],
    cells: (g, day) => {
      const cancelled = g.status === 'cancelled';
      return [
        cancelled ? CANCELLED_CLOCK : (g.time || NO_TIME),
        g.division,
        g.homeTeam,
        g.awayTeam,
        // The heading stays "Location" whichever way this falls: under a day heading that already
        // names the park, a cell reading "Diamond 2" IS the location. A per-day column heading
        // would split one document's tables into separate column grids.
        day.oneVenue ? day.split.get(g)![1] : g.location,
        // A cancelled game keeps the time it gave up — and says nothing more, because its clock
        // already reads CANCELLED. Everything else is blank where the heading covered it.
        // `uniform` covers the whole-day case; `scheduled` is worth no ink on any day.
        cancelled ? (g.time ? `was ${g.time}` : '')
          : (day.uniform || g.status === 'scheduled') ? ''
          : scheduleStatusWord(g.status),
      ];
    },
  });

  // Status is the last column, and it survives only if something in it speaks. On a schedule
  // printed before the weekend every game is scheduled, so it would be a column of blank cells.
  const statusIdx = headers.length - 1;
  const keep = doc.groups.some(g => g.rows.some(r => r[statusIdx] !== '')) ? headers.length : statusIdx;
  return {
    headers: headers.slice(0, keep),
    groups: doc.groups.map(g => ({ label: g.label, rows: g.rows.map(r => r.slice(0, keep)) })),
  };
}
