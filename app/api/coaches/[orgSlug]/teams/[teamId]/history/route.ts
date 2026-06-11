import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getRepTeamHistory,
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  getRepTeamExpenses,
} from '@/lib/db';
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
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  return { ctx, team, assignment };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;

  const history = await getRepTeamHistory(teamId);

  // Build an accounting summary per year
  const summaries = await Promise.all(
    history.map(async y => {
      const schedules = await getRepPlayerDuesSchedules(y.id);
      let duesCollected = 0;
      let duesOutstanding = 0;
      for (const s of schedules) {
        const installments = await getRepPlayerDuesInstallments(s.id);
        for (const i of installments) {
          if (i.paidAt) duesCollected += i.amount;
          else duesOutstanding += i.amount;
        }
      }
      const expenses = await getRepTeamExpenses(y.id);
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      return { yearId: y.id, duesCollected, duesOutstanding, totalExpenses };
    }),
  );

  const summaryMap = new Map(summaries.map(s => [s.yearId, s]));

  return NextResponse.json({
    history: history.map(y => ({
      ...y,
      accounting: summaryMap.get(y.id) ?? { duesCollected: 0, duesOutstanding: 0, totalExpenses: 0 },
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/history' });
