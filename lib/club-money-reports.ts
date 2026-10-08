/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S MONEY REPORTS — THEIR SENTENCES AND THEIR FILES (Club Tier Stage 3b, session 2).
 *
 * The club's Budget vs. Actual renders the coach's own Statement rows and month grid (promoted, never
 * copied). What is the club's own is what those components cannot know: the sentences under them, in the
 * club's words (a YEAR opening on what its books held, the other books, no families), and the file a board
 * downloads. Both follow the coach's rules exactly:
 *   · ONE AUTHOR PER SENTENCE (owner ruling 2026-09-05). The screen renders these notes and the Excel and
 *     PDF files carry the same array — the coach's `ReportNote`, read by the same `ReportNotes` and the same
 *     download. A clause that names a gesture is `screenOnly` and never reaches a file.
 *   · THE VARIANCE KEY IS THE COACH'S, VERBATIM — taken from the coach's own note builder, never retyped.
 *   · NEVER FORMATS ARITHMETIC IT DIDN'T RECEIVE: every figure arrives pre-formatted or as the report's own.
 *   · THE FILE IS THE SHAPE ON SCREEN: the Months file reads the grid's own lens helpers (`lensCell`,
 *     `lensTotal`, `lensUndated`, `hasUndated`, `categoryHasFigure`, `bandTotalLabel`) and the club's own
 *     balance (already worked out over every book) and other-books row — so it cannot disagree with the grid.
 *
 * ⚠ DRAFTS FOR /marketing, like every club sentence (lib/club-money-words.ts).
 * Pure and client-safe: no IO, no React, no Date.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  bandTotalLabel, categoryHasFigure, formatMonthLabel, hasUndated, lensCell, lensTotal, lensUndated,
  type CashFlowResult, type MonthGrid, type MoneyLens, type MoneyRowDirection,
} from './coach-budget-months';
import { statementNotes, type NoteSegment, type ReportNote } from './coach-money-report-notes';
import { planColumnLabel, type CompareBasis } from './coach-budget-basis';
import { PLAN_LADDER_LABEL } from './coach-budget-totals';
import type { ExportColumnDef } from './export';
import type { ExportRow, MoneyRowKind } from './coach-money-exports';
import type { ClubMonthsFeed } from './club-budget-report';
import type { AgainstLastYear, YearEndReport } from './club-year-compare';
import { AGAINST_LAST_YEAR_WORDS, OTHER_BOOKS_WORD, YEAR_END_NO_TEAM_CASH, YEAR_END_WORDS, netForYearWord } from './club-money-words';
import { fmt as paperMoney } from './coach-money-summary';
import { formatStoredDate } from './timezone';
import { sumMoney } from './club-money-figures';

const note = (id: string, segments: NoteSegment[]): ReportNote => ({ id, tone: 'note', segments });

/** The club's Compare words: "Whole year" where the coach's says "Whole season". */
export const CLUB_COMPARE_BASES: { id: CompareBasis; label: string }[] = [
  { id: 'season', label: 'Whole year' },
  { id: 'todate', label: 'To date' },
];
export const clubNetRowLabel = (basis: CompareBasis, year: string) => (basis === 'todate' ? 'Net to date' : netForYearWord(year));

// ── The Statement's notes ──────────────────────────────────────────────────────────────────────

export interface ClubStatementNoteInput {
  basis: CompareBasis;
  /** Revenue's shortfall against the plan, pre-formatted — null when revenue is on or above plan. */
  revenueUnder: string | null;
  /** Of that, what the teams still owe on the year's allocations, pre-formatted — null when nothing is owed. */
  owedByTheTeams: string | null;
  /** Lines waiting to post on the Club books (the report's `pending`), pre-formatted. */
  pending: { count: number; moneyOut: string | null; moneyIn: string | null } | null;
  /** Is there a "Not filed" row on the statement? */
  notFiled: boolean;
}

export function clubStatementNotes(input: ClubStatementNoteInput): ReportNote[] {
  const out: ReportNote[] = [];
  // The coach's variance key, verbatim — one author (lib/coach-money-report-notes.ts).
  const key = statementNotes({ basis: input.basis, dues: null, canWriteDues: false, duesNonCash: false, duesPlanWrittenOff: null, undatedPlan: null })
    .find(n => n.id === 'variance-key');
  if (key) out.push(key);

  /* What a reader's eye goes to first on a club in mid-year: revenue under plan, and how much of that is
     simply the teams' installments not due or not paid yet (hub specimen 2's own sentence). */
  const segments: NoteSegment[] = [{ text: 'A figure opens what is behind it. ', screenOnly: true }];
  if (input.revenueUnder) {
    segments.push({ text: 'Revenue is ' }, { text: input.revenueUnder, bold: true }, { text: ' under plan so far' });
    if (input.owedByTheTeams) segments.push({ text: ', and ' }, { text: input.owedByTheTeams, bold: true }, { text: ' of that is what the teams still owe' });
    segments.push({ text: '. ' });
  }
  if (input.basis === 'season') {
    segments.push(
      { text: 'Both columns compare the whole year’s plan against what has moved so far; ' },
      { text: 'Compare › To date', control: 'compare-to-date', screenOnly: true },
      { text: ' measures against the plan’s dates so far.', screenOnly: true },
    );
  } else {
    segments.push({ text: 'Plan to date counts only the plan’s dates up to today; money with no date isn’t compared.' });
  }
  out.push(note('club-behind', segments));

  if (input.pending && input.pending.count > 0) {
    const what = input.pending.count === 1
      ? (input.pending.moneyOut ? `One ${input.pending.moneyOut} cheque is` : `One ${input.pending.moneyIn} payment is`)
      : `${input.pending.count} lines${input.pending.moneyOut ? ` (${input.pending.moneyOut} out` : ''}${input.pending.moneyIn ? `${input.pending.moneyOut ? ', ' : ' ('}${input.pending.moneyIn} in` : ''}) are`;
    out.push(note('club-pending', [{ text: what }, { text: ' pending; ' }, { text: input.pending.count === 1 ? 'it counts once it posts.' : 'each counts once it posts.' }]));
  }

  if (input.notFiled) {
    out.push(note('club-not-filed', [
      { text: 'Not filed', bold: true },
      { text: ' is spending with no budget word yet — lines typed before an entry could be filed, until someone files them on the Ledger. It counts as off-plan.' },
    ]));
  }
  return out;
}

// ── The Months notes, by lens ──────────────────────────────────────────────────────────────────

export interface ClubMonthsNoteInput {
  lens: MoneyLens;
  /** The fiscal year's name. */
  year: string;
  /** The opening is the year before's LOCKED closing (Stage 3c, Ask 4): its name and the day it was closed. */
  carriedFrom?: { name: string; closedOn: string } | null;
  /** Pre-formatted: the year's opening (worked out from the books), its first day, today's cash. */
  opening: string;
  firstDay: string;
  cashOnHand: string;
  /** Pending lines' money out, pre-formatted (Cash's "a cheque not yet cleared"). */
  pendingOut: string | null;
  /** Does the other books' row show under this lens? */
  otherBooks: boolean;
  /** "September" when this year's current month closes on Cash on hand (Cash, the current year). */
  thisMonth: string | null;
}

export function clubMonthsNotes(input: ClubMonthsNoteInput): ReportNote[] {
  const out: ReportNote[] = [];
  // ⚖ The opening says where it comes from: the year before's closing, locked (Ask 4 — a DRAFT for /marketing), or
  // what the books held on the first day, which a line dated before it can still move (3b, settled).
  const opening = note('club-opening', input.carriedFrom
    ? [
      { text: 'The year opened with ' }, { text: input.opening, bold: true },
      { text: `, ${input.carriedFrom.name}’s closing, locked when it closed on ${input.carriedFrom.closedOn}.` },
    ]
    : [
      { text: 'The year opened with ' }, { text: input.opening, bold: true },
      { text: `, what the club’s books held on ${input.firstDay}. A line dated before ${input.firstDay} that is added or changed later moves it.` },
    ]);
  switch (input.lens) {
    case 'budget':
      out.push(opening, note('club-basis-budget', [
        { text: 'Budget', bold: true },
        { text: ' is the plan by month: each line by its own dates, From the teams by its installments’ due dates. Money with no date sits under No date yet.' },
      ]));
      break;
    case 'scheduled':
      out.push(note('club-basis-scheduled', [
        { text: 'Scheduled', bold: true },
        { text: ' is what is still to come, from today’s cash (' }, { text: input.cashOnHand, bold: true },
        { text: '): the teams’ installments not yet received, by due date (an overdue one stays in its month), less the lines written and not yet cleared. A request waiting for your answer has no date: it sits under No date yet, counted as possible. The club doesn’t record a bill until it pays it, so a planned cost still to pay shows on Budget, not here.' },
      ]));
      break;
    case 'actual':
      out.push(opening, note('club-basis-cash', [
        { text: 'Cash', bold: true },
        { text: ` is what moved. ${input.pendingOut ? `A line written and not yet cleared (${input.pendingOut}) counts when it posts; ` : ''}a month still ahead shows a dash.` },
      ]));
      break;
    case 'difference':
      out.push(note('club-basis-difference', [
        { text: 'Difference', bold: true },
        { text: ' is the plan against what moved, for the months that have happened. Green is good news on either band.' },
      ]));
      break;
    default:
      break;
  }
  if (input.otherBooks) {
    out.push(note('club-other-books', [
      { text: OTHER_BOOKS_WORD, bold: true },
      { text: ' is what a tournament’s or the house league’s book took in or paid on its own. It is in the balance, which covers every book the club owns, and in none of the rows above it.' },
    ]));
  }
  if (input.lens !== 'difference' && input.lens !== 'spending') {
    out.push(note('club-endpoints', [
      { text: `Every column reads opening + net = closing${input.thisMonth ? `, and ${input.thisMonth}’s closing is the band’s Cash on hand` : ''}.` },
    ]));
  }
  return out;
}

// ── The files ──────────────────────────────────────────────────────────────────────────────────

/** What the Statement's file reads of a section — the server's statement or the screen's To date re-cut alike. */
interface FileFigures { budgeted: number; actual: number; variance: number }
interface FileSection extends FileFigures {
  categories: readonly (FileFigures & { categoryName: string; inPlan: boolean; items: readonly (FileFigures & { itemName: string; inPlan: boolean; plannedIn?: string })[] })[];
}

/** The Statement's file at the basis on screen: the coach's columns, "Plan to date" under To date. */
export function clubStatementFile(
  statement: { revenue: FileSection; expenses: FileSection; net: FileFigures }, basis: CompareBasis, year: string,
): { columns: ExportColumnDef[]; rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const columns: ExportColumnDef[] = [
    { label: 'Category / line item', key: 'item', format: 'text' },
    { label: planColumnLabel(basis), key: 'budgeted', format: 'currency' },
    { label: 'Actual', key: 'actual', format: 'currency' },
    { label: 'Variance', key: 'variance', format: 'currency' },
  ];
  const rows: ExportRow[] = [];
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (r: ExportRow, k?: MoneyRowKind) => { rows.push(r); kinds.push(k); };
  const band = (label: string, s: FileSection, total: string) => {
    push({ item: label.toUpperCase() }, 'section');
    for (const c of s.categories) {
      // An off-plan row's Budgeted is blank in a file — the screen's amber dash means "nothing planned".
      push({ item: c.categoryName, budgeted: c.inPlan ? c.budgeted : '', actual: c.actual, variance: c.variance }, 'category');
      // An earlier year's bills paid this year (Stage 3c): planned in their own year — Budgeted and Variance blank.
      for (const i of c.items) {
        push(i.plannedIn
          ? { item: `  — ${i.itemName}`, budgeted: '', actual: i.actual, variance: '' }
          : { item: `  — ${i.itemName}`, budgeted: i.inPlan ? i.budgeted : '', actual: i.actual, variance: i.variance }, 'item');
      }
    }
    push({ item: total, budgeted: s.budgeted, actual: s.actual, variance: s.variance }, 'total');
  };
  band(PLAN_LADDER_LABEL.revenueBand, statement.revenue, PLAN_LADDER_LABEL.totalRevenue);
  band(PLAN_LADDER_LABEL.expensesBand, statement.expenses, PLAN_LADDER_LABEL.totalExpenses);
  push({ item: clubNetRowLabel(basis, year), budgeted: statement.net.budgeted, actual: statement.net.actual, variance: statement.net.variance }, 'total');
  return { columns, rows, kinds };
}

/** The Months file at the lens on screen — every month, never the window (the coach's rule). */
export function clubMonthsFile(
  feed: ClubMonthsFeed, lens: Exclude<MoneyLens, 'spending'>, balance: CashFlowResult | null,
): { columns: ExportColumnDef[]; rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const { revenueGrid: rev, monthGrid: exp, months, todayMonth } = feed;
  const showUndated = hasUndated([rev, exp], lens);
  const columns: ExportColumnDef[] = [{ label: 'Category / line', key: 'item', format: 'text' }];
  if (showUndated) columns.push({ label: 'No date yet', key: 'undated', format: 'currency' });
  for (const m of months) columns.push({ label: formatMonthLabel(m), key: `m_${m}`, format: 'currency', headerMonth: m });
  columns.push({ label: 'Total', key: 'total', format: 'currency' });

  const rows: ExportRow[] = [];
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (r: ExportRow, k?: MoneyRowKind) => { rows.push(r); kinds.push(k); };
  const moneyRow = (item: string, cells: MonthGrid['totals']['cells'], total: MonthGrid['totals']['total'], undated: MonthGrid['totals']['undated'], band: MoneyRowDirection): ExportRow => {
    const row: ExportRow = { item };
    if (showUndated) row.undated = lensUndated(undated, lens) || '';
    months.forEach((m, i) => { row[`m_${m}`] = lensCell(cells[i], lens, m, todayMonth, band) ?? ''; });
    row.total = lensTotal(total, lens, band);
    return row;
  };
  const band = (grid: MonthGrid, dir: MoneyRowDirection) => {
    push({ item: dir === 'in' ? 'REVENUE' : 'EXPENSES' }, 'section');
    const cats = dir === 'in' ? grid.categories.filter(c => categoryHasFigure(c.total, lens)) : grid.categories;
    for (const c of cats) {
      push(moneyRow(c.categoryName, c.cells, c.total, c.undated, dir), 'category');
      for (const l of c.lines) push(moneyRow(`  — ${l.description}`, l.cells, l.total, l.undated, dir), 'item');
    }
    push(moneyRow(bandTotalLabel(dir, lens), grid.totals.cells, grid.totals.total, grid.totals.undated, dir), 'total');
  };
  band(rev, 'in');
  band(exp, 'out');
  if (balance) {
    const other = lens === 'difference' ? null : feed.otherBooks[lens];
    if (other && other.some(m => Math.abs(m.net) > 0.005)) {
      const r: ExportRow = { item: OTHER_BOOKS_WORD };
      if (showUndated) r.undated = '';
      for (const m of other) r[`m_${m.month}`] = m.net || '';
      r.total = sumMoney(other.map(m => ({ amount: m.net })));
      push(r, 'plain');
    }
    const open: ExportRow = { item: 'Opening balance' };
    const net: ExportRow = { item: 'Net for the month' };
    const close: ExportRow = { item: 'Closing balance' };
    if (showUndated) { open.undated = ''; net.undated = balance.undated.net || ''; close.undated = ''; }
    for (const r of balance.rows) {
      open[`m_${r.month}`] = r.opening;
      net[`m_${r.month}`] = r.net;
      close[`m_${r.month}`] = r.running;
    }
    open.total = balance.opening;
    net.total = balance.net;
    close.total = balance.ending;
    push(open, 'total'); push(net, 'total'); push(close, 'total');
  }
  return { columns, rows, kinds };
}

/**
 * Compare › Against last year as a file (Stage 3c, Ask 8c) — the shape on screen: Category / line · this year · last
 * year · Change (this − last, signed), revenue then expenses then the net. The two year columns are headed by the
 * years' names, as the screen's are.
 */
export function clubAgainstLastYearFile(
  compare: AgainstLastYear, thisYear: string,
): { columns: ExportColumnDef[]; rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[] } {
  const columns: ExportColumnDef[] = [
    { label: 'Category / line item', key: 'item', format: 'text' },
    { label: thisYear, key: 'thisYear', format: 'currency' },
    { label: compare.lastYear.name, key: 'lastYear', format: 'currency' },
    { label: AGAINST_LAST_YEAR_WORDS.change, key: 'change', format: 'currency' },
  ];
  const rows: ExportRow[] = [];
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (r: ExportRow, k?: MoneyRowKind) => { rows.push(r); kinds.push(k); };
  const band = (label: string, sec: AgainstLastYear['revenue'], total: string) => {
    push({ item: label.toUpperCase() }, 'section');
    for (const c of sec.categories) {
      push({ item: c.categoryName, thisYear: c.thisYear, lastYear: c.lastYear, change: c.change }, 'category');
      for (const i of c.items) push({ item: `  — ${i.itemName}`, thisYear: i.thisYear, lastYear: i.lastYear, change: i.change }, 'item');
    }
    push({ item: total, thisYear: sec.thisYear, lastYear: sec.lastYear, change: sec.change }, 'total');
  };
  band(PLAN_LADDER_LABEL.revenueBand, compare.revenue, PLAN_LADDER_LABEL.totalRevenue);
  band(PLAN_LADDER_LABEL.expensesBand, compare.expenses, PLAN_LADDER_LABEL.totalExpenses);
  push({ item: 'Net for the year', thisYear: compare.net.thisYear, lastYear: compare.net.lastYear, change: compare.net.change }, 'total');
  return { columns, rows, kinds };
}

// ── The year-end report (Club Tier Stage 3c, specimen 5) ────────────────────────────────────────

/** A variance or a change on paper, signed (a figure is the board report's own money cell, `paperMoney`). */
const paperSigned = (n: number) => (Math.abs(n) <= 0.005 ? '$0.00' : `${n > 0 ? '+' : '−'}${paperMoney(Math.abs(n))}`);

/** A section of a report of several (`MoneyDownload.sections`): its heading, its columns, its rows. */
type ReportSectionFile = { label: string; headers: string[]; rows: (string | number)[][] };

/**
 * THE YEAR-END REPORT AS A FILE, in the drawing's order (hub `#s3c-papers`): the Statement against its budget and
 * against last year is the data table (category by category, as the printed page reads it); then the year at a
 * glance, the club's books at both ends, the teams' standing with the club at the close, and what carried — each a
 * section of its own (a PDF table, an Excel sheet). The one line in place of the teams' cash rides the notes, with
 * the variance key. Read only from locked figures (the server's `YearEndReport`).
 */
export function clubYearEndFile(r: YearEndReport): {
  columns: ExportColumnDef[]; rows: ExportRow[]; kinds: (MoneyRowKind | undefined)[];
  sections: ReportSectionFile[];
  notes: ReportNote[];
} {
  const W = YEAR_END_WORDS;
  const last = r.againstLastYear;
  const columns: ExportColumnDef[] = [
    { label: 'Category', key: 'item', format: 'text' },
    { label: 'Budgeted', key: 'budgeted', format: 'currency' },
    { label: 'Actual', key: 'actual', format: 'currency' },
    { label: 'Variance', key: 'variance', format: 'currency' },
    ...(last ? [{ label: last.lastYear.name, key: 'lastYear', format: 'currency' } as ExportColumnDef] : []),
  ];
  const sameCategory = (a: { categoryId: string | null; categoryName: string }, b: { categoryId: string | null; categoryName: string }) =>
    (a.categoryId ? b.categoryId === a.categoryId : b.categoryName === a.categoryName);
  const lastOf = (dir: 'in' | 'out', c: { categoryId: string | null; categoryName: string }) => {
    const sec = dir === 'in' ? last?.revenue : last?.expenses;
    const hit = sec?.categories.find(x => sameCategory(c, x));
    return hit ? hit.lastYear : last ? 0 : '';
  };
  const rows: ExportRow[] = [];
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (row: ExportRow, k?: MoneyRowKind) => { rows.push(row); kinds.push(k); };
  const band = (label: string, total: string, dir: 'in' | 'out') => {
    const sec = dir === 'in' ? r.statement.revenue : r.statement.expenses;
    const lastSec = dir === 'in' ? last?.revenue : last?.expenses;
    push({ item: label.toUpperCase() }, 'section');
    for (const c of sec.categories) {
      push({ item: c.categoryName, budgeted: c.inPlan ? c.budgeted : '', actual: c.actual, variance: c.variance, lastYear: lastOf(dir, c) }, 'category');
    }
    // A category only LAST year had (nothing planned, nothing spent this year) still gets its row — or the
    // last-year column would not add up to its total.
    for (const x of lastSec?.categories ?? []) {
      if (sec.categories.some(c => sameCategory(c, x))) continue;
      push({ item: x.categoryName, budgeted: '', actual: 0, variance: '', lastYear: x.lastYear }, 'category');
    }
    push({ item: total, budgeted: sec.budgeted, actual: sec.actual, variance: sec.variance, lastYear: lastSec ? lastSec.lastYear : '' }, 'total');
  };
  band(PLAN_LADDER_LABEL.revenueBand, PLAN_LADDER_LABEL.totalRevenue, 'in');
  band(PLAN_LADDER_LABEL.expensesBand, PLAN_LADDER_LABEL.totalExpenses, 'out');
  push({ item: 'Net for the year', budgeted: r.statement.net.budgeted, actual: r.statement.net.actual, variance: r.statement.net.variance, lastYear: last ? last.net.lastYear : '' }, 'total');

  const span = { first: formatStoredDate(r.year.firstDay, { withYear: true }), last: formatStoredDate(r.year.lastDay, { withYear: true }) };
  const sections: ReportSectionFile[] = [
    {
      label: W.atAGlance,
      headers: [W.openingOn(r.year.firstDay), 'Revenue', 'Expenses', 'Net for the year', W.closingOn(r.year.lastDay)],
      rows: [[paperMoney(r.atAGlance.opening), paperMoney(r.atAGlance.revenue), paperMoney(r.atAGlance.expenses), paperSigned(r.atAGlance.net), paperMoney(r.atAGlance.closing)]],
    },
    {
      label: W.books,
      headers: ['Book', span.first, span.last],
      rows: [
        ...r.books.map(b => [b.name, paperMoney(b.atStart), paperMoney(b.atEnd)]),
        [W.booksTotal, paperMoney(r.booksTotal.atStart), paperMoney(r.booksTotal.atEnd)],
      ],
    },
    {
      label: W.teams,
      headers: ['Team', 'Billed', 'Collected', 'Still owed'],
      rows: [
        ...r.teams.map(t => [t.teamName, paperMoney(t.billed), paperMoney(t.collected), paperMoney(t.owed)]),
        [`${r.teams.length} ${r.teams.length === 1 ? 'team' : 'teams'}`, paperMoney(r.teamsTotal.billed), paperMoney(r.teamsTotal.collected), paperMoney(r.teamsTotal.owed)],
      ],
    },
  ];
  const o = r.carried.stillOpen;
  const carried: (string | number)[][] = [];
  if (o.installments.count > 0) carried.push([W.carriedInstallments(o.installments.count, (o.installmentTeams ?? []).join(', ')), paperMoney(o.installments.amount)]);
  if (o.requests.count > 0) carried.push([W.carriedRequests(o.requests.count, (o.requestTeams ?? []).join(', ')), paperMoney(o.requests.amount)]);
  if (o.pending.count > 0) carried.push([W.carriedPending(o.pending.count, (o.pendingPayees ?? []).join(', ')), paperMoney(o.pending.amount)]);
  sections.push({ label: W.carried(r.carried.nextYear.name), headers: ['', 'Amount'], rows: carried.length ? carried : [[W.nothingCarried, '']] });

  const note = (id: string, text: string): ReportNote => ({ id, tone: 'note', segments: [{ text }] });
  return { columns, rows, kinds, sections, notes: [note('year-end-variance', W.varianceKey), note('year-end-team-cash', YEAR_END_NO_TEAM_CASH)] };
}
