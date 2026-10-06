/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S BOOK, LINE BY LINE (Club Tier Stage 3a — C12, C13, C14, J4-016, Ask 6's reads).
 *
 * How a ledger line is CLASSIFIED and WORDED, pure and client-safe, so the Ledger tab, its line
 * window and its export read one answer. The balances are lib/club-money-figures.ts's.
 *
 * ⚖ A LINE NAMES THE TEAM (J4-016). Lines the loop writes from 3a on carry the drawn words
 * ("Allocation received · 11U AA · Diamond fees, 2 of 3"). Older lines carry "Rep allocation
 * payment — installment #2": where a line has a source link, its words are DERIVED from the source
 * at read time; stored history is never rewritten.
 *
 * ⚖ WHAT CAN BE CHANGED ON THE LEDGER (C12):
 *   · a hand-typed line on a club book — edited, or voided with a reason;
 *   · a transfer between the club's OWN books — voided, both halves, with a reason (C13);
 *   · a line written by an allocation, a request or a house-league fee — nothing here. It is changed
 *     where it came from (the allocation's Undo, the request's Reverse).
 *   · anything on a team's book — nothing. A team's book is the coaches'.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  CLUB_LOOP_CATEGORY, LOOP_CATEGORY_KEYS, TEAM_ALLOCATIONS_WORD, TEAM_SUPPORT_WORD, categoryWord,
  FROM_THE_TEAMS_WORD, ON_REQUEST_WORD, NOT_FILED_WORD, TEAM_SUPPORT_ITEM_WORD,
} from './club-money-words';
import { isClubOwnedBook, isMoneyIn } from './club-money-figures';
import { toCents } from './coach-register';
import type { AccountingEntityType } from './types';

export type LedgerKind = AccountingEntityType;

/** The badge knows four kinds (C14: today it knows two and calls a team book "Tournament"). */
export const LEDGER_KIND_WORD: Record<LedgerKind, string> = {
  org: 'Club',
  tournament: 'Tournament',
  team: 'Team',
  league_season: 'House league',
};

export type LineType = 'expense' | 'income' | 'team_allocations' | 'team_support' | 'transfer' | 'house_league_fees';

/** A line's status on the book. Void is off the book until a Status filter asks for it. */
export type LineStatus = 'posted' | 'pending' | 'void';

export const LINE_TYPE_WORD: Record<LineType, string> = {
  expense: 'Expenses',
  income: 'Income',
  team_allocations: TEAM_ALLOCATIONS_WORD,
  team_support: TEAM_SUPPORT_WORD,
  transfer: 'Transfers',
  house_league_fees: 'House league fees',
};

/** Where a line came from (`accounting_entries.source_module`). The loop's two from mig 315 on. */
export const SOURCE_MODULE = {
  installment: 'rep_allocation_installment',
  request: 'rep_payment_request',
  leagueFee: 'league_registration',
} as const;

export interface LineFacts {
  entryType: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  category: string | null;
  sourceModule: string | null;
}

export const isTransfer = (l: Pick<LineFacts, 'entryType'>) => l.entryType === 'transfer_in' || l.entryType === 'transfer_out';

/** Which Type a line belongs to (the Type filter, and the line's door). By source, else by the loop's key. */
export function lineType(l: LineFacts): LineType {
  if (l.sourceModule === SOURCE_MODULE.installment || l.category === CLUB_LOOP_CATEGORY.allocation) return 'team_allocations';
  if (l.sourceModule === SOURCE_MODULE.request || l.category === CLUB_LOOP_CATEGORY.toClub || l.category === CLUB_LOOP_CATEGORY.fromClub) {
    return 'team_support';
  }
  if (l.sourceModule === SOURCE_MODULE.leagueFee) return 'house_league_fees';
  if (isTransfer(l)) return 'transfer';
  return l.entryType === 'income' ? 'income' : 'expense';
}

/**
 * Was this line written by an allocation, a request or a house-league fee? Such a line is read on the
 * ledger and changed only where it came from. `referenced` = an installment or a request names this
 * line (or its partner) as its ledger link — the catch for a pre-3a line with no `source_module`.
 */
export function isSourcedLine(l: LineFacts, referenced = false): boolean {
  if (l.sourceModule) return true;
  if (l.category && LOOP_CATEGORY_KEYS.includes(l.category)) return true;
  return referenced;
}

/** The line's category, in words (a loop key reads as the club's word; a typed one as typed). */
export const lineCategoryWord = (l: Pick<LineFacts, 'category'>) => categoryWord(l.category);

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚖ WHAT A CLUB LINE IS FILED UNDER — THE ONE RULE (Club Tier Stage 3b, Ask 4a; mig 317).
 * Budget vs. Actual counts a line under its filing, the Ledger shows and filters by it, the line window
 * prints it. One function, so the three can never file one line two ways.
 *   · the money loop's own lines file themselves by their SOURCE, never by a word: an allocation
 *     received → "From the teams" (under its allocation); money received on a To-club request → "From
 *     the teams › On request"; a request paid to a team → the standard club-only word "Team support ›
 *     Paid to teams on request" (mig 317's fixed ids);
 *   · a typed line files under its word (category AND item — a word is both), else "Not filed";
 *   · a transfer between two books the club owns, and a house-league fee, are filed nowhere (null) — the
 *     first moves nothing in total, the second waits for Stage 9; a transfer to a TEAM's book made by
 *     hand before 3a refused them is money out with no word: "Not filed".
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/** The standard word a request paid to a team files under (mig 317's fixed ids). Never change them. */
export const TEAM_SUPPORT_WORD_IDS = {
  categoryId: '3b5e7a00-0317-4c1b-8a50-7ea0507c0001',
  itemId: '3b5e7a00-0317-4c1b-8a50-7ea0507c0002',
} as const;

/** Synthetic category / item ids for the rows nobody types. Never a database id (not uuid-shaped). */
export const FROM_THE_TEAMS_ID = 'club:from-the-teams';
export const ON_REQUEST_ID = 'club:on-request';
export const NOT_FILED_ID = 'club:not-filed';

export interface Filing {
  categoryId: string;
  categoryName: string;
  itemId: string | null;
  itemName: string | null;
  /** True for a loop line: it files itself and its word is read-only. */
  byItsSource: boolean;
}

export const FROM_THE_TEAMS = { categoryId: FROM_THE_TEAMS_ID, categoryName: FROM_THE_TEAMS_WORD } as const;
export const ON_REQUEST_FILING: Filing = { ...FROM_THE_TEAMS, itemId: ON_REQUEST_ID, itemName: ON_REQUEST_WORD, byItsSource: true };
export const TEAM_SUPPORT_FILING: Filing = {
  categoryId: TEAM_SUPPORT_WORD_IDS.categoryId, categoryName: TEAM_SUPPORT_WORD,
  itemId: TEAM_SUPPORT_WORD_IDS.itemId, itemName: TEAM_SUPPORT_ITEM_WORD, byItsSource: true,
};
export const NOT_FILED_FILING: Filing = { categoryId: NOT_FILED_ID, categoryName: NOT_FILED_WORD, itemId: null, itemName: NOT_FILED_WORD, byItsSource: false };
/** "From the teams", under the allocation a received installment belongs to (null: not found — a line
 *  written before 3a whose installment can no longer be traced). */
export const allocationFiling = (allocation: { id: string; description: string } | null): Filing =>
  ({ ...FROM_THE_TEAMS, itemId: allocation?.id ?? null, itemName: allocation?.description ?? null, byItsSource: true });

export interface FilingFacts extends LineFacts {
  budgetCategoryId: string | null;
  budgetCategoryName: string | null;
  budgetItemId: string | null;
  budgetItemName: string | null;
  /** For a transfer: the kind of book its other half sits on (null/absent: not found). */
  partnerKind?: string | null;
}

/** THE filing (see the block above). `allocationOf` names a received installment's allocation, when the
 *  caller can trace it (`findLoopRecord`). */
export function fileLine(l: FilingFacts, allocationOf?: () => { id: string; description: string } | null): Filing | null {
  const type = lineType(l);
  if (type === 'team_allocations') return allocationFiling(allocationOf?.() ?? null);
  if (type === 'team_support') return isMoneyIn(l) ? ON_REQUEST_FILING : TEAM_SUPPORT_FILING;
  if (type === 'house_league_fees') return null;
  if (type === 'transfer') return l.partnerKind && isClubOwnedBook(l.partnerKind) ? null : NOT_FILED_FILING;
  if (l.budgetItemId && l.budgetCategoryId) {
    return {
      categoryId: l.budgetCategoryId, categoryName: l.budgetCategoryName ?? NOT_FILED_WORD,
      itemId: l.budgetItemId, itemName: l.budgetItemName, byItsSource: false,
    };
  }
  return NOT_FILED_FILING;
}

/** The Ledger's Category column and filter (C14): on a club book, the line's filing (a house-league fee
 *  keeps 3a's word); on a TEAM's book, the coaches' own words — those lines are never the club's to file. */
export function ledgerCategory(l: FilingFacts, bookKind: LedgerKind): string | null {
  if (bookKind === 'team' || lineType(l) === 'house_league_fees') return lineCategoryWord(l);
  return fileLine(l)?.categoryName ?? null;
}

/** The facts that trace a loop line back to its installment or request. */
export interface LoopLink { id: string; sourceModule: string | null; sourceEntityId: string | null; linkedEntryId: string | null }

/**
 * The installment or request a loop line belongs to: by its source (3a on), else — a line written before
 * 3a, with no source column — through the payer's half the record names in `accounting_entry_id` (this
 * line, or its partner). One lookup, for the Ledger and for Budget vs. Actual alike.
 */
export function findLoopRecord<T>(
  l: LoopLink, sourceModule: string, byId: ReadonlyMap<string, T>, byEntry: ReadonlyMap<string, T>,
): T | undefined {
  return (l.sourceModule === sourceModule && l.sourceEntityId ? byId.get(l.sourceEntityId) : undefined)
    ?? byEntry.get(l.id)
    ?? (l.linkedEntryId ? byEntry.get(l.linkedEntryId) : undefined);
}

/**
 * The numbers beside the Ledger's Status and Type choices: what ticking that choice would LIST, given the other
 * filters as they are (Filter Counts D5, owner 2026-10-05 — the coach's rule since 2026-08-26, "the count is a
 * promise about the list").
 *
 * ⚠ It used to be a census of the date window: every status and category behind each Type, every type behind each
 * Status. "Expenses (7)" then listed five rows — the other two were voided expenses, counted but hidden — and Status
 * read whole-book numbers while Type was narrowed. Each facet is now counted over the rows the OTHER facets admit,
 * so a voided line counts toward a Type only while Void is shown, and the Void choice's own number is the voided
 * lines that would join the list.
 */
export function ledgerOptionCounts(
  rows: readonly { status: LineStatus; type: LineType; category: string | null }[],
  filters: { status: ReadonlySet<LineStatus>; types: ReadonlySet<LineType> | null; categories: ReadonlySet<string> | null },
): { status: Partial<Record<LineStatus, number>>; type: Partial<Record<LineType, number>> } {
  const status: Partial<Record<LineStatus, number>> = {};
  const type: Partial<Record<LineType, number>> = {};
  for (const r of rows) {
    const inCategory = !filters.categories || (r.category !== null && filters.categories.has(r.category));
    if (!inCategory) continue;
    if (!filters.types || filters.types.has(r.type)) status[r.status] = (status[r.status] ?? 0) + 1;
    if (filters.status.has(r.status)) type[r.type] = (type[r.type] ?? 0) + 1;
  }
  return { status, type };
}

// ── The export (C14: the whole period, signed, voids marked and left out of the totals) ────────

export interface ExportableLine {
  date: string;
  what: string;
  detail: string | null;
  category: string | null;
  type: LineType;
  /** Exactly one of the two is set, as on the book. */
  moneyIn: number | null;
  moneyOut: number | null;
  status: 'posted' | 'pending' | 'void';
  recordedBy: string | null;
  voidReason: string | null;
}

export const LEDGER_EXPORT_COLUMNS = [
  { label: 'Date', key: 'date', format: 'date' as const },
  { label: 'What', key: 'what', format: 'text' as const },
  { label: 'Detail', key: 'detail', format: 'text' as const },
  { label: 'Type', key: 'type', format: 'text' as const },
  { label: 'Category', key: 'category', format: 'text' as const },
  { label: 'Amount', key: 'amount', format: 'currency' as const },
  { label: 'Status', key: 'status', format: 'text' as const },
  { label: 'Recorded by', key: 'recordedBy', format: 'text' as const },
];

/**
 * One row per line, oldest first: ONE signed Amount column (+ in, − out). A void line is kept and
 * marked VOID (with its reason); a pending one is marked PENDING. Neither moves the totals — the same
 * rule the book's Balance follows, so the file and the screen agree.
 */
export function ledgerExportRows(lines: readonly ExportableLine[]): {
  rows: Record<string, string | number>[];
  totals: { moneyIn: number; moneyOut: number; net: number };
} {
  let inC = 0, outC = 0;
  const rows = lines.map(l => {
    const signed = l.moneyIn ?? -(l.moneyOut ?? 0);
    if (l.status === 'posted') {
      inC += toCents(l.moneyIn);
      outC += toCents(l.moneyOut);
    }
    return {
      date: l.date,
      what: l.what,
      detail: l.status === 'void' && l.voidReason ? [l.detail, `Void: ${l.voidReason}`].filter(Boolean).join(' · ') : l.detail ?? '',
      type: LINE_TYPE_WORD[l.type],
      category: l.category ?? '',
      amount: signed,
      status: l.status === 'void' ? 'VOID' : l.status === 'pending' ? 'PENDING' : 'Posted',
      recordedBy: l.recordedBy ?? '',
    };
  });
  return { rows, totals: { moneyIn: inC / 100, moneyOut: outC / 100, net: (inC - outC) / 100 } };
}
