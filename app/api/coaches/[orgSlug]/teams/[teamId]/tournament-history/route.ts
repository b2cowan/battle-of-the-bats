import { NextResponse } from 'next/server';
import { getAuthContext, forbidden, unauthorized } from '@/lib/api-auth';
import { getMergedTournamentHistoryForRepTeam } from '@/lib/basic-coach-teams';
import { getTeamScopedRepTeamAccess } from '@/lib/team-workspace-entitlements';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { isMoneyRedactedForTeam } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  try {
    const access = await getTeamScopedRepTeamAccess({
      orgId: ctx.org.id,
      repTeamId: teamId,
      userId: ctx.user.id,
      requireCoach: true,
    });

    if (!access.allowed) return forbidden();

    // WI-5 (security): a money='off' assistant coach must not receive fee amounts in the payload
    // (the Overview tile is already render-gated, but the JSON itself leaked `amountDue`). Resolve
    // the caller's capability on this rep team and FAIL CLOSED (redact when no assignment resolves).
    // The merge (both bridge lookups) and the assignment lookup are independent — run concurrently.
    const [{ history, basicCoachTeamId, linkage }, assignments] = await Promise.all([
      getMergedTournamentHistoryForRepTeam(teamId),
      getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    ]);
    const safeHistory = isMoneyRedactedForTeam(assignments, teamId)
      ? history.map(entry => ({ ...entry, amountDue: null }))
      : history;

    return NextResponse.json({ history: safeHistory, basicCoachTeamId, linkage });
  } catch (error) {
    console.error('[coaches tournament history] load error:', error);
    return NextResponse.json(
      { error: 'Tournament history could not be loaded' },
      { status: 500 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tournament-history' });
