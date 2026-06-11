import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === teamId)) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, programYear };
}

// Derive YYYY-MM key from a date string or timestamp
function toMonthKey(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return dateStr.slice(0, 7);
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual
//
// Returns a full budget-vs-actual report for the active program year.
// Actuals are matched to budget categories by expense.category name (case-insensitive).
// Period actuals are assigned by comparing expense.expense_paid_at to period_date ranges.
// Unbudgeted actuals are expenses whose category doesn't match any budget category name.
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

  // ── 1. Load budget lines + periods ──────────────────────────────────────
  const { data: linesRaw } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('*, rep_budget_periods(*), budget_categories(name)')
    .eq('program_year_id', programYear.id)
    .order('sort_order');

  const lines = (linesRaw ?? []) as Array<Record<string, unknown>>;

  // ── 2. Load expenses (paid and unpaid) ───────────────────────────────────
  const { data: expensesRaw } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('id, description, category, amount, expense_paid_at, deposit_amount, deposit_due_date, deposit_paid_at, balance_amount, balance_due_date, balance_paid_at, expense_type, created_at')
    .eq('program_year_id', programYear.id)
    .order('created_at');

  const expenses = (expensesRaw ?? []) as Array<Record<string, unknown>>;

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

  let collectedDues = 0;
  if (scheduleIds.length > 0) {
    const { data: paidInst } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('amount')
      .in('schedule_id', scheduleIds)
      .not('paid_at', 'is', null);
    collectedDues = (paidInst ?? []).reduce(
      (s: number, r: { amount: number }) => s + (r.amount ?? 0), 0,
    );
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
      const m = toMonthKey(p.period_date as string | null);
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
      const m = toMonthKey(p.period_date as string | null);
      if (m) budgetByMonth.set(m, (budgetByMonth.get(m) ?? 0) + (p.amount as number));
    }
  }

  // Lines without any period_date get distributed across months evenly
  // (simplification: attribute to first available month or skip if no months)
  const totalBudget = lines.reduce((s, l) => s + (l.total_amount as number), 0);
  const periodedBudget = [...budgetByMonth.values()].reduce((s, v) => s + v, 0);
  const unperiodedBudget = totalBudget - periodedBudget;
  if (unperiodedBudget > 0 && months.length > 0) {
    const share = unperiodedBudget / months.length;
    for (const m of months) budgetByMonth.set(m, (budgetByMonth.get(m) ?? 0) + share);
  }

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

  // ── 9. Headroom ───────────────────────────────────────────────────────
  const totalActual  = Math.round(categoryResults.reduce((s, c) => s + c.categoryActual, 0) * 100) / 100;
  const unbudgeted   = Math.round(unbudgetedActuals.reduce((s, u) => s + u.amount, 0) * 100) / 100;
  const headroom     = Math.round((totalBudget - totalActual - unbudgeted) * 100) / 100;

  return NextResponse.json({
    headroom,
    totalBudget:   Math.round(totalBudget * 100) / 100,
    totalActual:   Math.round((totalActual + unbudgeted) * 100) / 100,
    categories:    categoryResults,
    unbudgetedActuals,
    duesCollection,
    monthlyChart,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual' });
