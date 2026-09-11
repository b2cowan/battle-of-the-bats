import { NextResponse } from 'next/server';
import { getAuthContext, forbidden, unauthorized } from '@/lib/api-auth';
import { getMergedTournamentHistoryForRepTeam } from '@/lib/basic-coach-teams';
import { getTeamScopedRepTeamAccess, isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { canConfigureTeam, denyUnless, isMoneyRedactedForTeam } from '@/lib/coach-capabilities';
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
      skipEntitlementCheck: !isTeamWorkspaceOrg(ctx.org),
    });

    if (!access.allowed) return forbidden();

    /**
     * ⚠ THE DOOR AND THE ROOM AGREE (staff access review, 2026-09-10). The "Tournaments" nav item
     * hides unless the coach may configure the team (`canConfigureTeam`), but this read answered
     * every team member — so a schedule-only helper who typed the URL received the team's whole
     * tournament participation record (names, dates, statuses, organizers). The assignment is
     * resolved FIRST now, because the gate needs it before any history is read; the money redaction
     * below reuses the same lookup.
     */
    const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
    const assignment = assignments.find(a => a.teamId === teamId);
    const denied = denyUnless(
      !!assignment && canConfigureTeam(assignment.capabilities),
      'Tournaments aren’t turned on for you. Ask the head coach to grant schedule editing.',
    );
    if (denied) return denied;

    // WI-5 (security): a money='off' assistant coach must not receive fee amounts in the payload
    // (the Overview tile is already render-gated, but the JSON itself leaked `amountDue`). Resolve
    // the caller's capability on this rep team and FAIL CLOSED (redact when no assignment resolves).
    const { history, basicCoachTeamId, linkage } = await getMergedTournamentHistoryForRepTeam(teamId);
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
