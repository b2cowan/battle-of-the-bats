/**
 * WHICH HOSTED-EVENT SHELVES THE CLUB'S FILING PICKER SHOWS (hosted-event filing shelf, owner 2026-10-21;
 * plan: docs/projects/active/HOSTED_EVENT_FILING_SHELF_PLAN.md).
 *
 * Every hosted tournament owns a shelf of words (mig 342 + 344). A club that hosts five of them would otherwise see
 * five shelves of the same nine words in every entry window. This is the one place that decides which ones show, and
 * how, so the Add and Edit windows can never disagree:
 *
 *   • IN A TOURNAMENT'S OWN BOOK  — that event's shelf leads. Every other event's shelf is hidden, and for money in
 *     the generic Tournaments shelf is hidden too (its Gate / Concession / Registration words are the event's own
 *     now). It STAYS for money out: that shelf is also where the club files fees it pays to enter OTHER tournaments.
 *   • IN ANY OTHER CLUB BOOK      — the shelves of events in the fiscal year the entry is DATED in are folded to one
 *     heading each; an event outside that year is present only while someone types.
 *
 * ⚠ THE ANSWER IS SHELF STATES, NEVER A SHORTER LIST. The picker keeps the whole list (its own inline-created words
 * live in it) and applies the states; a saved entry's own word is always shown by the picker whatever its shelf's
 * state, so an ordinary edit can never silently strip the word off the line.
 * ⚠ NOTHING HERE FILTERS WORDS, ONLY SHELVES: a shelf's words are unchanged, so By activity (which groups by shelf)
 * is unaffected by what this hides.
 * ⚠ NO EVENT DATES, NO FISCAL SETTING, OR NO DATE YET: every event counts as in-year. A shelf shown folded is the safe
 * error; one wrongly hidden is a word the treasurer cannot find.
 */
import type { BudgetCategoryWithItems, PickerShelves } from './types';
import type { LedgerKind } from './club-ledger';
import { fiscalYearOf, isAddressableDay, type FiscalSetting } from './club-fiscal-year';

/** The heading note on the lead shelf — the picker's `shelves.leadNote`. */
export const LEAD_SHELF_NOTE = 'this tournament';

/** The standard Tournaments shelf: the platform's own, not a club's or an event's. */
export function isGenericTournamentsShelf(c: Pick<BudgetCategoryWithItems, 'orgId' | 'isDefault' | 'name'>): boolean {
  return c.orgId == null && c.isDefault && c.name.trim().toLowerCase() === 'tournaments';
}

/** Is a hosted event inside the fiscal year? An event with no dates, or no year to compare, counts as inside. */
export function eventInYear(
  event: { startDate: string | null; endDate: string | null },
  year: { firstDay: string; lastDay: string } | null,
): boolean {
  if (!year) return true;
  const days = [event.startDate, event.endDate].filter((d): d is string => !!d);
  if (days.length === 0) return true;
  return days.some(d => d >= year.firstDay && d <= year.lastDay);
}

/** The picker's `shelves` for this entry — undefined when the club has no hosted event, so nothing changes. */
export function eventShelves(input: {
  categories: readonly BudgetCategoryWithItems[];
  /** The book the window was opened from: a tournament's own book carries kind `tournament` and the tournament's id. */
  book: { kind: LedgerKind; entityId?: string | null };
  /** The entry's date (yyyy-mm-dd) — the fiscal year it falls in decides which events are "this year's". */
  day: string;
  fiscal: FiscalSetting | null;
  direction: 'in' | 'out';
}): PickerShelves | undefined {
  const { categories, book, day, fiscal, direction } = input;
  const events = categories.filter(c => c.hostedEvent);
  if (events.length === 0) return undefined;

  const own = book.kind === 'tournament' && book.entityId
    ? events.find(c => c.hostedEvent!.tournamentId === book.entityId)
    : undefined;
  if (own) {
    const hidden = new Set(events.filter(c => c !== own).map(c => c.id));
    if (direction === 'in') for (const c of categories) if (isGenericTournamentsShelf(c)) hidden.add(c.id);
    return { lead: own.id, leadNote: LEAD_SHELF_NOTE, hidden };
  }

  const year = fiscal && isAddressableDay(day) ? fiscalYearOf(day, fiscal) : null;
  const folded = new Set<string>();
  const searchOnly = new Set<string>();
  for (const c of events) (eventInYear(c.hostedEvent!, year) ? folded : searchOnly).add(c.id);
  return { folded, searchOnly };
}
