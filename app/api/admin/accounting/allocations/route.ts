import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { allocationListRows, loadClubLoop } from '@/lib/club-money-reads';
import { tournamentToday } from '@/lib/timezone';

/**
 * GET /api/admin/accounting/allocations?orgSlug= — Accounting › Allocations, "By allocation"
 * (Club Tier Stage 3a, specimen 2). Each allocation with its teams in words, Allocated, and the ONE
 * definition of Collected / Outstanding / Overdue / Next due / Sent (lib/club-money-figures.ts),
 * plus its state chip. A member limited to some groups sees those teams' share only.
 *
 * Creating an allocation stays on its existing door (today's form, unchanged in 3a).
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const today = tournamentToday();
  const loop = await loadClubLoop(ctx.org.id, await teamIdsInScope(ctx));
  return NextResponse.json({ asOf: today, allocations: allocationListRows(loop, today) });
}, { route: '/api/admin/accounting/allocations' });
