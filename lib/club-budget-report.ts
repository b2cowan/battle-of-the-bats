/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S YEAR, ASSEMBLED — the Budget, Budget vs. Actual (Statement + Months) and the board
 * summary, from rows (Club Tier Stage 3b; owner rulings 2026-10-06, Asks 1–5; hub → Mockups →
 * Stage 3b).
 *
 * ⚖ THIS MODULE DECIDES WHICH ROWS FEED WHICH FIGURE, AND NEVER WHAT A FIGURE MEANS. Every figure is
 * one function in lib/club-money-figures.ts, with the hub's sentence as its comment; what a line is
 * FILED under is one function in lib/club-ledger.ts (`fileLine`, shared with the Ledger). This file asks
 * those and the coach's own builders:
 *   · the Statement is the coach's `rollupMoneyReport` (one row per budget WORD, inPlan derived,
 *     variance good-news-positive) fed the club's plan and the club's books;
 *   · Months is the coach's `buildMonthGrid` and `buildCashFlow`, fed the club's figures, never a
 *     second grid (Ask 5) — the coach's `MonthGridPayload`, plus the club's one addition: the other
 *     books' row, and the balance rows already worked out over every book;
 *   · To date is the coach's `budgetedOn`.
 *
 * ⚖ THE MONEY LOOP'S OWN LINES ARE NEVER MATCHED BY A WORD (Ask 4a). An allocation received, money
 * received on request and a request paid to a team are SOURCED lines (3a): they file themselves by
 * where they came from and are counted ONCE, as the ledger lines they are, so Spent and the band's
 * Collected are exactly "every posted line on the Club books" (the hub's definitions) and the Cash
 * grid's closing ties to Cash on hand by construction. Each still names the allocation or request
 * behind it (`lineSources`), so a figure opens what it adds up.
 *
 * Pure and client-safe: no database, no server imports, no Date. Money in cents through the figures.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  rollupMoneyReport, categoryKey, categoryIdOfKey, displayCategoryName,
  type RollupLine, type RollupSpend, type MoneyReport, type ReportSection, type CategoryRow,
} from './coach-budget-rollup';
import {
  addMonths, buildMonthGrid, buildCashFlow, monthKeyOf, UNDATED_CELL,
  type CategoryEvent, type GridLine, type MonthGrid, type MonthKey, type CashFlowResult,
} from './coach-budget-months';
import { budgetedOn } from './coach-budget-basis';
import { PLAN_LADDER_LABEL } from './coach-budget-totals';
import type { CellDetailItem, MonthGridPayload } from '@/components/coaches/MoneyMonthGrid';
import {
  FROM_THE_TEAMS_ID, NOT_FILED_FILING, NOT_FILED_ID, ON_REQUEST_FILING, SOURCE_MODULE, TEAM_SUPPORT_FILING,
  allocationFiling, fileLine, findLoopRecord, lineType, type Filing, type FilingFacts,
} from './club-ledger';
import { CLUB_SENT_WAITING_WORD, HELD_BY_THE_TEAM_WORD, OUTSIDE_YOUR_GROUPS_WORD, TEAMS_CASH_TOTAL_WORD } from './club-money-words';
import { formatStoredDate } from './timezone';
import {
  allocationYear, bandCollected, clubBillFigures, clubCashOnHand, clubMovement, clubYearOf, clubYearSpan,
  closingBalance, countsAsActual, headroom, isClubBook, lineAllocated, netForYear, notAllocated, offPlan,
  otherBooksMovement, owedByTheTeams, planned, spent, sumMoney, teamsCashTotal, waitingOnYou,
  type ClubBookMovementFacts, type ClubInstallmentFacts, type CountAndAmount, type TeamCashHeld,
} from './club-money-figures';

/* The ids the rest of the club reads from here (they live with the filing rule, lib/club-ledger.ts). */
export { FROM_THE_TEAMS_ID, NOT_FILED_ID, ON_REQUEST_ID, TEAM_SUPPORT_WORD_IDS } from './club-ledger';

// ── Inputs (rows, as the server reads them) ───────────────────────────────────────────────────

export interface ClubPlanPeriod { id?: string; label: string; date: string | null; amount: number; sortOrder: number }

export interface ClubPlanLineFacts {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  itemId: string | null;
  itemName: string | null;
  /** The word's side. A line with no word is a cost: every club line written before 3b was one. */
  direction: 'in' | 'out';
  totalAmount: number;
  description: string;
  notes: string | null;
  sortOrder: number;
  updatedAt: string;
  periods: ClubPlanPeriod[];
}

export interface ClubInstallment extends ClubInstallmentFacts {
  id: string;
  installmentNumber: number;
  /** The payer's ledger line the club recorded it with (mig 315) — how an old line finds its source. */
  accountingEntryId?: string | null;
}

export interface ClubAllocationFacts {
  id: string;
  description: string;
  /** The club day it was made. */
  createdOn: string;
  sourceBudgetLineId: string | null;
  /** The year of the line it was drawn from (null for one made without a line). */
  lineYear: number | null;
  splits: { id: string; teamId: string; teamName: string; amount: number; installments: ClubInstallment[] }[];
}

export interface ClubRequestFacts {
  id: string;
  teamId: string;
  teamName: string;
  requestType: 'payment_to_org' | 'charge_to_org';
  status: string;
  amount: number;
  description: string;
  createdOn: string;
  accountingEntryId: string | null;
}

/** A line on a book the club owns (never a team's), as the year's report reads it. */
export interface ClubBookLineFacts extends ClubBookMovementFacts, FilingFacts {
  id: string;
  ledgerId: string;
  bookKind: string;
  bookName: string;
  entryDate: string;
  description: string;
  sourceEntityId: string | null;
  linkedEntryId: string | null;
}

export interface ClubBook { id: string; kind: string; name: string; balance: number }

// ── Filing a Club-book line, and the loop record behind it ────────────────────────────────────

export type LineSource =
  | { kind: 'allocation'; allocationId: string; installmentId: string; teamName: string }
  | { kind: 'request'; requestId: string; teamName: string };

interface InstallmentRef { allocationId: string; allocationDescription: string; installmentId: string; teamName: string }

export interface LoopIndex {
  installmentById: Map<string, InstallmentRef>;
  installmentByEntry: Map<string, InstallmentRef>;
  requestById: Map<string, ClubRequestFacts>;
  requestByEntry: Map<string, ClubRequestFacts>;
}

export function loopIndex(allocations: readonly ClubAllocationFacts[], requests: readonly ClubRequestFacts[]): LoopIndex {
  const installmentById = new Map<string, InstallmentRef>();
  const installmentByEntry = new Map<string, InstallmentRef>();
  for (const a of allocations) {
    for (const s of a.splits) {
      for (const i of s.installments) {
        const ref = { allocationId: a.id, allocationDescription: a.description, installmentId: i.id, teamName: s.teamName };
        installmentById.set(i.id, ref);
        if (i.accountingEntryId) installmentByEntry.set(i.accountingEntryId, ref);
      }
    }
  }
  const requestById = new Map(requests.map(r => [r.id, r] as const));
  const requestByEntry = new Map(requests.filter(r => r.accountingEntryId).map(r => [r.accountingEntryId!, r] as const));
  return { installmentById, installmentByEntry, requestById, requestByEntry };
}

/** A Club-book line's filing (the one rule, `fileLine`) and, for a loop line, the record behind it. */
export function fileClubLine(l: ClubBookLineFacts, loop: LoopIndex): { filing: Filing; source: LineSource | null } {
  const type = lineType(l);
  const inst = type === 'team_allocations' ? findLoopRecord(l, SOURCE_MODULE.installment, loop.installmentById, loop.installmentByEntry) : undefined;
  const req = type === 'team_support' ? findLoopRecord(l, SOURCE_MODULE.request, loop.requestById, loop.requestByEntry) : undefined;
  const filing = fileLine(l, () => inst ? { id: inst.allocationId, description: inst.allocationDescription } : null) ?? NOT_FILED_FILING;
  const source: LineSource | null = inst
    ? { kind: 'allocation', allocationId: inst.allocationId, installmentId: inst.installmentId, teamName: inst.teamName }
    : req ? { kind: 'request', requestId: req.id, teamName: req.teamName } : null;
  return { filing, source };
}

// ── Order and keys: the plan's own order, never the order money arrived in ────────────────────

/** From the teams first, then the library's order (sort, then name), "Not filed" last — the coach's revenue
 *  rule (2026-09-09), one rank for the Budget, the Statement and Months. */
function categoryRank(id: string | null, name: string, order: Readonly<Record<string, number>>): [number, number, string] {
  if (id === FROM_THE_TEAMS_ID) return [0, 0, ''];
  if (id === NOT_FILED_ID) return [2, 0, ''];
  return [1, id != null ? order[id] ?? 999 : 999, name];
}
function sortByPlanOrder<T>(xs: readonly T[], idOf: (x: T) => string | null, nameOf: (x: T) => string, order: Readonly<Record<string, number>>): T[] {
  return [...xs].sort((a, b) => {
    const ra = categoryRank(idOf(a), nameOf(a), order), rb = categoryRank(idOf(b), nameOf(b), order);
    return (ra[0] - rb[0]) || (ra[1] - rb[1]) || ra[2].localeCompare(rb[2]);
  });
}

/** A grid row's key — `buildMonthGrid`'s own shape (`<categoryKey>|<itemId>`): the row, its money and the
 *  records behind a cell must key identically or a panel goes silently empty. */
function rowKey(f: { categoryId?: string | null; categoryName?: string | null; itemId?: string | null }): string {
  return `${categoryKey(f.categoryId ?? null, f.categoryName ?? null)}|${f.itemId ?? 'no-item'}`;
}

/** The fields of a filing a grid event carries. */
const eventOf = (f: Filing) => ({ categoryId: f.categoryId, categoryName: f.categoryName, itemId: f.itemId });

// ── The year's allocations ────────────────────────────────────────────────────────────────────

function firstDue(a: ClubAllocationFacts): string | null {
  let d: string | null = null;
  for (const s of a.splits) for (const i of s.installments) if (!d || i.dueDate < d) d = i.dueDate;
  return d;
}

/** The year rule applied: does this allocation belong to `year`? */
export function allocationInYear(a: ClubAllocationFacts, year: number): boolean {
  return allocationYear({ lineYear: a.lineYear, firstDueDate: firstDue(a), createdOn: a.createdOn }) === year;
}

const installmentsOf = (a: ClubAllocationFacts) => a.splits.flatMap(s => s.installments);
const installmentWord = (n: number) => `Installment ${n}`;

/**
 * The allocations drawn from the year's COST lines. Only a cost line bills teams (`club_allocation_create`
 * refuses a money-in line), and reading From the teams off a cost line ONLY is what keeps a line re-filed
 * under a money-in word from counting the same money twice (once as its own revenue, again as From the
 * teams) — the write refuses that re-filing too (`club_budget_line_save`, `allocated_line_is_a_cost`), this is the floor under it.
 */
function drawnFrom(lines: readonly ClubPlanLineFacts[], allocations: readonly ClubAllocationFacts[]): ClubAllocationFacts[] {
  const costIds = new Set(lines.filter(l => l.direction === 'out').map(l => l.id));
  return allocations.filter(a => a.sourceBudgetLineId != null && costIds.has(a.sourceBudgetLineId));
}

const installmentPeriods = (a: ClubAllocationFacts): ClubPlanPeriod[] =>
  installmentsOf(a).map((i, n) => ({ label: installmentWord(i.installmentNumber), date: i.dueDate, amount: i.amount, sortOrder: n }));

/** "From the teams" as plan: one row per allocation drawn from the year's cost lines, dated by its
 *  installments' due dates. Never stored — read from the allocations (Ask 4b). */
function fromTheTeamsPlanLines(drawn: readonly ClubAllocationFacts[]): RollupLine[] {
  return drawn.map(a => {
    const f = allocationFiling(a);
    return {
      id: `allocation:${a.id}`, ...eventOf(f), itemName: f.itemName, totalAmount: sumMoney(a.splits),
      description: a.description, notes: null, periods: installmentPeriods(a), direction: 'in' as const,
    };
  });
}

function planRollupLines(lines: readonly ClubPlanLineFacts[]): RollupLine[] {
  return lines.map(l => ({
    id: l.id, categoryId: l.categoryId, categoryName: l.categoryName, itemId: l.itemId, itemName: l.itemName,
    totalAmount: l.totalAmount, description: l.description, notes: l.notes,
    periods: l.periods.map(p => ({ label: p.label, date: p.date, amount: p.amount, sortOrder: p.sortOrder })),
    direction: l.direction,
  }));
}

/** The year's months (until 3c sets a year's first month, January to December — `clubYearSpan`). */
function yearMonths(year: number): MonthKey[] {
  const first = monthKeyOf(clubYearSpan(year).first)!;
  return Array.from({ length: 12 }, (_, i) => addMonths(first, i));
}

/**
 * The years the Year pill offers (C10's planning half): every year with a plan line, this year, and
 * ALWAYS the next year — so a plan can start before its year does — and never an empty year two ahead.
 * Newest first.
 */
export function planYears(yearsWithLines: readonly number[], today: string): number[] {
  const thisYear = clubYearOf(today);
  return [...new Set([...yearsWithLines, thisYear, thisYear + 1])].sort((a, b) => b - a);
}

// ══ THE BUDGET (the plan's List and By period) ═════════════════════════════════════════════════

export interface PlanAllocationRow {
  id: string;
  description: string;
  /** The teams billed, in the reader's groups (B11). */
  teamNames: string[];
  /** How many more teams it bills, outside the reader's groups — counted, never named. */
  otherTeams: number;
  allocated: number;
  /** The loop's Collected (3a's, unchanged): received against this allocation, every year. */
  collected: number;
  outstanding: number;
}

export interface PlanLineRow {
  id: string;
  description: string;
  notes: string | null;
  categoryId: string | null;
  categoryName: string | null;
  itemId: string | null;
  itemName: string | null;
  direction: 'in' | 'out';
  sortOrder: number;
  updatedAt: string;
  periods: ClubPlanPeriod[];
  planned: number;
  /** Cost lines only (null on a money-in line: a revenue line bills nobody). */
  allocated: number | null;
  collected: number | null;
  /** The loop's Outstanding over the line's allocations (3a's, unchanged). */
  outstanding: number | null;
  notAllocated: number | null;
  allocations: PlanAllocationRow[];
}

export interface PlanCategory {
  categoryId: string | null;
  categoryName: string;
  direction: 'in' | 'out';
  planned: number;
  allocated: number | null;
  collected: number | null;
  lines: PlanLineRow[];
}

export interface ClubPlan {
  year: number;
  revenue: {
    /** The row nobody types: the Allocated column's total read as income, with its allocations. */
    fromTheTeams: { planned: number; allocations: PlanAllocationRow[]; periods: ClubPlanPeriod[] };
    categories: PlanCategory[];
    total: number;
  };
  expenses: { categories: PlanCategory[]; total: number; allocated: number; collected: number; notAllocated: number };
  openingBalance: number;
  net: number;
  closingBalance: number;
  /** By period: the coach's month grid fed the plan (`budget` cells), the year's twelve months. */
  periodGrid: { months: MonthKey[]; revenue: MonthGrid; expenses: MonthGrid; balance: CashFlowResult };
}

/** The reader's team groups (B11): `null` = every team. The club's figures are the club's whatever the
 *  scope; only a team's NAME (and a request's own words) stay inside the reader's groups, as 3a's reads. */
export type TeamScope = ReadonlySet<string> | null;
const inScope = (scope: TeamScope | undefined, teamId: string) => !scope || scope.has(teamId);

function allocationRow(a: ClubAllocationFacts, today: string, scope: TeamScope | undefined): PlanAllocationRow {
  const f = clubBillFigures(installmentsOf(a), today);
  const seen = a.splits.filter(s => inScope(scope, s.teamId));
  return {
    id: a.id, description: a.description, teamNames: seen.map(s => s.teamName), otherTeams: a.splits.length - seen.length,
    allocated: sumMoney(a.splits), collected: f.collected, outstanding: f.outstanding,
  };
}

export function buildClubPlan(input: {
  year: number;
  today: string;
  lines: readonly ClubPlanLineFacts[];
  /** Every allocation the club has made (those drawn from the year's cost lines are read). */
  allocations: readonly ClubAllocationFacts[];
  categoryOrder: Readonly<Record<string, number>>;
  openingBalance: number;
  scope?: TeamScope;
}): ClubPlan {
  const { year, today, lines, allocations, categoryOrder } = input;
  const drawn = drawnFrom(lines, allocations);
  const rowOf = new Map(drawn.map(a => [a.id, allocationRow(a, today, input.scope)] as const));
  const drawnBy = new Map<string, ClubAllocationFacts[]>();
  for (const a of drawn) drawnBy.set(a.sourceBudgetLineId!, [...(drawnBy.get(a.sourceBudgetLineId!) ?? []), a]);

  const lineRow = (l: ClubPlanLineFacts): PlanLineRow => {
    const isCost = l.direction === 'out';
    const mine = drawnBy.get(l.id) ?? [];
    const allocated = isCost ? lineAllocated(l.id, mine) : null;
    const billed = isCost ? clubBillFigures(mine.flatMap(installmentsOf), today) : null;
    return {
      id: l.id, description: l.description, notes: l.notes,
      categoryId: l.categoryId, categoryName: l.categoryName, itemId: l.itemId, itemName: l.itemName,
      direction: l.direction, sortOrder: l.sortOrder, updatedAt: l.updatedAt, periods: l.periods,
      planned: l.totalAmount,
      allocated, collected: billed?.collected ?? null, outstanding: billed?.outstanding ?? null,
      notAllocated: isCost ? notAllocated(l.totalAmount, allocated ?? 0) : null,
      allocations: mine.map(a => rowOf.get(a.id)!),
    };
  };

  const byCategory = (direction: 'in' | 'out'): PlanCategory[] => {
    const groups = new Map<string, PlanCategory>();
    for (const l of lines.filter(x => x.direction === direction)) {
      const key = categoryKey(l.categoryId, l.categoryName);
      let g = groups.get(key);
      if (!g) {
        g = { categoryId: l.categoryId, categoryName: displayCategoryName(l.categoryName), direction, planned: 0, allocated: null, collected: null, lines: [] };
        groups.set(key, g);
      }
      g.lines.push(lineRow(l));
    }
    for (const g of groups.values()) {
      g.lines.sort((a, b) => a.sortOrder - b.sortOrder || (a.itemName ?? a.description).localeCompare(b.itemName ?? b.description));
      g.planned = planned(g.lines.map(x => ({ totalAmount: x.planned })));
      if (direction === 'out') {
        g.allocated = sumMoney(g.lines.map(x => ({ amount: x.allocated ?? 0 })));
        g.collected = sumMoney(g.lines.map(x => ({ amount: x.collected ?? 0 })));
      }
    }
    return sortByPlanOrder([...groups.values()], c => c.categoryId, c => c.categoryName, categoryOrder);
  };

  const revenueCats = byCategory('in');
  const expenseCats = byCategory('out');
  const fromAllocations = drawn.map(a => rowOf.get(a.id)!);
  const fromTheTeamsPlanned = sumMoney(fromAllocations.map(a => ({ amount: a.allocated })));
  const fromTheTeamsPeriods = drawn.flatMap(installmentPeriods).map((p, n) => ({ ...p, sortOrder: n }));

  const revenueTotal = planned([{ totalAmount: fromTheTeamsPlanned }, ...revenueCats.map(c => ({ totalAmount: c.planned }))]);
  const expenseTotal = planned(expenseCats.map(c => ({ totalAmount: c.planned })));
  const expenseLines = expenseCats.flatMap(c => c.lines);
  const net = netForYear(revenueTotal, expenseTotal);

  // By period: the same plan, by month (the coach's grid; `budget` cells).
  const months = yearMonths(year);
  const todayMonth = monthKeyOf(today) ?? months[0];
  const report = rollupMoneyReport({ lines: [...planRollupLines(lines), ...fromTheTeamsPlanLines(drawn)], spend: [] });
  const revenueGrid = buildMonthGrid({ lines: gridLinesOf(report.revenue, lines), actuals: [], scheduled: [], todayMonth, months, truncated: false });
  const expensesGrid = buildMonthGrid({ lines: gridLinesOf(report.expenses, lines), actuals: [], scheduled: [], todayMonth, months, truncated: false });

  return {
    year,
    revenue: {
      fromTheTeams: { planned: fromTheTeamsPlanned, allocations: fromAllocations, periods: fromTheTeamsPeriods },
      categories: revenueCats,
      total: revenueTotal,
    },
    expenses: {
      categories: expenseCats, total: expenseTotal,
      allocated: sumMoney(expenseLines.map(x => ({ amount: x.allocated ?? 0 }))),
      collected: sumMoney(expenseLines.map(x => ({ amount: x.collected ?? 0 }))),
      notAllocated: sumMoney(expenseLines.map(x => ({ amount: x.notAllocated ?? 0 }))),
    },
    openingBalance: input.openingBalance,
    net,
    closingBalance: closingBalance(input.openingBalance, net),
    periodGrid: {
      months,
      revenue: sortGrid(revenueGrid, categoryOrder),
      expenses: sortGrid(expensesGrid, categoryOrder),
      balance: clubCashFlow(months, revenueGrid, expensesGrid, null, 'budget', input.openingBalance, 0),
    },
  };
}

// ══ BUDGET VS. ACTUAL ═════════════════════════════════════════════════════════════════════════

export interface ClubReportInput {
  year: number;
  /** The club's day, `YYYY-MM-DD`. */
  today: string;
  /** The year's plan. */
  lines: readonly ClubPlanLineFacts[];
  /** Every allocation the club has made (the year rule picks; old lines find their source). */
  allocations: readonly ClubAllocationFacts[];
  /** Every request (waiting ones are Scheduled; decided ones name their lines' source). */
  requests: readonly ClubRequestFacts[];
  /** Every line, any status, dated in the year, on a book the club owns (never a team's). */
  bookLines: readonly ClubBookLineFacts[];
  /** Every line still PENDING on the Club books, whatever its date — Cash on hand's caption is today's,
   *  not the year's (Scheduled reads the ones dated in the year). */
  pendingLines: readonly ClubBookLineFacts[];
  /** The books the club owns, with their all-time Balance. */
  books: readonly ClubBook[];
  openingBalance: number;
  categoryOrder: Readonly<Record<string, number>>;
  scope?: TeamScope;
}

/** One lens's money in and out for the other books' row, by month. */
export interface OtherBooksMonth { month: MonthKey; moneyIn: number; moneyOut: number; net: number }

/**
 * Months (Ask 5): the coach's `MonthGridPayload`, so the screens session renders the coach's MoneyMonthGrid
 * fed the club's figures — plus the club's one addition, the other books' row, and the three balance
 * readings already worked out over every book (the grid's own balance helper knows only the coach's
 * bands; the club's balance must include the other books to tie to Cash on hand).
 *   · monthGrid      = the EXPENSES band (Club books); spendingGrid = the same grid (Season spending is
 *                      dropped on the club, so Difference compares the plan with what moved);
 *   · revenueGrid    = the REVENUE band (Club books), From the teams first;
 *   · returnedGrid   = empty (the club hands no money back to families);
 *   · cashOnHand     = the club's (every book it owns) — where Scheduled starts;
 *   · openingBalance = the year's, worked out from the books (never null on the club).
 */
export interface ClubMonthsFeed extends MonthGridPayload {
  months: MonthKey[];
  openingBalance: number;
  openingBalanceFrom: null;
  otherBooks: { budget: OtherBooksMonth[]; scheduled: OtherBooksMonth[]; actual: OtherBooksMonth[] };
  balances: { budget: CashFlowResult; scheduled: CashFlowResult; actual: CashFlowResult };
}

export interface ClubReport {
  year: number;
  today: string;
  /** The coach's statement shape: Revenue → categories → lines; Expenses → the same; Net. */
  statement: Pick<MoneyReport, 'revenue' | 'expenses' | 'net'>;
  /** Behind a sourced Actual: the allocation or request each loop line came from, by ledger line id. */
  lineSources: Record<string, LineSource>;
  /** Where each counted line sits on the book (the panel's door to the Ledger). */
  lineBooks: Record<string, { ledgerId: string; bookName: string }>;
  band: {
    /** The band's Collected (Total revenue's Actual), of the revenue planned. */
    collected: { amount: number; planned: number };
    /** Spent (Total expenses' Actual), of the expenses planned. */
    spent: { amount: number; planned: number };
    offPlan: number;
    cashOnHand: number;
  };
  /** The one Headroom: planned expenses − Spent (said on the summary). */
  headroom: number;
  /** Revenue and Expenses under Compare › To date (the coach's `budgetedOn`), for the summary. */
  toDate: { revenuePlanned: number; expensesPlanned: number };
  /** Lines waiting to post on the Club books, whatever their date — the caption under Cash on hand. */
  pending: { count: number; moneyIn: number; moneyOut: number };
  months: ClubMonthsFeed;
}

/** One grid row per (category, item) the statement shows. */
function gridLinesOf(section: ReportSection, planLines: readonly ClubPlanLineFacts[]): GridLine[] {
  const byId = new Map(planLines.map(l => [l.id, l]));
  return section.categories.flatMap(c => c.items.map(it => ({
    id: rowKey({ categoryId: c.categoryId, categoryName: c.categoryName, itemId: it.itemId }),
    description: it.itemName,
    categoryName: c.categoryName,
    categoryId: c.categoryId,
    itemId: it.itemId,
    totalAmount: it.budgeted,
    inPlan: it.inPlan,
    periods: it.periods.map(p => ({ date: p.date, amount: p.amount })),
    planLines: it.lines.flatMap(l => {
      const real = byId.get(l.id);
      return real ? [{ id: real.id, description: real.description, amount: real.totalAmount, dates: real.periods.flatMap(p => p.date ? [p.date] : []) }] : [];
    }),
  })));
}

/** A row for every (category, item) only the Scheduled lens knows about, so its money has a row. */
function withScheduledRows(rows: GridLine[], scheduled: readonly Filing[]): GridLine[] {
  const have = new Set(rows.map(r => r.id));
  const out = [...rows];
  for (const f of scheduled) {
    const id = rowKey(f);
    if (have.has(id)) continue;
    have.add(id);
    out.push({ id, description: f.itemName ?? '', categoryName: f.categoryName, categoryId: f.categoryId, itemId: f.itemId, totalAmount: 0, inPlan: false, periods: [], planLines: [] });
  }
  return out;
}

function sortGrid(grid: MonthGrid, order: Readonly<Record<string, number>>): MonthGrid {
  return { ...grid, categories: sortByPlanOrder(grid.categories, c => categoryIdOfKey(c.categoryKey), c => c.categoryName, order) };
}

/**
 * The balance rows, over EVERY book the club owns: opening, each month's net (the two bands plus the
 * other books), each month's closing — the coach's `buildCashFlow`, one arithmetic.
 * Budget and Cash open on the year's worked-out opening; Scheduled on today's cash (the coach's rule:
 * a forward view projected from zero would be fiction).
 */
function clubCashFlow(
  months: MonthKey[], revenue: MonthGrid, expenses: MonthGrid, other: readonly OtherBooksMonth[] | null,
  lens: 'budget' | 'scheduled' | 'actual', opening: number, cashOnHand: number,
): CashFlowResult {
  const moneyIn: Record<string, number> = {};
  const moneyOut: Record<string, number> = {};
  months.forEach((m, i) => {
    moneyIn[m] = revenue.totals.cells[i][lens] + (other?.[i]?.moneyIn ?? 0);
    moneyOut[m] = expenses.totals.cells[i][lens] + (other?.[i]?.moneyOut ?? 0);
  });
  return buildCashFlow(months, moneyIn, moneyOut, lens === 'scheduled' ? cashOnHand : opening, {
    moneyIn: revenue.totals.undated[lens],
    moneyOut: expenses.totals.undated[lens],
  });
}

function emptyGrid(months: MonthKey[]): MonthGrid {
  const blank = () => ({ budget: 0, scheduled: 0, actual: 0 });
  return { months, truncated: false, categories: [], totals: { cells: months.map(blank), undated: blank(), total: blank() } };
}

export function buildClubReport(input: ClubReportInput): ClubReport {
  const { year, today, lines, allocations, requests, bookLines, books, categoryOrder, scope } = input;
  const loop = loopIndex(allocations, requests);
  const months = yearMonths(year);
  const span = clubYearSpan(year);
  const inYear = (day: string | null) => day !== null && day >= span.first && day <= span.last;
  const todayMonth = monthKeyOf(today) ?? months[0];
  const cellDetails: Record<string, CellDetailItem[]> = {};
  const pushDetail = (kind: 'actual' | 'scheduled', f: Filing, date: string | null, d: Omit<CellDetailItem, 'date' | 'row'>) => {
    const m = monthKeyOf(date) ?? (date === null ? UNDATED_CELL : null);
    if (!m) return;
    (cellDetails[`${kind}|${categoryKey(f.categoryId, f.categoryName)}|${m}`] ??= []).push({ ...d, date, row: rowKey(f) });
  };

  // ── The Statement and the Cash lens: every counted line on the Club books, filed once ─────
  const counted = bookLines.filter(l => countsAsActual(l));
  const lineSources: Record<string, LineSource> = {};
  const lineBooks: Record<string, { ledgerId: string; bookName: string }> = {};
  const spend: RollupSpend[] = [];
  const actualIn: CategoryEvent[] = [], actualOut: CategoryEvent[] = [];
  for (const l of counted) {
    const { filing: f, source } = fileClubLine(l, loop);
    const direction = clubMovement(l) as 'in' | 'out';
    if (source) lineSources[l.id] = source;
    lineBooks[l.id] = { ledgerId: l.ledgerId, bookName: l.bookName };
    spend.push({ id: l.id, description: l.description, ...eventOf(f), itemName: f.itemName, amount: l.amount, paidDate: l.entryDate, direction });
    (direction === 'in' ? actualIn : actualOut).push({ ...eventOf(f), date: l.entryDate, amount: l.amount });
    pushDetail('actual', f, l.entryDate, { id: l.id, description: l.description, amount: l.amount, note: source?.teamName ?? l.bookName });
  }
  const report = rollupMoneyReport({ lines: [...planRollupLines(lines), ...fromTheTeamsPlanLines(drawnFrom(lines, allocations))], spend });
  const statement = {
    revenue: { ...report.revenue, categories: sortByPlanOrder(report.revenue.categories, c => c.categoryId, c => c.categoryName, categoryOrder) },
    expenses: { ...report.expenses, categories: sortByPlanOrder(report.expenses.categories, c => c.categoryId, c => c.categoryName, categoryOrder) },
    net: report.net,
  };

  // ── The band ──────────────────────────────────────────────────────────────────────────────
  const cashOnHand = clubCashOnHand(books);
  const band = {
    collected: { amount: bandCollected(counted), planned: report.revenue.budgeted },
    spent: { amount: spent(counted), planned: report.expenses.budgeted },
    offPlan: offPlan(report.expenses.categories.flatMap(c => c.items)),
    cashOnHand,
  };
  // A pending transfer between the club's own books moves nothing, so it is not "waiting" money.
  const waiting = input.pendingLines.filter(l => l.status === 'pending' && isClubBook(l.bookKind)
    && (clubMovement(l) === 'in' || clubMovement(l) === 'out'));
  const pending = {
    count: waiting.length,
    moneyIn: sumMoney(waiting.filter(l => clubMovement(l) === 'in')),
    moneyOut: sumMoney(waiting.filter(l => clubMovement(l) === 'out')),
  };

  // ── Scheduled: still to come from today (Ask 5) ────────────────────────────────────────────
  // The teams' installments not yet received, by DUE DATE in the year — whichever year's line the allocation
  // was drawn from (last year's bill still owed this spring is this spring's money, as its receipt would be
  // this spring's Cash). An overdue one STAYS in its due month and still counts (the coach's rule:
  // "currently obligated" includes what should already have been paid); a payment a coach says is sent is
  // still to come for the club until it confirms it. Pending lines by their date. Waiting requests have no
  // date (counted as possible), and only this year has a "today" to wait from.
  const scheduledIn: CategoryEvent[] = [], scheduledOut: CategoryEvent[] = [];
  const scheduledFilings: Filing[] = [];
  const schedule = (side: 'in' | 'out', f: Filing, date: string | null, amount: number) => {
    (side === 'in' ? scheduledIn : scheduledOut).push({ ...eventOf(f), date, amount });
    scheduledFilings.push(f);
  };
  for (const a of allocations) {
    const f = allocationFiling(a);
    for (const s of a.splits) {
      for (const i of s.installments) {
        if (i.paidAt || !inYear(i.dueDate)) continue;
        schedule('in', f, i.dueDate, i.amount);
        pushDetail('scheduled', f, i.dueDate, {
          id: i.id, description: `${a.description} · ${inScope(scope, s.teamId) ? s.teamName : OUTSIDE_YOUR_GROUPS_WORD}`,
          kind: installmentWord(i.installmentNumber),
          amount: i.amount, datePrefix: 'Due ', note: i.sentAt ? CLUB_SENT_WAITING_WORD : null,
        });
      }
    }
  }
  for (const l of waiting) {
    if (!inYear(l.entryDate)) continue;
    const side = clubMovement(l) as 'in' | 'out';
    const { filing: f } = fileClubLine(l, loop);
    schedule(side, f, l.entryDate, l.amount);
    pushDetail('scheduled', f, l.entryDate, { id: l.id, description: l.description, amount: l.amount, note: 'pending' });
  }
  if (clubYearOf(today) === year) {
    for (const r of requests) {
      if (r.status !== 'pending') continue;
      const toClub = r.requestType === 'payment_to_org';
      const f = toClub ? ON_REQUEST_FILING : TEAM_SUPPORT_FILING;
      schedule(toClub ? 'in' : 'out', f, null, r.amount);
      pushDetail('scheduled', f, null, {
        // A request's words are its team's: outside the reader's groups, only that a team asked.
        id: r.id, description: inScope(scope, r.teamId) ? `${r.description} · ${r.teamName}` : OUTSIDE_YOUR_GROUPS_WORD, amount: r.amount,
        note: `Asked ${formatStoredDate(r.createdOn, { withYear: false })} · waiting for your answer`,
      });
    }
  }

  // ── Months ────────────────────────────────────────────────────────────────────────────────
  const revenueLines = withScheduledRows(gridLinesOf(statement.revenue, lines), scheduledFilings);
  const expenseLines = withScheduledRows(gridLinesOf(statement.expenses, lines), scheduledFilings);
  const revenueGrid = sortGrid(buildMonthGrid({ lines: revenueLines, actuals: actualIn, scheduled: scheduledIn, todayMonth, months, truncated: false }), categoryOrder);
  const monthGrid = sortGrid(buildMonthGrid({ lines: expenseLines, actuals: actualOut, scheduled: scheduledOut, todayMonth, months, truncated: false }), categoryOrder);

  const linesByMonth = new Map<string, ClubBookLineFacts[]>();
  for (const l of bookLines) {
    const m = monthKeyOf(l.entryDate);
    if (m) linesByMonth.set(m, [...(linesByMonth.get(m) ?? []), l]);
  }
  const otherFor = (lens: 'actual' | 'scheduled'): OtherBooksMonth[] => months.map(m => {
    const mv = otherBooksMovement(linesByMonth.get(m) ?? [], lens);
    return { month: m, ...mv, net: netForYear(mv.moneyIn, mv.moneyOut) };
  });
  const otherBooks = {
    budget: months.map(m => ({ month: m, moneyIn: 0, moneyOut: 0, net: 0 })),
    scheduled: otherFor('scheduled'),
    actual: otherFor('actual'),
  };
  const flow = (lens: 'budget' | 'scheduled' | 'actual') =>
    clubCashFlow(months, revenueGrid, monthGrid, otherBooks[lens], lens, input.openingBalance, cashOnHand);

  return {
    year, today, statement, lineSources, lineBooks, band,
    headroom: headroom(report.expenses.budgeted, band.spent.amount),
    toDate: { revenuePlanned: sumBudgetedOn(report.revenue, today), expensesPlanned: sumBudgetedOn(report.expenses, today) },
    pending,
    months: {
      months, todayMonth,
      monthGrid, revenueGrid, returnedGrid: emptyGrid(months), spendingGrid: monthGrid,
      cellDetails, cashOnHand, openingBalance: input.openingBalance, openingBalanceFrom: null,
      otherBooks, balances: { budget: flow('budget'), scheduled: flow('scheduled'), actual: flow('actual') },
    },
  };
}

function sumBudgetedOn(section: ReportSection, today: string): number {
  return sumMoney(section.categories.flatMap(c => c.items).map(it => ({ amount: budgetedOn('todate', it.budgeted, it.periods, today) })));
}

// ══ THE BOARD SUMMARY (the Overview tab, Ask 1) ════════════════════════════════════════════════

export interface SummaryTeamInput {
  teamId: string;
  teamName: string;
  groupName: string | null;
  isArchived: boolean;
}

/** What the summary reads of a request: whose, whether it waits, how much, and whether it holds a payout. */
export interface SummaryRequest { teamId: string; status: string; amount: number; holdingPayout?: boolean }

export interface SummaryTeamRow extends SummaryTeamInput {
  /** The year's (the year rule): its allocations' shares, collected and outstanding. */
  allocated: number;
  collected: number;
  outstanding: number;
  overdue: CountAndAmount;
  sent: CountAndAmount;
  requestsWaiting: CountAndAmount;
  holdingPayout: boolean;
  /** The coach's own Cash on hand — read, labelled, never added into a club figure (D1, Ask 4e). */
  cash: TeamCashHeld;
}

export interface BoardSummary {
  year: number;
  today: string;
  /** Where the club stands today (none of the three depends on the year). */
  position: {
    cashOnHand: number;
    pending: { count: number; moneyIn: number; moneyOut: number };
    owedByTheTeams: { amount: number; overdue: CountAndAmount; sent: CountAndAmount };
    waitingOnYou: CountAndAmount & { holdingPayout: number };
  };
  /** The year against the budget — READ from Budget vs. Actual's report, never computed again. */
  againstBudget: {
    revenue: { planned: number; plannedToDate: number; actual: number };
    fromTheTeams: { allocations: number; onRequest: number };
    expenses: { planned: number; plannedToDate: number; actual: number };
    paidToTeamsOnRequest: number;
    offPlan: number;
    net: { planned: number; actual: number };
    headroom: number;
  };
  teams: SummaryTeamRow[];
  /** The teams' cash, in its own band — never the club's money. */
  teamsCash: { total: number; teamCount: number };
  books: ClubBook[];
}

/** The Actual of one statement row — or, with `itemId: null`, of a category's rows other than On request. */
function itemActual(section: ReportSection, categoryId: string, itemId: string | null): number {
  const cat: CategoryRow | undefined = section.categories.find(c => c.categoryId === categoryId);
  if (!cat) return 0;
  return sumMoney(cat.items.filter(i => (itemId === null ? i.itemId !== ON_REQUEST_FILING.itemId : i.itemId === itemId))
    .map(i => ({ amount: i.actual })));
}

export function buildBoardSummary(input: {
  report: ClubReport;
  /** Every allocation the club has made, limited to the reader's teams — Owed by the teams is across every year. */
  allocations: readonly ClubAllocationFacts[];
  requests: readonly SummaryRequest[];
  books: readonly ClubBook[];
  teams: readonly SummaryTeamInput[];
  teamCash: readonly TeamCashHeld[];
}): BoardSummary {
  const { report, allocations, requests, books, teams, teamCash } = input;
  const { year, today, statement } = report;

  const position = {
    cashOnHand: report.band.cashOnHand,
    pending: report.pending,
    owedByTheTeams: owedByTheTeams(allocations.flatMap(installmentsOf), today),
    waitingOnYou: { ...waitingOnYou(requests), holdingPayout: requests.filter(r => r.status === 'pending' && r.holdingPayout).length },
  };

  const againstBudget = {
    revenue: { planned: statement.revenue.budgeted, plannedToDate: report.toDate.revenuePlanned, actual: statement.revenue.actual },
    fromTheTeams: {
      allocations: itemActual(statement.revenue, FROM_THE_TEAMS_ID, null),
      onRequest: itemActual(statement.revenue, FROM_THE_TEAMS_ID, ON_REQUEST_FILING.itemId),
    },
    expenses: { planned: statement.expenses.budgeted, plannedToDate: report.toDate.expensesPlanned, actual: statement.expenses.actual },
    paidToTeamsOnRequest: itemActual(statement.expenses, TEAM_SUPPORT_FILING.categoryId, TEAM_SUPPORT_FILING.itemId),
    offPlan: report.band.offPlan,
    net: { planned: statement.net.budgeted, actual: statement.net.actual },
    headroom: report.headroom,
  };

  // Each team's share of the year's allocations, and its requests — grouped once, not per team.
  const yearSplits = new Map<string, ClubAllocationFacts['splits']>();
  for (const a of allocations) {
    if (!allocationInYear(a, year)) continue;
    for (const s of a.splits) yearSplits.set(s.teamId, [...(yearSplits.get(s.teamId) ?? []), s]);
  }
  const requestsBy = new Map<string, SummaryRequest[]>();
  for (const r of requests) requestsBy.set(r.teamId, [...(requestsBy.get(r.teamId) ?? []), r]);
  const cashByTeam = new Map(teamCash.map(t => [t.teamId, t]));

  const rows: SummaryTeamRow[] = teams.map(t => {
    const mine = yearSplits.get(t.teamId) ?? [];
    const f = clubBillFigures(mine.flatMap(s => s.installments), today);
    const theirs = requestsBy.get(t.teamId) ?? [];
    return {
      ...t,
      allocated: sumMoney(mine),
      collected: f.collected,
      outstanding: f.outstanding,
      overdue: f.overdue,
      sent: f.sent,
      requestsWaiting: waitingOnYou(theirs),
      holdingPayout: theirs.some(r => r.status === 'pending' && r.holdingPayout),
      cash: cashByTeam.get(t.teamId) ?? { teamId: t.teamId, cash: null, season: null },
    };
  });
  // Teams that need the club first: late, then waiting, then the rest by name.
  rows.sort((a, b) => (Number(b.overdue.count > 0) - Number(a.overdue.count > 0))
    || (Number(b.requestsWaiting.count > 0) - Number(a.requestsWaiting.count > 0))
    || a.teamName.localeCompare(b.teamName, undefined, { numeric: true }));

  return {
    year, today, position, againstBudget,
    teams: rows,
    teamsCash: { total: teamsCashTotal(rows.map(r => r.cash)), teamCount: rows.filter(r => r.cash.cash != null).length },
    books: [...books],
  };
}

// ══ EXPORTS — the shape on screen, the notes carried (the coach's rule; session 2 writes the files) ══

export const STATEMENT_EXPORT_COLUMNS = [
  { label: 'Section', key: 'section', format: 'text' as const },
  { label: 'Category', key: 'category', format: 'text' as const },
  { label: 'Line', key: 'line', format: 'text' as const },
  { label: 'Budgeted', key: 'budgeted', format: 'currency' as const },
  { label: 'Actual', key: 'actual', format: 'currency' as const },
  { label: 'Variance', key: 'variance', format: 'currency' as const },
];

/**
 * The Statement as rows, in reading order: each category then its lines, each band closed by its
 * total, the year's net last. `budgeted` is blank on an off-plan line (the screen's amber dash).
 */
export function statementExportRows(report: Pick<ClubReport, 'statement' | 'year'>): Record<string, string | number | null>[] {
  const rows: Record<string, string | number | null>[] = [];
  const band = (name: string, s: ReportSection, totalWord: string) => {
    for (const c of s.categories) {
      rows.push({ section: name, category: c.categoryName, line: '', budgeted: c.inPlan ? c.budgeted : null, actual: c.actual, variance: c.variance });
      for (const i of c.items) {
        rows.push({ section: name, category: c.categoryName, line: i.itemName, budgeted: i.inPlan ? i.budgeted : null, actual: i.actual, variance: i.variance });
      }
    }
    rows.push({ section: name, category: totalWord, line: '', budgeted: s.budgeted, actual: s.actual, variance: s.variance });
  };
  band('Revenue', report.statement.revenue, PLAN_LADDER_LABEL.totalRevenue);
  band('Expenses', report.statement.expenses, PLAN_LADDER_LABEL.totalExpenses);
  const n = report.statement.net;
  rows.push({ section: '', category: `Net for ${report.year}`, line: '', budgeted: n.budgeted, actual: n.actual, variance: n.variance });
  return rows;
}

export const BOARD_TEAMS_EXPORT_COLUMNS = [
  { label: 'Team', key: 'team', format: 'text' as const },
  { label: 'Group', key: 'group', format: 'text' as const },
  { label: 'Allocated', key: 'allocated', format: 'currency' as const },
  { label: 'Collected', key: 'collected', format: 'currency' as const },
  { label: 'Outstanding', key: 'outstanding', format: 'currency' as const },
  { label: 'Requests waiting', key: 'requests', format: 'currency' as const },
  { label: `Cash on hand · ${HELD_BY_THE_TEAM_WORD.toLowerCase()}`, key: 'cash', format: 'currency' as const },
];

/** The board report's teams table: the team's cash labelled exactly as on screen; its total row says
 *  it is not the club's (D1, Ask 4e) and the club's own totals never include it. */
export function boardTeamsExportRows(summary: Pick<BoardSummary, 'teams' | 'teamsCash'>): Record<string, string | number | null>[] {
  const rows: Record<string, string | number | null>[] = summary.teams.map(t => ({
    team: t.teamName, group: t.groupName ?? '', allocated: t.allocated, collected: t.collected,
    outstanding: t.outstanding, requests: t.requestsWaiting.amount, cash: t.cash.cash,
  }));
  const total = (pick: (t: SummaryTeamRow) => number) => sumMoney(summary.teams.map(t => ({ amount: pick(t) })));
  rows.push({
    team: 'The teams', group: '',
    allocated: total(t => t.allocated), collected: total(t => t.collected), outstanding: total(t => t.outstanding),
    requests: total(t => t.requestsWaiting.amount), cash: null,
  });
  rows.push({ team: TEAMS_CASH_TOTAL_WORD, group: '', allocated: null, collected: null, outstanding: null, requests: null, cash: summary.teamsCash.total });
  return rows;
}
