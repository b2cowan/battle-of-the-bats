import { NextResponse } from 'next/server';
import {
  getRepTeamTagLibrary, getRepTeamExpenseTagsMap, getRepDuesPaymentsByProgramYear,
  getRealisedFundraiserEntries,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';
import {
  buildMonthGrid, monthKeyOf,
  type CategoryEvent, type GridLine, type PriorLine,
} from '@/lib/coach-budget-months';
import { computeBudgetTotals, normalizeBudgetLineKind, isFundingKind } from '@/lib/coach-budget-totals';
import { rollupBudget, type RollupLine, type RollupSpend } from '@/lib/coach-budget-rollup';
import { duesPaidAmount, paymentsTotalByPlayer } from '@/lib/dues-payments';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';

// GET /api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual
//
// Returns a full budget-vs-actual report for the active program year.
//
// ⚠ THE REPORT IS TWO LEVELS: CATEGORY → ITEM (owner ruling 2026-08-15), and a cost reaches them
// three ways that coexist — its ITEM (mig 240), its category id, or its free-text `category` matched
// by NAME, which is every row written before any of this. All three land under the same headings,
// which is what makes shipping without a backfill safe.
// Two budget lines on one item SUM into one row; an item with spending and NO line is its own
// flagged row; and whether something was budgeted is DERIVED, never stored. The rule lives in
// lib/coach-budget-rollup.ts, which owns it for this route and the screen together.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Optional money-tag filter (Phase 3): when ?tagId= is present, the actuals are scoped to
  // expenses carrying that tag (the budget plan stays whole) — a "spend by tag" cut of the report.
  const filterTagId = new URL(req.url).searchParams.get('tagId');

  // ── 1. Load budget lines + periods ──────────────────────────────────────
  const { data: linesRaw } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('*, rep_budget_periods(*), budget_categories(name), budget_items(name)')
    .eq('program_year_id', programYear.id)
    .order('sort_order');

  const allLines = (linesRaw ?? []) as Array<Record<string, unknown>>;
  // ⚠ EXPECTED-FUNDING LINES ARE NOT COSTS and must never enter the cost machinery below: this
  // report matches actual expenses to a line by category NAME, so a funding line filed under
  // "Fundraising" would sit waiting to absorb a real expense that happened to carry that word —
  // and would inflate the budget it is supposed to offset. They get their own block (§8b).
  // ⚠ BOTH MONEY-IN KINDS. Fundraising and sponsorship differ only in how they REPORT — a filter
  // naming one would leave the other in the COST bucket, where it would be matched against real
  // expenses and inflate the very budget it exists to offset (2026-08-15).
  const lines = allLines.filter(l => !isFundingKind(l.line_kind as string | null));
  const fundingLines = allLines.filter(l => isFundingKind(l.line_kind as string | null));

  // ── 2. Load expenses (paid and unpaid) ───────────────────────────────────
  const { data: expensesRaw } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('id, description, category, budget_item_id, budget_category_id, amount, expense_paid_at, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, expense_type, created_at, budget_items(name, category_id, budget_categories(name))')
    .eq('program_year_id', programYear.id)
    .order('created_at');

  const allExpenses = (expensesRaw ?? []) as Array<Record<string, unknown>>;

  // Money-tag library (team + org-shared) for the filter chip row, and which tags each expense
  // carries. When a tag filter is active, the actuals-side of the report only sees tagged expenses.
  const [expenseTags, tagsByExpenseId] = await Promise.all([
    getRepTeamTagLibrary(teamId, 'expense', ctx.org.id),
    getRepTeamExpenseTagsMap(allExpenses.map(e => e.id as string)),
  ]);
  const expenses = filterTagId
    ? allExpenses.filter(e => (tagsByExpenseId[e.id as string] ?? []).includes(filterTagId))
    : allExpenses;

  // Compute the "paid amount" for each expense:
  // - simple expense → amount when expense_paid_at IS NOT NULL
  // - tournament_payable → deposit when deposit_paid_at + balance when balance_paid_at
  function paidAmount(exp: Record<string, unknown>): number {
    if (exp.expense_type === 'tournament_payable') {
      return (exp.deposit_paid_at ? (exp.deposit_amount as number ?? 0) : 0)
           + (exp.balance_paid_at  ? (exp.balance_amount  as number ?? 0) : 0);
    }
    return exp.expense_paid_at ? (exp.amount as number) : 0;
  }

  // Effective paid date for sorting/period assignment (earliest paid event)
  function paidDate(exp: Record<string, unknown>): string | null {
    const dates: string[] = [];
    if (exp.expense_paid_at)  dates.push(exp.expense_paid_at  as string);
    if (exp.deposit_paid_at)  dates.push(exp.deposit_paid_at  as string);
    if (exp.balance_paid_at)  dates.push(exp.balance_paid_at  as string);
    if (dates.length === 0) return null;
    return dates.sort()[0].slice(0, 10);
  }

  // ── 3–5. Roll the plan and the spending up to CATEGORY → ITEM ───────────────────────────────
  //
  // ⚠ THE ITEM IS THE KEY — NOT THE LINE, AND NEVER THE DESCRIPTION (owner ruling 2026-08-15). Two
  // lines on one item SUM into one row, an item with spending and no line is its own row, and the
  // rule lives in lib/coach-budget-rollup.ts so this route and the screen cannot group one plan two
  // different ways. That module's header carries the reasoning, including why the one-day-old
  // expense→line link was retired to get here.
  //
  // Resolving ONE cost to its place in the taxonomy, in strict order of trust:
  //   1. its ITEM (mig 240) — which states the category too, since an item lives in exactly one;
  //   2. its category id (mig 238) — an imported or part-classified row;
  //   3. its free-text `category`, matched by NAME against the categories the plan uses, exactly as
  //      this report has always done for every row written before any of it existed.
  // Anything resolving to none of the three is spending with no category at all, and gets one
  // honest row of its own rather than a separate section nobody scrolls to.
  const categoryNameById = new Map<string, string>();
  const categoryIdByName = new Map<string, string>();
  const learnCategory = (catId: string | null, catName: string | null) => {
    const name = (catName ?? '').trim();
    if (!catId || !name) return;
    if (!categoryNameById.has(catId)) categoryNameById.set(catId, name);
    if (!categoryIdByName.has(name.toLowerCase())) categoryIdByName.set(name.toLowerCase(), catId);
  };

  for (const line of lines) {
    learnCategory(
      line.category_id as string | null,
      ((line.budget_categories as Record<string, unknown> | null)?.name as string) ?? null,
    );
  }
  /* ⚠ AND FROM THE SPENDING TOO, or a category the team never budgeted for SPLITS IN TWO. Learning
     names only from budget lines means a category with no line has no id↔name pairing at all — so a
     cost carrying its id buckets under the id while a sibling cost carrying only the typed text
     buckets under the name, and the report shows "Officials" twice, $2,000 and $600, for one $2,600
     category. The season total stayed right; the breakdown a coach actually reads did not. (The two
     rows also shared one expand toggle, being keyed by name.) */
  for (const exp of expenses) {
    const item = exp.budget_items as Record<string, unknown> | null;
    learnCategory(
      (exp.budget_category_id as string | null) ?? (item?.category_id as string | null) ?? null,
      ((item?.budget_categories as Record<string, unknown> | null)?.name as string)
        ?? (exp.category as string | null),
    );
  }

  const rollupLines: RollupLine[] = lines.map(l => ({
    id:           l.id as string,
    categoryId:   (l.category_id as string | null) ?? null,
    categoryName: ((l.budget_categories as Record<string, unknown> | null)?.name as string) ?? null,
    itemId:       (l.item_id as string | null) ?? null,
    itemName:     ((l.budget_items as Record<string, unknown> | null)?.name as string) ?? null,
    totalAmount:  (l.total_amount as number) ?? 0,
    description:  l.description as string,
    notes:        (l.notes as string | null) ?? null,
    periods: ((l.rep_budget_periods ?? []) as Array<Record<string, unknown>>)
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map(p => ({
        label:     p.period_label as string,
        date:      p.period_date as string | null,
        amount:    p.amount as number,
        sortOrder: p.sort_order as number,
      })),
  }));

  /** Where one cost sits in the taxonomy — the three-step resolution above, in one place. */
  function placeCost(exp: Record<string, unknown>) {
    const item = exp.budget_items as Record<string, unknown> | null;
    if (exp.budget_item_id && item) {
      const catId = (item.category_id as string | null) ?? null;
      return {
        categoryId:   catId,
        categoryName: ((item.budget_categories as Record<string, unknown> | null)?.name as string)
          ?? (catId ? categoryNameById.get(catId) ?? null : null),
        itemId:       exp.budget_item_id as string,
        itemName:     (item.name as string) ?? null,
      };
    }
    const explicitCat = exp.budget_category_id as string | null;
    if (explicitCat) {
      return {
        categoryId:   explicitCat,
        categoryName: categoryNameById.get(explicitCat) ?? (exp.category as string | null),
        itemId: null, itemName: null,
      };
    }
    const text = ((exp.category as string | null) ?? '').trim();
    return {
      categoryId:   text ? categoryIdByName.get(text.toLowerCase()) ?? null : null,
      categoryName: text || null,
      itemId: null, itemName: null,
    };
  }

  /* Resolved ONCE per expense, then read by both the category table and the month grid below.
     Those are two readings of one report: a cost landing under Facilities in one and under a stale
     string in the other is the same product answering itself twice — and resolving it twice was
     also plain repeated work. */
  const placedByExpense = new Map<string, ReturnType<typeof placeCost>>(
    expenses.map(exp => [exp.id as string, placeCost(exp)]));
  const placedFor = (exp: Record<string, unknown>) =>
    placedByExpense.get(exp.id as string) ?? placeCost(exp);

  const rollupSpend: RollupSpend[] = expenses
    .map(exp => ({ exp, paid: paidAmount(exp) }))
    .filter(({ paid }) => paid > 0)   // only paid amounts are actuals
    .map(({ exp, paid }) => ({
      id:          exp.id as string,
      description: exp.description as string,
      ...placedFor(exp),
      amount:      paid,
      paidDate:    paidDate(exp),
    }));

  const categoryResults = rollupBudget(rollupLines, rollupSpend);

  // Kept flat for the export and for anything still asking "what wasn't planned?" as a list. It is
  // no longer a separate SECTION on screen — unplanned spending now sits in its own row inside its
  // own category, where a coach reads it beside everything else rather than below it.
  const unbudgetedActuals = categoryResults.flatMap(cat =>
    cat.items.filter(i => !i.inPlan).flatMap(i => i.costs.map(c => ({
      id:          c.id,
      description: c.description,
      category:    cat.categoryName,
      item:        i.itemName,
      amount:      c.amount,
      paidAt:      c.paidDate,
    }))));

  // ── 6. Dues collection summary ────────────────────────────────────────
  const { data: schedules } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, player_id, total_amount')
    .eq('program_year_id', programYear.id);

  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);
  const expectedDues = (schedules ?? []).reduce(
    (s: number, r: { total_amount: number }) => s + (r.total_amount ?? 0), 0,
  );

  // Collected = recorded payment FACTS (mig 232), capped per player at their schedule total —
  // the same figure the dues table's Paid column shows, so this card and that screen can never
  // disagree. Installments stay fetched for the SCHEDULED half of the cash-flow strip ("what
  // lands in July if everyone pays on time").
  let collectedDues = 0;
  let duesInstallments: Array<{ amount: number; due_date: string | null; paid_at: string | null }> = [];
  let duesPayments: Array<{ playerId: string; amount: number; receivedDate: string | null }> = [];
  if (scheduleIds.length > 0) {
    const [{ data: inst }, pays] = await Promise.all([
      supabaseAdmin
        .from('rep_player_dues_installments')
        .select('amount, due_date, paid_at')
        .in('schedule_id', scheduleIds),
      getRepDuesPaymentsByProgramYear(programYear.id),
    ]);
    duesInstallments = (inst ?? []) as typeof duesInstallments;
    duesPayments = pays;
    const paymentsByPlayer = paymentsTotalByPlayer(pays);
    for (const s of (schedules ?? []) as Array<{ player_id: string; total_amount: number }>) {
      collectedDues += duesPaidAmount(paymentsByPlayer.get(s.player_id) ?? 0, s.total_amount ?? 0);
    }
  }

  const duesCollection = {
    expected:    Math.round(expectedDues    * 100) / 100,
    collected:   Math.round(collectedDues   * 100) / 100,
    outstanding: Math.round((expectedDues - collectedDues) * 100) / 100,
  };

  // ── 7. Monthly chart data ─────────────────────────────────────────────
  // Collect all relevant months from period_dates and paid expense dates
  const monthSet = new Set<string>();

  for (const line of lines) {
    for (const p of (line.rep_budget_periods ?? []) as Array<Record<string, unknown>>) {
      const m = monthKeyOf(p.period_date as string | null);
      if (m) monthSet.add(m);
    }
  }
  for (const exp of expenses) {
    const d = paidDate(exp);
    if (d) monthSet.add(d.slice(0, 7));
  }

  // If no months, default to current month
  if (monthSet.size === 0) monthSet.add(new Date().toISOString().slice(0, 7));

  const months = [...monthSet].sort();

  // Budget per month: sum of period amounts whose period_date falls in that month
  const budgetByMonth = new Map<string, number>();
  for (const line of lines) {
    for (const p of (line.rep_budget_periods ?? []) as Array<Record<string, unknown>>) {
      const m = monthKeyOf(p.period_date as string | null);
      if (m) budgetByMonth.set(m, (budgetByMonth.get(m) ?? 0) + (p.amount as number));
    }
  }

  // Budget with NO date stays OFF the monthly series (chunk H, owner decision D-H4). It used to be
  // spread evenly across every month, which is invisible in a cumulative chart but a plain untruth
  // in the month grid on the same page — a coach would read budget in months they never chose. The
  // amount is reported instead, so the chart can say out loud what it is not showing.
  const totalBudget = lines.reduce((s, l) => s + (l.total_amount as number), 0);
  const periodedBudget = [...budgetByMonth.values()].reduce((s, v) => s + v, 0);
  const undatedBudget = Math.max(0, Math.round((totalBudget - periodedBudget) * 100) / 100);

  // Actual per month: sum of paid expenses by paid date month
  const actualByMonth = new Map<string, number>();
  for (const exp of expenses) {
    const d = paidDate(exp);
    if (!d) continue;
    const m = d.slice(0, 7);
    actualByMonth.set(m, (actualByMonth.get(m) ?? 0) + paidAmount(exp));
  }

  let cumBudget = 0;
  let cumActual = 0;
  const monthlyChart = months.map(month => {
    const b = Math.round((budgetByMonth.get(month) ?? 0) * 100) / 100;
    const a = Math.round((actualByMonth.get(month)  ?? 0) * 100) / 100;
    cumBudget = Math.round((cumBudget + b) * 100) / 100;
    cumActual = Math.round((cumActual + a) * 100) / 100;
    return { month, budgetedForMonth: b, actualForMonth: a, cumBudget, cumActual };
  });

  // ── 8. The month grid (chunk H) ────────────────────────────────────────
  // Rows = category → ITEM, columns = the season's months, one payload serving all four lenses
  // (Budget · Scheduled · Actual · Difference) so flipping a lens never refetches. The arithmetic
  // lives in lib/coach-budget-months.ts and is unit-tested; this block is the assembly half.
  const todayMonth = tournamentToday().slice(0, 7); // ORG timezone — never the runtime's UTC month

  /* ⚠⚠ THE GRID'S ROWS COME FROM THE ROLLUP, NOT FROM THE RAW LINES — because Months and Categories
     are two views of ONE report and must not group it two different ways. Built from `lines` (as it
     was until 2026-08-15) a team with two budget lines on one item read as ONE row under Categories
     and TWO under Months, on the same screen, for the same plan. Taking the rows from
     `categoryResults` means the SUM ruling, the merged payment periods and the "not budgeted" rows
     all arrive already applied, by the one module that owns them.
     ⚠ Unplanned items are included with a zero budget on purpose: their category exists on this
     screen, and their spending needs a row to land in. */
  const gridLines: GridLine[] = categoryResults.flatMap(cat => cat.items.map(item => ({
    id:           `${cat.categoryName}|${item.itemId ?? 'no-item'}`,
    description:  item.itemName,
    categoryName: cat.categoryName,
    itemId:       item.itemId,
    itemName:     item.itemName,
    totalAmount:  item.budgeted,
    // Carried so the grid can still tell a planned category from one that only has spending —
    // every item now arrives with a row, so the row's presence no longer answers that.
    inPlan:       item.inPlan,
    periods:      item.periods.map(p => ({ date: p.date, amount: p.amount })),
  })));

  // Actuals: what was paid, on the day it was paid. A payable's deposit and balance are separate
  // events — they land in different months and the grid must show them that way.
  const gridActuals: CategoryEvent[] = [];
  // Commitments: what the team has agreed to pay, on the day it falls due, paid or not.
  const gridScheduled: CategoryEvent[] = [];
  // Per-cell drill-in detail, keyed `${categoryKey}|${YYYY-MM}` — the read panels behind an
  // Actual or Scheduled cell. Already-loaded rows, so no extra query.
  const cellDetails: Record<string, Array<{ id: string; description: string; date: string | null; amount: number; paid: boolean }>> = {};
  function pushDetail(kind: 'actual' | 'scheduled', category: string | null, date: string | null, item: { id: string; description: string; amount: number; paid: boolean }) {
    const m = monthKeyOf(date);
    if (!m) return;
    const key = `${kind}|${(category ?? '').trim().toLowerCase()}|${m}`;
    (cellDetails[key] ??= []).push({ ...item, date });
  }

  for (const exp of expenses) {
    const cat = placedFor(exp).categoryName;
    const id = exp.id as string;
    const description = exp.description as string;

    if (exp.expense_type === 'tournament_payable') {
      const dep = (exp.deposit_amount as number | null) ?? 0;
      const bal = (exp.balance_amount as number | null) ?? 0;
      if (dep > 0 && exp.deposit_due_date) {
        gridScheduled.push({ categoryName: cat, date: exp.deposit_due_date as string, amount: dep });
        pushDetail('scheduled', cat, exp.deposit_due_date as string, { id: `${id}-deposit`, description: `${description} — deposit`, amount: dep, paid: !!exp.deposit_paid_at });
      }
      if (bal > 0 && exp.balance_due_date) {
        gridScheduled.push({ categoryName: cat, date: exp.balance_due_date as string, amount: bal });
        pushDetail('scheduled', cat, exp.balance_due_date as string, { id: `${id}-balance`, description: `${description} — balance`, amount: bal, paid: !!exp.balance_paid_at });
      }
      if (exp.deposit_paid_at && dep > 0) {
        gridActuals.push({ categoryName: cat, date: exp.deposit_paid_at as string, amount: dep });
        pushDetail('actual', cat, exp.deposit_paid_at as string, { id: `${id}-deposit`, description: `${description} — deposit`, amount: dep, paid: true });
      }
      if (exp.balance_paid_at && bal > 0) {
        gridActuals.push({ categoryName: cat, date: exp.balance_paid_at as string, amount: bal });
        pushDetail('actual', cat, exp.balance_paid_at as string, { id: `${id}-balance`, description: `${description} — balance`, amount: bal, paid: true });
      }
    } else if (exp.expense_paid_at) {
      const amt = exp.amount as number;
      gridActuals.push({ categoryName: cat, date: exp.expense_paid_at as string, amount: amt });
      pushDetail('actual', cat, exp.expense_paid_at as string, { id, description, amount: amt, paid: true });
    }
  }

  // Prior season — the comparison column. Only the most recent earlier year, and only when it
  // actually has lines; rollover already carries lines + periods forward, so a year-2+ team has
  // this for free and a first-season team correctly gets nothing.
  const { data: priorYearRow } = await supabaseAdmin
    .from('rep_program_years')
    .select('id, year, name')
    .eq('team_id', teamId)
    .lt('year', programYear.year)
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();

  let priorLines: PriorLine[] = [];
  if (priorYearRow) {
    const { data: priorRows } = await supabaseAdmin
      .from('rep_budget_lines')
      .select('description, item_id, total_amount, budget_categories(name)')
      .eq('program_year_id', priorYearRow.id as string);
    priorLines = (priorRows ?? []).map((r: Record<string, unknown>) => ({
      description:  r.description as string,
      itemId:       (r.item_id as string | null) ?? null,
      itemName:     null,
      categoryName: ((r.budget_categories as Record<string, unknown> | null)?.name as string) ?? 'Uncategorized',
      totalAmount:  r.total_amount as number,
    }));
  }

  // The optional ESTIMATED total reconciled against the itemized sum. ⚠ Owner ruling 2026-08-12:
  // the estimate wins whenever it is set, in BOTH directions — it used to be max(itemized,
  // estimate), which kept a lower estimate in the database and then ignored it. One shared module
  // decides this for the planner, the Money hub and this report, because when all three did it
  // inline they were one edit away from disagreeing on the same screen. Computed HERE rather than
  // with headroom below, because the month grid needs the un-itemized part too.
  const budgetTotals = computeBudgetTotals({
    lines: allLines.map(l => ({
      totalAmount: (l.total_amount as number) ?? 0,
      lineKind: normalizeBudgetLineKind(l.line_kind as string | null),
    })),
    estimatedTotal: programYear.budgetAmount ?? null,
  });
  const seasonTotal = budgetTotals.estimatedTotal;
  const effectiveBudget = budgetTotals.totalPlanned;
  // The month grid's own "not itemized yet" row: only the POSITIVE case is money the grid can
  // stand in for. When the lines have outgrown the estimate there is nothing unallocated to show,
  // and a negative pseudo-row in a month grid would read as a refund.
  const buffer = Math.max(0, budgetTotals.difference);

  const monthGrid = buildMonthGrid({
    lines: gridLines,
    actuals: gridActuals,
    scheduled: gridScheduled,
    priorLines,
    todayMonth,
    bufferAmount: buffer,
  });

  // ── 9. Expected funding vs what the team actually kept ───────────────────
  // Owner ruling 2026-08-12: the actual against an expected-funding line is the TEAM'S SHARE —
  // everything raised, less whatever was rebated to the player who raised it. A rebate lowers
  // that player's own dues, so counting it here would lower the same dues twice.
  // ONE round trip, not two: the entries are read through their parent fundraiser rather than
  // fetching the campaign ids first and then filtering by them. This route already runs a long
  // serial chain of awaits; a second hop at the tail of it buys nothing.
  // ⚠ RECEIPTS ONLY. A pledged sponsor's entry exists the moment it is recorded, but nothing has
  // arrived — counting it here reported a $2,000 pledge as $2,000 of actual sponsorship against
  // the plan, which is a report telling a coach they hit a number they have not (review,
  // 2026-08-15). Migration 237 states this rule; the shared reader is where it is enforced.
  let fundingActual = 0;
  if (fundingLines.length > 0) {
    for (const en of await getRealisedFundraiserEntries(programYear.id)) {
      fundingActual += en.amountRaised - en.rebateAmount;
    }
  }
  const funding = fundingLines.length === 0 ? null : {
    budget: budgetTotals.expectedFunding,
    actual: Math.round(fundingActual * 100) / 100,
    lines: fundingLines.map(l => ({
      id:          l.id as string,
      description: l.description as string,
      amount:      (l.total_amount as number) ?? 0,
    })),
    fundedByPlayers: budgetTotals.fundedByPlayers,
  };

  // Money IN by month, both bases. The cash-flow strip pairs whichever of these matches the lens
  // the coach is reading with that lens's money-out — never a blend of plan and commitment.
  // Dues only, deliberately: fundraiser rebates CREDIT dues, so counting both would double-count
  // the same dollar. The strip says so on screen.
  const duesInScheduled: Record<string, number> = {};
  const duesInActual: Record<string, number> = {};
  for (const i of duesInstallments) {
    const amt = i.amount ?? 0;
    if (!amt) continue;
    const due = monthKeyOf(i.due_date);
    if (due) duesInScheduled[due] = Math.round(((duesInScheduled[due] ?? 0) + amt) * 100) / 100;
  }
  // ACTUAL is the receipt book, not the stamp: each payment lands in the month the money ARRIVED
  // (mig 232, owner ruling 3). Under the old model a coach catching up on a month of e-transfers
  // put them all in "today's" month, and a part-payment appeared in no month at all.
  for (const p of duesPayments) {
    const amt = p.amount ?? 0;
    if (!amt) continue;
    const m = monthKeyOf(p.receivedDate);
    if (m) duesInActual[m] = Math.round(((duesInActual[m] ?? 0) + amt) * 100) / 100;
  }

  // ── 10. Headroom ──────────────────────────────────────────────────────
  // Measured against the EFFECTIVE budget (see above, where it is reconciled) so this report,
  // the Money hub, and the budget planner always agree.
  /* ⚠ EVERY PAID DOLLAR IS NOW INSIDE A CATEGORY ROW, including the unplanned ones — the rollup
     gives spending on an unbudgeted item its own row rather than a separate list. So the season's
     actual is the categories' sum and nothing is added on top; `unbudgeted` is reported as its own
     figure for the screen to name, NOT as a second addend. Adding it again here would double-count
     precisely the spending this change set out to make visible. */
  const totalActual  = Math.round(categoryResults.reduce((s, c) => s + c.actual, 0) * 100) / 100;
  const unbudgeted   = Math.round(unbudgetedActuals.reduce((s, u) => s + u.amount, 0) * 100) / 100;
  const headroom     = Math.round((effectiveBudget - totalActual) * 100) / 100;

  return NextResponse.json({
    headroom,
    totalBudget:     Math.round(totalBudget * 100) / 100,
    seasonTotal,
    effectiveBudget,
    buffer,
    /** Signed, so a report can say "over your estimate" rather than showing nothing. */
    estimateDifference: budgetTotals.difference,
    overPlanned:        budgetTotals.overPlanned,
    /** Null when the team budgets no funding — the row simply isn't there. */
    funding,
    // Already whole (see §10): the categories now hold every paid dollar, planned or not.
    totalActual,
    /* ⚠ SENT WITHOUT THE RAW LINES AND COSTS BEHIND EACH ROW. The rollup carries them because the
       PLAN page uses them (it calls the same function locally to render editable lines), but this
       report renders neither — shipping them would put two full arrays of raw records on every item
       row of a season's report for nothing. The unbudgeted list below is already extracted from
       them server-side. */
    categories:    categoryResults.map(cat => ({
      ...cat,
      items: cat.items.map(({ lines: _lines, costs: _costs, costCount: _costCount, ...item }) => item),
    })),
    /** How much of `totalActual` went on items nobody planned — a figure to NAME, never to add. */
    unbudgeted,
    unbudgetedActuals,
    duesCollection,
    monthlyChart,
    // Named so the chart can state what it is NOT plotting, rather than smearing it (D-H4).
    undatedBudget,
    // ── chunk H ──
    monthGrid,
    cellDetails,
    moneyIn: { scheduled: duesInScheduled, actual: duesInActual },
    todayMonth,
    // Short enough to be a column header on a phone; the full season name is not.
    priorSeasonLabel: priorLines.length > 0 && priorYearRow ? String(priorYearRow.year) : null,
    // Only tags actually used by this year's expenses head the filter row (not the whole library).
    expenseTags: expenseTags.filter(t => new Set(Object.values(tagsByExpenseId).flat()).has(t.id)),
    activeTagId: filterTagId,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual' });
