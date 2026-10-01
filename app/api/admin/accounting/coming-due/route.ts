import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { comingDue, loadClubLoop } from '@/lib/club-money-reads';
import { loadHeadCoaches } from '@/lib/club-team-board';
import { resolvePersonNamer } from '@/lib/db';
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
  const due = comingDue(loop, today);
  // The row's second line: who the club chases (the head coach, or "no head coach yet"), and for a
  // sent payment who said so — names, never ids.
  const all = [...Object.values(due.bands), due.later].flatMap(b => b.groups.flatMap(g => g.teams));
  const [heads, nameOf] = await Promise.all([
    loadHeadCoaches(ctx.org.id, [...new Set(all.map(t => t.teamId))]),
    resolvePersonNamer(ctx.org.id, all.map(t => t.sentBy)),
  ]);
  const named = (b: typeof due.later) => ({
    ...b,
    groups: b.groups.map(g => ({
      ...g,
      teams: g.teams.map(t => ({
        ...t,
        sentBy: nameOf(t.sentBy),
        headCoach: (heads.get(t.teamId)?.people ?? []).map(p => p.name ?? p.email).filter((n): n is string => !!n)[0] ?? null,
      })),
    })),
  });
  return NextResponse.json({
    asOf: today,
    windowDays: COMING_DUE_DAYS,
    bands: { overdue: named(due.bands.overdue), sent: named(due.bands.sent), due_soon: named(due.bands.due_soon) },
    later: named(due.later),
    activeTeams: [...loop.teams.values()].filter(t => !t.isArchived).length,
  });
}, { route: '/api/admin/accounting/coming-due' });
