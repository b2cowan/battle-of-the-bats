import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  updateRepProgramYear,
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  getRepTeamExpenses,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

  // Compute summary stats
  const schedules = await getRepPlayerDuesSchedules(programYear.id);
  const installmentLists = await Promise.all(schedules.map(s => getRepPlayerDuesInstallments(s.id)));
  const allInstallments = installmentLists.flat();
  const duesCollected = allInstallments
    .filter(i => i.paidAt)
    .reduce((sum, i) => sum + i.amount, 0);

  const expenses = await getRepTeamExpenses(programYear.id);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return NextResponse.json({
    budgetAmount: programYear.budgetAmount ?? null,
    duesCollected,
    totalExpenses,
    net: (programYear.budgetAmount ?? 0) + duesCollected - totalExpenses,
    programYear,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

  const body = await req.json();
  const { budgetAmount } = body;

  if (budgetAmount === undefined || typeof budgetAmount !== 'number' || budgetAmount < 0) {
    return NextResponse.json({ error: 'budgetAmount must be a non-negative number' }, { status: 400 });
  }

  const updated = await updateRepProgramYear(programYear.id, { budgetAmount });
  return NextResponse.json({ programYear: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget' });
