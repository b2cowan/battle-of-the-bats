import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { readClubPlan } from '@/lib/club-budget-read';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { fiscalYearOf } from '@/lib/club-fiscal-year';

/**
 * GET /api/admin/accounting/bill-from?orgSlug= — New allocation's "Bill from", the door from the Allocations tab
 * (Club Tier Stage 3c, Ask 6; specimen 6). The OPEN fiscal year's (the one today falls in) COST lines that still
 * have something left to allocate, each with what is left (Not allocated — the one definition), plus the off-plan
 * choice: a bill with no line, which counts in the year its first payment falls due.
 * → 200 `{ year: { key, name }, lines: [{ id, description, categoryName, itemName, planned, allocated, left }],
 *   offPlan: true }`. Empty `lines` on a year with no plan, or nothing left on it. A closed year never offers a line
 * (the year today falls in is never closed — a year closes only once it has ended).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;
  const today = tournamentToday();
  const setting = await loadFiscalSetting(ctx.org.id);
  const year = fiscalYearOf(today, setting);
  const plan = await readClubPlan(ctx.org.id, year, setting, today, teamIdsInScope(ctx));
  const lines = year.locked ? [] : plan.expenses.categories.flatMap(c => c.lines
    .filter(l => (l.notAllocated ?? 0) > 0.005)
    .map(l => ({
      id: l.id, description: l.description, categoryName: c.categoryName, itemName: l.itemName,
      planned: l.planned, allocated: l.allocated ?? 0, left: l.notAllocated ?? 0,
    })));
  return NextResponse.json({ year: { key: year.key, name: year.name }, lines, offPlan: true });
}, { route: '/api/admin/accounting/bill-from' });
