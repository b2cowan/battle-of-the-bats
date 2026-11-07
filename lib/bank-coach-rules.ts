/**
 * THE COACH'S BANK ROUTES, DECIDED (Bank balance check BC6a; plan §4, §9 BC6). The pure half of the team bank routes BC6b
 * builds: the client sends INTENT (this date, this balance, these lines are not in the bank yet, this much cash); the
 * server has read the team's working season (lib/bank-coach-read.ts) and this file decides, with the engine
 * (lib/bank-check.ts) and the coach's map (lib/bank-coach-map.ts), what a save writes or refuses. No IO; tested with
 * fixtures (tests/unit/bank-coach.test.ts).
 *
 * ⚖ RULING 3: a check saves whether it matches or not. ⚖ ASK 1: nothing here writes money; cash is a number on the check.
 * ⚖ RULE 6: the only figures taken from the client are the statement's balance and the cash figure; Your books and every
 *   waiting item's figures are the server's own read of this team's register.
 * ⚖ WHAT THE DATABASE DOESN'T RE-CHECK FOR A TEAM: `bank_check_save`'s team branch (mig 450) refuses a start, book ids and
 *   a start id, and a date after the club's today; it takes the books figure and the items as given and knows nothing of
 *   a season. The season's window (before its start) and "one of this team's own lines" are decided HERE, on the server's
 *   fresh read, and nowhere else — the route must call `coachSavePlan` on every save.
 */

import { coachBooksOnDate, type BankLine, type WaitingItem } from './bank-check';
import {
  checksInSeason, coachFind, coachMarkable, coachStillWaiting, type CoachRow, type LastSeason, type TeamSavedCheck,
} from './bank-coach-map';
import { checkedThrough, cutText, MAX_WAITING, no, readCents, readDay, type CheckedThrough } from './bank-club-rules';

/** The date rules a team's save is refused by, before any figure is read. */
export type CoachSaveRefusal = 'ends_in_future' | 'before_season';

/** Not after the club's today (the step holds it again); not before the working season's start (O5; the step can't). */
export function coachSaveRefusal(i: { date: string; today: string; seasonStart: string }): CoachSaveRefusal | null {
  if (i.date > i.today) return 'ends_in_future';
  if (i.date < i.seasonStart) return 'before_season';
  return null;
}

/** What a save on D stands on, from the server's read (`coachFigureOn`). */
export interface CoachSaveFacts {
  /** The club's day and the working season's start: `coachSavePlan` re-checks the date rules itself (BC6a /review: the
   *  step can't see a season, so this plan is the only gate on it, whoever built the facts). */
  today: string;
  seasonStart: string;
  /** Your books on D (P2'). */
  booksCents: number;
  /** The lines that may be marked Not in the bank yet on D, by key (`coachMarkable`). */
  markable: ReadonlyMap<string, BankLine>;
}

/**
 * Decide a team's save whose date rules have passed (`coachSaveRefusal`). Each waiting key must be a line `markable` on D
 * — this team's own settled, cash-moving register row of the working season on or before D, or last season's line Find or
 * Still waiting? offers (Q1) — and its figures are the line's as the server read it. A key given twice is one item. The
 * args are `bank_check_save`'s for a team: a check (never a start), no book ids, no on its way, no start.
 */
export function coachSavePlan(input: { date: string; body: Record<string, unknown>; facts: CoachSaveFacts }) {
  const { date, body, facts } = input;
  if (readDay(date) === null) return no('bad_date');
  const refused = coachSaveRefusal({ date, today: facts.today, seasonStart: facts.seasonStart });
  if (refused) return no(refused);
  const bankCents = readCents(body.bankCents, { positive: false });
  if (bankCents === null) return no('bad_figures');

  let cashCents: number | null = null;
  if (body.cashCents !== undefined && body.cashCents !== null && body.cashCents !== 0) {
    cashCents = readCents(body.cashCents, { positive: true });
    if (cashCents === null) return no('bad_amount');
  }

  const keys = body.waiting ?? [];
  if (!Array.isArray(keys) || keys.length > MAX_WAITING) return no('bad_team_item');
  const waiting = new Map<string, WaitingItem>();
  for (const k of keys) {
    const line = typeof k === 'string' ? facts.markable.get(k) : undefined;
    if (!line || line.date > date) return no('bad_team_item');
    const label = line.label ? cutText(line.label.trim(), 200) : '';
    waiting.set(line.key, { key: line.key, date: line.date, direction: line.direction, amountCents: line.amountCents, ...(label ? { label } : {}) });
  }
  return {
    ok: true as const,
    args: {
      kind: 'check' as const, date, bankCents, booksCents: facts.booksCents, onItsWayCents: null, cashCents, bookIds: null,
      waiting: [...waiting.values()],
    },
  };
}

/** Ask 4 for a team: the working season's latest check (Matches / Off by $X); null before one — a check of an earlier
 *  season never shows (B10, §9 BC6). */
export const coachCheckedThrough = (checks: readonly TeamSavedCheck[], seasonStart: string): CheckedThrough | null =>
  checkedThrough(checksInSeason(checks, seasonStart));

/** At most this many suspects go to the screen, per list (the hints look through the most recent 400: lib/bank-check.ts). */
export const COACH_SUSPECT_CAP = 1000;

/** The figure for a statement date D (no bank balance: the screen types it and the engine figures the band). */
export interface CoachFigureForDate {
  date: string;
  /** Why a save on this date would be refused (the screen says it before Save; the save refuses the same). */
  refused: CoachSaveRefusal | null;
  /** The working season's start (the screen's "Statements from this season only, since {date}."). */
  seasonStart: string;
  /** Your books on D; null when refused. */
  booksCents: number | null;
  /** Ask 3: this season's lines since the last match (every line of the season when none), newest first. */
  suspects: { since: string; sinceMatch: boolean; total: number; lines: BankLine[] };
  /** Q1: "From the {name}" — last season's lines after its last match (its final 60 days when none); null once this
   *  season has a match before D, or when no cash was carried in. */
  lastSeason: { name: string; after: string; sinceMatch: boolean; total: number; lines: BankLine[] } | null;
  /** Ask 2: the latest earlier check's items (last season's final check's, before this season's first), asked once. */
  stillWaiting: WaitingItem[];
  /** The live check of this date a save would replace ("Check this statement again"). */
  replaces: string | null;
}

/**
 * The figure for D, and what a save on D stands on, from the server's read: `rows` and `lines` are the working season's
 * register (all of it, read once), `checks` its live checks (`checksInSeason`), `last` last season when the opening cash
 * came from it and this season has no match before D (`needsLastSeason`), else null.
 */
export function coachFigureOn(i: {
  date: string; today: string; seasonStart: string; openingCents: number;
  rows: readonly CoachRow[]; lines: readonly BankLine[]; checks: readonly TeamSavedCheck[]; last: LastSeason | null;
}): { figure: CoachFigureForDate; facts: CoachSaveFacts | null } {
  const refused = coachSaveRefusal({ date: i.date, today: i.today, seasonStart: i.seasonStart });
  const replaces = i.checks.find(c => c.date === i.date)?.id ?? null;
  if (refused) {
    return {
      figure: { date: i.date, refused, seasonStart: i.seasonStart, booksCents: null,
        suspects: { since: i.seasonStart, sinceMatch: false, total: 0, lines: [] }, lastSeason: null, stillWaiting: [], replaces },
      facts: null,
    };
  }
  const booksCents = coachBooksOnDate(i.rows, i.openingCents, i.date);
  const find = coachFind({ date: i.date, start: i.seasonStart, lines: i.lines, checks: i.checks, last: i.last });
  const stillWaiting = coachStillWaiting({ date: i.date, checks: i.checks, last: i.last });
  const markable = coachMarkable({ date: i.date, lines: i.lines, find, stillWaiting, last: i.last });
  return {
    figure: {
      date: i.date, refused, seasonStart: i.seasonStart, booksCents,
      suspects: { since: find.since, sinceMatch: find.sinceMatch, total: find.lines.length, lines: find.lines.slice(0, COACH_SUSPECT_CAP) },
      lastSeason: find.lastSeason
        ? { ...find.lastSeason, total: find.lastSeason.lines.length, lines: find.lastSeason.lines.slice(0, COACH_SUSPECT_CAP) }
        : null,
      stillWaiting, replaces,
    },
    facts: { today: i.today, seasonStart: i.seasonStart, booksCents, markable },
  };
}
