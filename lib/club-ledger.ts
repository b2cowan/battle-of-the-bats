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
} from './club-money-words';
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
