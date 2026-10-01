import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { comingDue, loadClubLoop } from '@/lib/club-money-reads';
import { COMING_DUE_DAYS } from '@/lib/club-money-figures';
import { tournamentToday } from '@/lib/timezone';

/**
 * GET /api/admin/accounting/coming-due?orgSlug= — Allocations › Coming due (specimen 2): who owes
 * what, when, team by team, in three bands — overdue · sent, waiting for you to confirm · due in the
 * next 14 days (the Overview brief's own window). It replaces the Rep Teams board's Upcoming bills
 * read (`/api/admin/rep-teams/upcoming-payables`, on session 2's retire list).
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const today = tournamentToday();
  const loop = await loadClubLoop(ctx.org.id, await teamIdsInScope(ctx));
  return NextResponse.json({ asOf: today, windowDays: COMING_DUE_DAYS, ...comingDue(loop, today) });
}, { route: '/api/admin/accounting/coming-due' });
