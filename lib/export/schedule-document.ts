/**
 * lib/export/schedule-document.ts
 *
 * How a TOURNAMENT schedule becomes PAPER — the day headings, the words, and which columns earn
 * their width.
 *
 * ⚠ The day grouping, the venue lift and the status-collapse rules below are meant to be shared
 * with the league season schedule and the coach team schedule when those get their PDFs — but the
 * COLUMN SET here is a fixed literal, and neither of those callers has the same one (a league
 * season carries a score; a coach's team carries arrival time, uniform and event type). Whichever
 * lands first should make the columns and the per-row cell builder parameters of this function,
 * rather than forking the shared rules. Do not read this file as already general: it is not.
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
  groups: { label: string; rows: string[][] }[];
}

/** "Riverdale Memorial Park - Diamond 1" → ['Riverdale Memorial Park', 'Diamond 1']. */
function splitVenue(location: string): [string, string] {
  const i = location.indexOf(' - ');
  return i < 0 ? [location, ''] : [location.slice(0, i), location.slice(i + 3)];
}

/** Preserves the order games arrive in; a day appears where its first game does. */
function groupByDay(games: ScheduleGame[]): [string, ScheduleGame[]][] {
  const byDay = new Map<string, ScheduleGame[]>();
  for (const g of games) {
    const day = byDay.get(g.date);
    if (day) day.push(g);
    else byDay.set(g.date, [g]);
  }
  return [...byDay];
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

/**
 * Turn games into the day-grouped document the exporter prints.
 *
 * The Status column is built LAST and kept only if something in it speaks: on a schedule printed
 * before the weekend every game is scheduled and the column is 21 blank cells, so it comes off
 * and the paper is quieter for it.
 */
export function buildScheduleDocument(games: ScheduleGame[]): ScheduleDocument {
  const days = groupByDay(games);

  const groups = days.map(([date, dayGames]) => {
    // A day played entirely at one park says so ONCE, in its heading. "Riverdale Memorial Park - "
    // was printing ahead of the only part that differed — the diamond number — on every row.
    //
    // ⚠ Only when every game has a FIELD to leave behind. A venue stored without one ("The Dome")
    // has nothing to strip, so lifting it printed the same name in the heading AND on every row —
    // the repetition this rule exists to kill, doubled.
    const split = dayGames.map(g => splitVenue(g.location));
    const venues = new Set(split.map(([venue]) => venue));
    const oneVenue = venues.size === 1 && split.every(([, field]) => field !== '')
      ? [...venues][0]
      : null;

    // A day where every game shares a status says it in the heading instead of down the column —
    // but never for `scheduled`, which is what a schedule means and is worth no ink at all.
    const kinds = new Set(dayGames.map(g => g.status));
    const uniform = kinds.size === 1 ? [...kinds][0] : null;
    const uniformNote = uniform && uniform !== 'scheduled'
      ? `   ·   all ${scheduleStatusWord(uniform).toLowerCase()}`
      : '';

    const label = [
      formatWeekdayDate(date) || NO_DATE,
      pluralize(dayGames.length, 'game'),
      ...(oneVenue ? [oneVenue] : []),
    ].join('   ·   ') + uniformNote;

    const rows = dayGames.map((g, i) => {
      const cancelled = g.status === 'cancelled';
      return [
        cancelled ? CANCELLED_CLOCK : (g.time || NO_TIME),
        g.division,
        g.homeTeam,
        g.awayTeam,
        // The heading stays "Location" whichever way this falls: under a day heading that already
        // names the park, a cell reading "Diamond 2" IS the location. A per-day column heading
        // would split one document's tables into separate column grids.
        oneVenue ? split[i][1] : g.location,
        // A cancelled game keeps the time it gave up — and says nothing more, because its clock
        // already reads CANCELLED. Everything else is blank where the heading covered it.
        // `uniform` covers the whole-day case; `scheduled` is worth no ink on any day.
        cancelled ? (g.time ? `was ${g.time}` : '')
          : (uniform || g.status === 'scheduled') ? ''
          : scheduleStatusWord(g.status),
      ];
    });

    return { label, rows };
  });

  // Status is the last column, and it survives only if something in it speaks. On a schedule
  // printed before the weekend every game is scheduled, so it would be a column of blank cells.
  const headers = ['Time', 'Division', 'Home Team', 'Away Team', 'Location', 'Status'];
  const statusIdx = headers.length - 1;
  const keep = groups.some(g => g.rows.some(r => r[statusIdx] !== '')) ? headers.length : statusIdx;
  return {
    headers: headers.slice(0, keep),
    groups: groups.map(g => ({ label: g.label, rows: g.rows.map(r => r.slice(0, keep)) })),
  };
}
