import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { loadClubLoop, teamsWithTheClub } from '@/lib/club-money-reads';
import { tournamentToday } from '@/lib/timezone';

/**
 * GET /api/admin/accounting/teams?orgSlug= — the Overview's "Held by the teams" list (Ask 5a):
 * per team, what it owes the club (Outstanding), Next due, Overdue, Sent, and requests waiting.
 * The club's own records only — the team's cash is the coaches' (D1; 3b's per-team read).
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const today = tournamentToday();
  const loop = await loadClubLoop(ctx.org.id, await teamIdsInScope(ctx));
  return NextResponse.json({ asOf: today, teams: await teamsWithTheClub(ctx.org.id, loop, today) });
}, { route: '/api/admin/accounting/teams' });
