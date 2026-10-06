/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚰ RETIRES IN CLUB TIER STAGE 3b SESSION 2 — WITH THE OLD BUDGET, ALLOCATE AND BUDGET VS. ACTUAL PAGES.
 *
 * The server half (session 1) changed the two routes those pages read to the new shapes (`plan`,
 * `report`). Until session 2 replaces the pages, each route ALSO returns the handful of old fields the
 * pages read, mapped from the new figures — so nothing dead-ends between the sessions (3a's interim
 * rule, memory `reference_server_meaning_change_breaks_live_screen`). Nothing here computes a figure:
 * every number is one the new module already produced. Delete this file, and the two `...legacy…`
 * spreads in the routes, in the same change that deletes the old pages.
 *
 * Pure and client-safe.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { ClubPlan, ClubReport, PlanCategory, PlanLineRow } from './club-budget-report';

function legacyLine(l: PlanLineRow) {
  const teams = new Set(l.allocations.flatMap(a => a.teamNames));
  return {
    id: l.id,
    description: l.description,
    totalAmount: l.planned,
    notes: l.notes,
    sortOrder: l.sortOrder,
    categoryId: l.categoryId,
    itemId: l.itemId,
    itemName: l.itemName,
    createdAt: l.updatedAt,
    updatedAt: l.updatedAt,
    periods: l.periods.map(p => ({ id: p.id ?? `${l.id}:${p.sortOrder}`, label: p.label, periodDate: p.date, amount: p.amount, sortOrder: p.sortOrder })),
    // The old page knew one allocation per line; it now reads the line's whole Allocated (C11).
    allocation: l.allocations.length === 0 ? null : {
      id: l.allocations[0].id,
      // Named teams in the reader's groups, plus those counted outside them (B11).
      teamCount: teams.size + l.allocations.reduce((n, x) => n + x.otherTeams, 0),
      totalAllocated: l.allocated ?? 0,
      collected: l.collected ?? 0,
      outstanding: l.outstanding ?? 0,
    },
    notAllocated: l.notAllocated ?? 0,
  };
}

function legacyGroups(cats: readonly PlanCategory[]) {
  const named = cats.filter(c => c.categoryId);
  return {
    categories: named.map((c, i) => ({ id: c.categoryId!, name: c.categoryName, sortOrder: i, lines: c.lines.map(legacyLine) })),
    uncategorized: cats.filter(c => !c.categoryId).flatMap(c => c.lines.map(legacyLine)),
  };
}

/** The old Budget and Allocate pages' fields, from the plan. */
export function legacyPlanFields(plan: ClubPlan, years: readonly number[]) {
  return {
    availableYears: years,
    summary: {
      totalBudgeted: plan.expenses.total,
      totalAllocated: plan.expenses.allocated,
      totalCollected: plan.expenses.collected,
      orgHeadroom: plan.expenses.notAllocated,
    },
    ...legacyGroups([...plan.revenue.categories, ...plan.expenses.categories]),
  };
}

/** The old Budget vs. Actual page's fields, from the plan and the report. Team health has left this
 *  read (S3B-05): the old page's team cards read an empty list until the page itself goes. */
export function legacyReportFields(plan: ClubPlan, report: ClubReport, years: readonly number[]) {
  const groups = legacyGroups(plan.expenses.categories);
  const bvaLine = (l: ReturnType<typeof legacyLine>) => ({
    budgetLineId: l.id,
    description: l.description,
    estimated: l.totalAmount,
    allocated: l.allocation?.totalAllocated ?? 0,
    collected: l.allocation?.collected ?? 0,
    outstanding: l.allocation?.outstanding ?? 0,
    unallocated: l.notAllocated,
    allocationId: l.allocation?.id ?? null,
    teamCount: l.allocation?.teamCount ?? 0,
    periods: l.periods,
  });
  const expenseCosts = report.statement.expenses.categories.flatMap(c => c.items.flatMap(i => i.costs));
  return {
    availableYears: years,
    summary: {
      totalBudgeted: plan.expenses.total,
      totalOrgExpenses: report.band.spent.amount,
      totalAllocated: plan.expenses.allocated,
      totalCollected: plan.expenses.collected,
      headroom: report.headroom,
    },
    categories: groups.categories.map((c, i) => {
      const src = plan.expenses.categories.find(x => x.categoryId === c.id)!;
      return {
        id: c.id, name: c.name, sortOrder: i,
        totalEstimated: src.planned, totalAllocated: src.allocated ?? 0, totalCollected: src.collected ?? 0,
        lines: c.lines.map(bvaLine),
      };
    }),
    uncategorized: groups.uncategorized.map(bvaLine),
    orgActuals: {
      total: report.band.spent.amount,
      entries: [...expenseCosts].sort((a, b) => (b.paidDate ?? '').localeCompare(a.paidDate ?? '')).map(c => ({
        entryId: c.id, description: c.description, amount: c.amount, entryDate: c.paidDate ?? '',
        ledgerName: report.lineBooks[c.id]?.bookName ?? '',
      })),
    },
    teamHealth: [] as never[],
  };
}
