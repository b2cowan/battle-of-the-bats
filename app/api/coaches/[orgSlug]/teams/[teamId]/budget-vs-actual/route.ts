import { NextResponse } from 'next/server';
import {
  getRepTeamTagLibrary, getRepTeamExpenseTagsMap,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';
import {
  buildMonthGrid, monthKeyOf,
  type CategoryEvent, type GridLine, type PriorLine,
} from '@/lib/coach-budget-months';
import { computeBudgetTotals } from '@/lib/coach-budget-totals';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';

// GET /api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual
//
// Returns a full budget-vs-actual report for the active program year.
// Actuals are matched to budget categories by expense.category name (case-insensitive).
// Period actuals are assigned by comparing expense.expense_paid_at to period_date ranges.
// Unbudgeted actuals are expenses whose category doesn't match any budget category name.
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
    .select('*, rep_budget_periods(*), budget_categories(name)')
    .eq('program_year_id', programYear.id)
    .order('sort_order');

  const allLines = (linesRaw ?? []) as Array<Record<string, unknown>>;
  // ⚠ EXPECTED-FUNDING LINES ARE NOT COSTS and must never enter the cost machinery below: this
  // report matches actual expenses to a line by category NAME, so a funding line filed under
  // "Fundraising" would sit waiting to absorb a real expense that happened to carry that word —
  // and would inflate the budget it is supposed to offset. They get their own block (§8b).
  const lines = allLines.filter(l => l.line_kind !== 'funding');
  const fundingLines = allLines.filter(l => l.line_kind === 'funding');

  // ── 2. Load expenses (paid and unpaid) ───────────────────────────────────
  const { data: expensesRaw } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('id, description, category, amount, expense_paid_at, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, expense_type, created_at')
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

  // ── 3. Build category → lines map ────────────────────────────────────────
  // Key: lowercase category name. Value: list of budget line objects.
  const categoryNameMap = new Map<string, string>();  // lowercase name → display name
  const categoryLines   = new Map<string, typeof lines>();

  for (const line of lines) {
    const catName = ((line.budget_categories as Record<string, unknown> | null)?.name as string) ?? 'Uncategorized';
    const key     = catName.toLowerCase();
    categoryNameMap.set(key, catName);
    if (!categoryLines.has(key)) categoryLines.set(key, []);
    categoryLines.get(key)!.push(line);
  }

  // ── 4. Assign expenses to categories ─────────────────────────────────────
  const categoryActuals = new Map<string, number>(); // lowercase cat name → paid amount
  const unbudgetedActuals: Array<{
    id: string; description: string; category: string | null; amount: number; paidAt: string | null;
  }> = [];

  for (const exp of expenses) {
    const expCat = ((exp.category as string | null) ?? '').toLowerCase();
    const paid   = paidAmount(exp);

    if (paid <= 0) continue; // only include paid amounts in actuals

    if (expCat && categoryNameMap.has(expCat)) {
      categoryActuals.set(expCat, (categoryActuals.get(expCat) ?? 0) + paid);
    } else {
      unbudgetedActuals.push({
        id:          exp.id as string,
        description: exp.description as string,
        category:    exp.category as string | null,
        amount:      paid,
        paidAt:      paidDate(exp),
      });
    }
  }

  // ── 5. Build period actuals ────────────────────────────────────────────
  // For each category, assign paid expenses to periods using period_date ranges.
  // Periods are sorted ascending; each period owns expenses paid up to its period_date.
  function buildPeriodActuals(
    catKey: string,
    periods: Array<{ period_date: string | null; period_label: string; amount: number; sort_order: number }>,
  ): number[] {
    // Expenses in this category, with paid dates
    const catExpenses = expenses
      .filter(e => ((e.category as string | null) ?? '').toLowerCase() === catKey && paidAmount(e) > 0)
      .map(e => ({ date: paidDate(e), amount: paidAmount(e) }));

    if (periods.length === 0 || catExpenses.length === 0) return periods.map(() => 0);

    // Sort periods by date (nulls last)
    const sorted = [...periods].sort((a, b) => {
      if (!a.period_date && !b.period_date) return a.sort_order - b.sort_order;
      if (!a.period_date) return 1;
      if (!b.period_date) return -1;
      return a.period_date.localeCompare(b.period_date);
    });

    const actuals = new Array(sorted.length).fill(0);

    for (const exp of catExpenses) {
      if (!exp.date) { actuals[actuals.length - 1] += exp.amount; continue; }
      // Find the first period whose date >= expense date
      let assigned = false;
      for (let i = 0; i < sorted.length; i++) {
        if (!sorted[i].period_date || sorted[i].period_date! >= exp.date) {
          actuals[i] += exp.amount;
          assigned = true;
          break;
        }
      }
      if (!assigned) actuals[actuals.length - 1] += exp.amount;
    }

    // Map back to original order
    const originalIndexMap = periods.map(p =>
      sorted.findIndex(s => s.period_label === p.period_label && s.period_date === p.period_date)
    );
    return originalIndexMap.map(i => actuals[i] ?? 0);
  }

  // ── 6. Build category result objects ────────────────────────────────────
  const categoryResults = [...categoryLines.entries()].map(([key, catLines]) => {
    const categoryName     = categoryNameMap.get(key) ?? key;
    const categoryActual   = Math.round((categoryActuals.get(key) ?? 0) * 100) / 100;
    const categoryEstimated = catLines.reduce((s, l) => s + (l.total_amount as number), 0);
    const categoryVariance  = Math.round((categoryEstimated - categoryActual) * 100) / 100;

    const lineResults = catLines.map(line => {
      const rawPeriods = ((line.rep_budget_periods ?? []) as Array<Record<string, unknown>>)
        .sort((a, b) => (a.sort_order as number) - (b.sort_order as number));

      const periodActuals = buildPeriodActuals(
        key,
        rawPeriods.map(p => ({
          period_date:  p.period_date as string | null,
          period_label: p.period_label as string,
          amount:       p.amount as number,
          sort_order:   p.sort_order as number,
        })),
      );

      return {
        budgetLineId:   line.id as string,
        description:    line.description as string,
        totalEstimated: line.total_amount as number,
        hasPeriods:     rawPeriods.length > 0,
        periods:        rawPeriods.map((p, i) => ({
          label:      p.period_label as string,
          periodDate: p.period_date as string | null,
          estimated:  p.amount as number,
          actual:     Math.round(periodActuals[i] * 100) / 100,
        })),
      };
    });

    return {
      categoryName,
      categoryEstimated: Math.round(categoryEstimated * 100) / 100,
      categoryActual,
      categoryVariance,
      lines: lineResults,
    };
  });

  // ── 7. Dues collection summary ────────────────────────────────────────
  const { data: schedules } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, total_amount')
    .eq('program_year_id', programYear.id);

  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);
  const expectedDues = (schedules ?? []).reduce(
    (s: number, r: { total_amount: number }) => s + (r.total_amount ?? 0), 0,
  );

  // Every installment, not just the paid ones: the paid side is the dues-collection card (below)
  // and the money-in half of the month grid's cash-flow strip; the due dates are the SCHEDULED
  // half of it ("what lands in July if everyone pays on time").
  let collectedDues = 0;
  let duesInstallments: Array<{ amount: number; due_date: string | null; paid_at: string | null }> = [];
  if (scheduleIds.length > 0) {
    const { data: inst } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('amount, due_date, paid_at')
      .in('schedule_id', scheduleIds);
    duesInstallments = (inst ?? []) as typeof duesInstallments;
    collectedDues = duesInstallments
      .filter(r => r.paid_at)
      .reduce((s, r) => s + (r.amount ?? 0), 0);
  }

  const duesCollection = {
    expected:    Math.round(expectedDues    * 100) / 100,
    collected:   Math.round(collectedDues   * 100) / 100,
    outstanding: Math.round((expectedDues - collectedDues) * 100) / 100,
  };

  // ── 8. Monthly chart data ─────────────────────────────────────────────
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

  // ── 8b. The month grid (chunk H) ───────────────────────────────────────
  // Rows = category → line, columns = the season's months, one payload serving all four lenses
  // (Budget · Scheduled · Actual · Difference) so flipping a lens never refetches. The arithmetic
  // lives in lib/coach-budget-months.ts and is unit-tested; this block is the assembly half.
  const todayMonth = tournamentToday().slice(0, 7); // ORG timezone — never the runtime's UTC month

  const gridLines: GridLine[] = lines.map(l => ({
    id:            l.id as string,
    description:   l.description as string,
    categoryName:  ((l.budget_categories as Record<string, unknown> | null)?.name as string) ?? 'Uncategorized',
    itemId:        (l.item_id as string | null) ?? null,
    itemName:      null, // the grid's select doesn't join budget_items; description carries the name
    totalAmount:   l.total_amount as number,
    periods:       ((l.rep_budget_periods ?? []) as Array<Record<string, unknown>>)
      .map(p => ({ date: p.period_date as string | null, amount: p.amount as number })),
  }));

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
    const cat = exp.category as string | null;
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
      lineKind: l.line_kind === 'funding' ? 'funding' : 'cost',
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

  // ── 8b. Expected funding vs what the team actually kept ──────────────────
  // Owner ruling 2026-08-12: the actual against an expected-funding line is the TEAM'S SHARE —
  // everything raised, less whatever was rebated to the player who raised it. A rebate lowers
  // that player's own dues, so counting it here would lower the same dues twice.
  // ONE round trip, not two: the entries are read through their parent fundraiser rather than
  // fetching the campaign ids first and then filtering by them. This route already runs a long
  // serial chain of awaits; a second hop at the tail of it buys nothing.
  let fundingActual = 0;
  if (fundingLines.length > 0) {
    const { data: entries } = await supabaseAdmin
      .from('rep_fundraiser_entries')
      .select('amount_raised, rebate_amount, rep_fundraisers!inner(program_year_id)')
      .eq('rep_fundraisers.program_year_id', programYear.id);
    for (const en of (entries ?? []) as Array<{ amount_raised: number; rebate_amount: number }>) {
      fundingActual += (en.amount_raised ?? 0) - (en.rebate_amount ?? 0);
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
    const paid = monthKeyOf(i.paid_at);
    if (paid) duesInActual[paid] = Math.round(((duesInActual[paid] ?? 0) + amt) * 100) / 100;
  }

  // ── 9. Headroom ───────────────────────────────────────────────────────
  // Measured against the EFFECTIVE budget (see above, where it is reconciled) so this report,
  // the Money hub, and the budget planner always agree.
  const totalActual  = Math.round(categoryResults.reduce((s, c) => s + c.categoryActual, 0) * 100) / 100;
  const unbudgeted   = Math.round(unbudgetedActuals.reduce((s, u) => s + u.amount, 0) * 100) / 100;
  const headroom     = Math.round((effectiveBudget - totalActual - unbudgeted) * 100) / 100;

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
    totalActual:   Math.round((totalActual + unbudgeted) * 100) / 100,
    categories:    categoryResults,
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
