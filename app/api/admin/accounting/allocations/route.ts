import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { allocationListRows, loadClubLoop } from '@/lib/club-money-reads';
import { tournamentToday } from '@/lib/timezone';
import { allocationsOf } from '@/lib/club-budget-read';
import { allocationYearKey } from '@/lib/club-budget-report';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { fiscalYearOf } from '@/lib/club-fiscal-year';

/**
 * GET /api/admin/accounting/allocations?orgSlug= — Accounting › Allocations, "By allocation"
 * (Club Tier Stage 3a, specimen 2). Each allocation with its teams in words, Allocated, and the ONE
 * definition of Collected / Outstanding / Overdue / Next due / Sent (lib/club-money-figures.ts),
 * plus its state chip. A member limited to some groups sees those teams' share only.
 *
 * ⚖ Stage 3c: each row carries `year` = { key, name, locked } — the FISCAL year it counts in (its line's; without
 * one, its first installment's), read through the one definition. It replaces the screen's "This year" worked out
 * from each allocation's creation stamp in UTC (S3C-01): session 2 groups and totals by this.
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const today = tournamentToday();
  const [loop, setting] = await Promise.all([
    teamIdsInScope(ctx).then(scope => loadClubLoop(ctx.org.id, scope)),
    loadFiscalSetting(ctx.org.id),
  ]);
  const facts = new Map((await allocationsOf(ctx.org.id, loop, setting)).map(a => [a.id, a] as const));
  const allocations = allocationListRows(loop, today).map(row => {
    const a = facts.get(row.id);
    const y = fiscalYearOf(a ? allocationYearKey(a, setting) : today, setting);
    return { ...row, year: { key: y.key, name: y.name, locked: y.locked } };
  });
  return NextResponse.json({ asOf: today, allocations });
}, { route: '/api/admin/accounting/allocations' });
