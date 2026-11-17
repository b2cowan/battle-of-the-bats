import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { allocationYears, loadClubLoop, teamsWithTheClub, yearBills } from '@/lib/club-money-reads';
import { tournamentToday } from '@/lib/timezone';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { fiscalYearOf } from '@/lib/club-fiscal-year';
import { carriedByTeam } from '@/lib/club-team-needs';

/**
 * GET /api/admin/accounting/teams?orgSlug= — each team's standing with the club, every year (Ask 5a): per team, its
 * group, what it owes the club (Outstanding), Next due, Overdue, Sent, and requests waiting. Read by Rep Teams' board
 * and by a team's account's Team pill (Club Accounting · Teams, Ask 2 — `groupName` for its headings).
 * The club's own records only — the team's cash is the coaches' (D1; 3b's per-team read).
 * 13e B5 (ask 13e-7 A): `?carried=1` (Rep Teams' board only; the Team pill never reads it) adds `carried`: of each team's
 * every-year Outstanding, what is from a year before today's (`carriedByTeam` over `allocationYears`, the year rule a team's
 * account reads too), so the column can say what it includes.
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const today = tournamentToday();
  const loop = await loadClubLoop(ctx.org.id, await teamIdsInScope(ctx));
  if (new URL(req.url).searchParams.get('carried') !== '1') {
    return NextResponse.json({ asOf: today, teams: await teamsWithTheClub(ctx.org.id, loop, today) });
  }
  const [teams, carried] = await Promise.all([
    teamsWithTheClub(ctx.org.id, loop, today),
    // Words on a figure, never the figure: a failed read here drops the caption, not the Outstanding column (/review).
    loadFiscalSetting(ctx.org.id).then(async setting => carriedByTeam(
      yearBills(loop, await allocationYears(ctx.org.id, loop, setting, loop.splits.filter(sp => sp.installments.some(i => !i.paidAt)).map(sp => sp.allocationId))), fiscalYearOf(today, setting).key, today))
      .catch(() => new Map<string, never>()),
  ]);
  return NextResponse.json({ asOf: today, teams: teams.map(t => ({ ...t, carried: carried.get(t.teamId) ?? null })) });
}, { route: '/api/admin/accounting/teams' });
