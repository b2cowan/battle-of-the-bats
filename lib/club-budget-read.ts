import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { orgDayKey, addCalendarDays, tournamentToday } from './timezone';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getBookTotals, getClubOwnedLedgers } from './db';
import { loadClubLoop, seasonsHoldingPayout, type ClubLoop } from './club-money-reads';
import { teamCashHeld } from './club-team-cash';
import { carriedOpening, clubYearSpan, isClubBook, openingBalance } from './club-money-figures';
import {
  buildClubPlan, buildClubReport, buildBoardSummary, withPeriodViews,
  type ClubAllocationFacts, type ClubBook, type ClubBookLineFacts, type ClubPlan, type ClubPlanLineFacts, type ClubPlanWithPeriods,
  type ClubReport, type ClubRequestFacts, type BoardSummary, type TeamScope,
} from './club-budget-report';
import {
  fiscalYearOptions, previousFiscalYear,
  type FiscalSetting, type FiscalYear, type FiscalYearOption,
} from './club-fiscal-year';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S YEAR, READ (Club Tier Stage 3b): the rows behind the Budget, Budget vs. Actual and the
 * board summary. Every figure is lib/club-budget-report.ts's, which asks lib/club-money-figures.ts —
 * nothing is summed here. Each read loads its rows ONCE (`loadYear`) and builds every shape it needs
 * from them.
 *
 * ⚠ NO ROW CAP (C05: the old Budget vs. Actual read the newest FIFTY expense lines). Every list pages
 * (lib/supabase-paging.ts); every balance is ONE SQL aggregate, `club_book_totals` (mig 317, C14).
 *
 * ⚖ SCOPE. The club's plan, its books and the year against the budget are the CLUB's records and read
 * every team's loop money (the General ledger already names every team to anyone holding Accounting).
 * Anything that lists TEAMS — the summary's teams table, each team's cash, Owed by the teams, Waiting on
 * you — is limited to the member's team groups (B11), as 3a's reads are.
 *
 * ⚠ A team's book is never read (D1): the club's books are the Club, Tournament and House league kinds.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * The fiscal years the Year pill offers (`fiscalYearOptions`): every year with a plan line, every closed year,
 * the year today falls in and always the next one — each with its name, whether it is locked, and how many
 * lines it holds (the Budget's empty year offers to start from the newest earlier year that has lines).
 */
export async function clubPlanYears(orgId: string, setting: FiscalSetting, today: string = tournamentToday()): Promise<FiscalYearOption[]> {
  const rows = await fetchAll<{ fiscal_year_id: string }>((a, b) => supabaseAdmin
    .from('org_budget_lines').select('fiscal_year_id').eq('org_id', orgId).order('id').range(a, b));
  const keyOf = new Map(setting.rows.map(r => [r.id, r.firstDay] as const));
  const lines: Record<string, number> = {};
  for (const r of rows) {
    const key = keyOf.get(r.fiscal_year_id);
    if (key) lines[key] = (lines[key] ?? 0) + 1;
  }
  return fiscalYearOptions(setting, today, lines);
}

/** The year's plan lines, each with its word, the word's side, and its periods. A year with no row has none. */
async function loadPlanLines(year: FiscalYear): Promise<ClubPlanLineFacts[]> {
  if (!year.id) return [];
  const yearId = year.id;
  const lines = await fetchAll<Record<string, any>>((a, b) => supabaseAdmin
    .from('org_budget_lines')
    .select('id, description, total_amount, notes, sort_order, created_at, updated_at, category_id, item_id, budget_categories ( name ), budget_items ( name, direction ), org_budget_periods ( id, period_label, period_date, amount, sort_order )')
    .eq('fiscal_year_id', yearId)
    .order('sort_order').order('created_at').order('id').range(a, b));
  return lines.map(l => ({
    id: l.id,
    categoryId: l.category_id ?? null,
    categoryName: l.budget_categories?.name ?? null,
    itemId: l.item_id ?? null,
    itemName: l.budget_items?.name ?? null,
    // A line with no word is a cost: every club line written before 3b planned spending (S3B-02).
    direction: l.budget_items?.direction === 'in' ? 'in' : 'out',
    totalAmount: Number(l.total_amount),
    description: l.description,
    notes: l.notes ?? null,
    sortOrder: l.sort_order,
    updatedAt: l.updated_at,
    periods: ((l.org_budget_periods ?? []) as Record<string, any>[])
      .map(p => ({ id: p.id, label: p.period_label, date: p.period_date ?? null, amount: Number(p.amount), sortOrder: p.sort_order }))
      .sort((x, y) => x.sortOrder - y.sortOrder),
  }));
}

/** Every allocation the club has made, from the loop (every team), with the KEY of each one's line's fiscal year. */
export async function allocationsOf(orgId: string, loop: ClubLoop, setting: FiscalSetting): Promise<ClubAllocationFacts[]> {
  const lineIds = [...new Set([...loop.allocations.values()].map(a => a.sourceBudgetLineId).filter((x): x is string => !!x))];
  const lineYears = await fetchAllIn<{ id: string; fiscal_year_id: string }>(lineIds, (c, a, b) => supabaseAdmin
    .from('org_budget_lines').select('id, fiscal_year_id').eq('org_id', orgId).in('id', c).order('id').range(a, b));
  const keyOfRow = new Map(setting.rows.map(r => [r.id, r.firstDay] as const));
  const yearOf = new Map(lineYears.map(l => [l.id, keyOfRow.get(l.fiscal_year_id) ?? null] as const));

  const splitsBy = new Map<string, ClubAllocationFacts['splits']>();
  for (const s of loop.splits) {
    splitsBy.set(s.allocationId, [...(splitsBy.get(s.allocationId) ?? []), {
      id: s.id, teamId: s.teamId, teamName: loop.teams.get(s.teamId)?.name ?? 'A team', amount: s.amount,
      installments: s.installments.map(i => ({
        id: i.id, installmentNumber: i.installmentNumber, amount: i.amount, dueDate: i.dueDate,
        paidAt: i.paidAt, sentAt: i.sentAt ?? null, sentOn: i.sentOn ?? null, paidOn: i.paidOn ?? null,
        accountingEntryId: i.accountingEntryId ?? null,
      })),
    }]);
  }
  return [...loop.allocations.values()].map(a => ({
    id: a.id,
    description: a.description,
    createdOn: orgDayKey(a.createdAt),
    sourceBudgetLineId: a.sourceBudgetLineId,
    lineYearKey: a.sourceBudgetLineId ? yearOf.get(a.sourceBudgetLineId) ?? null : null,
    splits: splitsBy.get(a.id) ?? [],
  }));
}

type YearRequest = ClubRequestFacts & { programYearId: string };

/** Every request, lightly (no names, no settlement read): enough to file a loop line and list what waits. */
export async function loadRequests(orgId: string): Promise<YearRequest[]> {
  const rows = await fetchAll<Record<string, any>>((a, b) => supabaseAdmin
    .from('rep_team_payment_requests')
    .select('id, team_id, program_year_id, request_type, status, amount, description, created_at, accounting_entry_id, rep_teams ( name )')
    .eq('org_id', orgId).order('created_at').order('id').range(a, b));
  return rows.map(r => ({
    id: r.id, teamId: r.team_id, teamName: r.rep_teams?.name ?? 'A team', requestType: r.request_type,
    status: r.status, amount: Number(r.amount), description: r.description, createdOn: orgDayKey(r.created_at),
    accountingEntryId: r.accounting_entry_id ?? null, programYearId: r.program_year_id,
  }));
}

/**
 * The books the club owns (never a team's), each with its all-time Balance, and the year's OPENING: the year
 * before's stored closing when that year is closed (THE CARRY, Ask 4 — locked), else every book's posted sums
 * for the days BEFORE the year's first day (3b's, worked out from the books). ONE ledger read and ONE SQL
 * aggregate: `club_book_totals`'s balance is all-time whatever the window, so the window asked is the opening's.
 */
export async function loadClubBooks(orgId: string, year: FiscalYear, setting: FiscalSetting): Promise<{ books: ClubBook[]; opening: number; openingCarried: boolean }> {
  const ledgers = await getClubOwnedLedgers(orgId);
  const dayBefore = addCalendarDays(clubYearSpan(year).first, -1);
  const totals = await getBookTotals(ledgers.map(l => l.id), null, dayBefore);
  const before = previousFiscalYear(year, setting);
  const fromTheBooks = openingBalance(ledgers.map(l => ({
    kind: l.entityType, postedIn: totals.get(l.id)?.postedIn ?? 0, postedOut: totals.get(l.id)?.postedOut ?? 0,
  })));
  return {
    books: ledgers.map(l => ({ id: l.id, kind: l.entityType, name: l.name, balance: totals.get(l.id)?.balance ?? 0 })),
    opening: carriedOpening(before.closed?.closingBalance ?? null, fromTheBooks),
    openingCarried: !!before.closed,
  };
}

const BOOK_LINE_SELECT = 'id, ledger_id, entry_date, description, amount, entry_type, status, category, source_module, source_entity_id, linked_entry_id, budget_category_id, budget_item_id, budget_categories ( name ), budget_items ( name ), partner:linked_entry_id ( accounting_ledgers ( entity_type ) )';

/** Every line dated in a span on the club's own books, any status, each transfer with its other half's kind. */
export async function loadBookLines(books: readonly ClubBook[], span: { first: string; last: string }): Promise<ClubBookLineFacts[]> {
  return readBookLines(books, q => q.gte('entry_date', span.first).lte('entry_date', span.last));
}

/** Every line still PENDING on the Club books, whatever its date (Cash on hand's caption is today's). */
export async function loadPendingLines(books: readonly ClubBook[]): Promise<ClubBookLineFacts[]> {
  return readBookLines(books.filter(b => isClubBook(b.kind)), q => q.eq('status', 'pending'));
}

async function readBookLines(books: readonly ClubBook[], narrow: (q: any) => any): Promise<ClubBookLineFacts[]> {
  if (books.length === 0) return [];
  const bookOf = new Map(books.map(b => [b.id, b] as const));
  const rows = await fetchAllIn<Record<string, any>>(books.map(b => b.id), (c, a, b) => narrow(supabaseAdmin
    .from('accounting_entries').select(BOOK_LINE_SELECT).in('ledger_id', c))
    .order('entry_date').order('created_at').order('id').range(a, b));
  return rows.map(r => {
    const book = bookOf.get(r.ledger_id)!;
    return {
      id: r.id, ledgerId: r.ledger_id, bookKind: book.kind, bookName: book.name,
      entryDate: r.entry_date, description: r.description, amount: Number(r.amount),
      entryType: r.entry_type, status: r.status, category: r.category ?? null,
      sourceModule: r.source_module ?? null, sourceEntityId: r.source_entity_id ?? null,
      linkedEntryId: r.linked_entry_id ?? null,
      // A transfer's other half: on a book the club owns (it moves nothing in total), or on a team's book
      // (the money loop, or a transfer made by hand before 3a refused them).
      partnerKind: r.partner?.accounting_ledgers?.entity_type ?? null,
      budgetCategoryId: r.budget_category_id ?? null, budgetCategoryName: r.budget_categories?.name ?? null,
      budgetItemId: r.budget_item_id ?? null, budgetItemName: r.budget_items?.name ?? null,
    };
  });
}

/** The budget library's order (sort, then name) for every category the club can see. */
export async function loadCategoryOrder(orgId: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from('budget_categories').select('id, sort_order')
    .or(`org_id.is.null,org_id.eq.${orgId}`);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(c => [c.id as string, c.sort_order as number]));
}

/** Everything one year's reads need, loaded once. `loop` is every team's (the summary scopes it in memory). */
export async function loadYear(orgId: string, year: FiscalYear, setting: FiscalSetting) {
  const booksP = loadClubBooks(orgId, year, setting);
  const loopP = loadClubLoop(orgId, null);
  const [lines, loop, allocations, requests, booksNow, bookLines, pendingLines, categoryOrder] = await Promise.all([
    loadPlanLines(year), loopP, loopP.then(l => allocationsOf(orgId, l, setting)), loadRequests(orgId), booksP,
    booksP.then(b => loadBookLines(b.books, clubYearSpan(year))), booksP.then(b => loadPendingLines(b.books)), loadCategoryOrder(orgId),
  ]);
  return {
    lines, loop, allocations, requests, books: booksNow.books, bookLines, pendingLines, categoryOrder,
    openingBalance: booksNow.opening, openingCarried: booksNow.openingCarried, setting,
  };
}

// ── The reads ─────────────────────────────────────────────────────────────────────────────────

/** `scope` = the reader's team groups (`teamIdsInScope`): the figures are the club's whatever it is; a team
 *  outside it is counted, never named (B11). */
export async function readClubPlan(
  orgId: string, year: FiscalYear, setting: FiscalSetting, today: string = tournamentToday(), scope: PromiseLike<TeamScope> | TeamScope = null,
): Promise<ClubPlanWithPeriods & { openingCarried: boolean }> {
  const [lines, allocations, categoryOrder, books, seen] = await Promise.all([
    loadPlanLines(year), loadClubLoop(orgId, null).then(l => allocationsOf(orgId, l, setting)),
    loadCategoryOrder(orgId), loadClubBooks(orgId, year, setting), scope,
  ]);
  return {
    ...withPeriodViews(buildClubPlan({ year, today, lines, allocations, categoryOrder, openingBalance: books.opening, scope: seen }), lines, categoryOrder),
    openingCarried: books.openingCarried,
  };
}

/** Budget vs. Actual and the plan it reads against, from ONE load of the year's rows. */
export async function readClubYear(
  orgId: string, year: FiscalYear, setting: FiscalSetting, today: string = tournamentToday(), scope: PromiseLike<TeamScope> | TeamScope = null,
): Promise<{ plan: ClubPlan; report: ClubReport; rows: Awaited<ReturnType<typeof loadYear>> }> {
  const [rows, seen] = await Promise.all([loadYear(orgId, year, setting), scope]);
  return {
    plan: buildClubPlan({ year, today, lines: rows.lines, allocations: rows.allocations, categoryOrder: rows.categoryOrder, openingBalance: rows.openingBalance, scope: seen }),
    report: buildClubReport({ year, today, ...rows, scope: seen }),
    rows,
  };
}

/**
 * The board summary (Ask 1). The year against the budget is READ from Budget vs. Actual's report —
 * the same `buildClubReport` over the same rows, never a second computation. Teams are the member's
 * groups' (B11): Owed by the teams, Waiting on you and the teams table count only those. Each team's
 * cash — the slowest read — starts as soon as the teams are known.
 */
export async function readBoardSummary(
  orgId: string,
  year: FiscalYear,
  setting: FiscalSetting,
  scope: PromiseLike<TeamScope> | TeamScope,
  today: string = tournamentToday(),
): Promise<BoardSummary> {
  const rowsP = loadYear(orgId, year, setting);
  const scopeP = Promise.resolve(scope);
  const listedP = Promise.all([rowsP, scopeP]).then(([r, s]) => listedTeams(r.loop, s));
  const cashP = listedP.then(teams => teamCashHeld(teams.map(t => t.id)));
  const [rows, listed, teamCash, scopeIds] = await Promise.all([rowsP, listedP, cashP, scopeP]);

  const inScope = (teamId: string) => !scopeIds || scopeIds.has(teamId);
  const requests = rows.requests.filter(r => inScope(r.teamId));
  const held = await seasonsHoldingPayout(requests.filter(r => r.status === 'pending').map(r => r.programYearId));
  return buildBoardSummary({
    report: buildClubReport({ year, today, ...rows, scope: scopeIds }),
    setting,
    allocations: rows.allocations
      .map(a => ({ ...a, splits: a.splits.filter(s => inScope(s.teamId)) }))
      .filter(a => a.splits.length > 0),
    requests: requests.map(r => ({ ...r, holdingPayout: r.status === 'pending' && held.has(r.programYearId) })),
    books: rows.books,
    teams: listed.map(t => ({ teamId: t.id, teamName: t.name, groupName: t.groupName, isArchived: t.isArchived })),
    teamCash,
  });
}

/** The teams the summary lists: the member's groups', active — or archived but still holding money with the club. */
function listedTeams(loop: ClubLoop, scope: TeamScope) {
  const withMoney = new Set(loop.splits.map(s => s.teamId));
  return [...loop.teams.values()].filter(t => (!scope || scope.has(t.id)) && (!t.isArchived || withMoney.has(t.id)));
}
