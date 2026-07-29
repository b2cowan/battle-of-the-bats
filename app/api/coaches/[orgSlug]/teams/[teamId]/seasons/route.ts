import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getClosedCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getLatestClosedRepProgramYear,
} from '@/lib/db';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { startNextRepSeason, SeasonRolloverError } from '@/lib/rep-season-rollover';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const lookupOpts = { isTeamWorkspace: isTeamWorkspaceOrg(ctx.org) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id, lookupOpts);
  const assignment = assignments.find(a => a.teamId === teamId);

  if (assignment) {
    const programYear = await getActiveRepProgramYear(teamId);
    if (!programYear) {
      return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
    }
    return { ctx, team, assignment: { coachRole: assignment.coachRole }, programYear };
  }

  // Season's End recovery (Batch 3, P0 #1): a standalone head coach whose ONLY season is
  // closed must still be able to start the next one — that CTA is the whole way forward on
  // the Season's End screen. Rolling forward FROM a completed season is safe: the rollover
  // copies roster + staff from it, creates the new active year, and re-completing the old
  // year is a no-op. The head-coach + standalone gates below still apply unchanged.
  //
  // Two hardening checks (adversarial review): this door exists ONLY for the stranded state.
  // (1) If the team has an ACTIVE season the caller simply isn't on, they are not stranded —
  //     they are former staff, and must not be able to roll (and thereby force-complete) the
  //     current staff's season. (2) The caller's own closed assignment must be on the team's
  //     LATEST closed season — a coach from a bygone year has no standing to roll the years
  //     that followed without them.
  const stillOpen = await getActiveRepProgramYear(teamId);
  if (stillOpen) return { error: forbidden() };

  const closed = (await getClosedCoachingAssignmentsForUser(ctx.org.id, ctx.user.id, lookupOpts))
    .find(a => a.teamId === teamId);
  if (!closed) return { error: forbidden() };

  const latestClosed = await getLatestClosedRepProgramYear(teamId);
  if (!latestClosed) {
    return { error: NextResponse.json({ error: 'No program year found for this team' }, { status: 404 }) };
  }
  if (closed.programYearId !== latestClosed.id) return { error: forbidden() };

  // Both branches return the same deliberately-narrow shape: only what the POST reads.
  const narrowed: { coachRole: 'head_coach' | 'assistant_coach' } = { coachRole: closed.coachRole };
  return { ctx, team, assignment: narrowed, programYear: latestClosed };
}

// POST /api/coaches/[orgSlug]/teams/[teamId]/seasons — coach starts the team's next season
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear, assignment } = resolved;

  // Scope: standalone Team workspace (not org-owned/adopted) + head coach only.
  const isStandalone =
    isTeamWorkspaceOrg(ctx.org) &&
    ctx.org.teamWorkspaceStatus !== 'org_owned' &&
    ctx.org.teamWorkspaceStatus !== 'archived';
  if (!isStandalone || assignment.coachRole !== 'head_coach') {
    return NextResponse.json(
      { error: 'Only the head coach of a standalone Premium team can start a new season. For org-owned teams, your club admin manages seasons.' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const yearNum = Number(body.year);
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return NextResponse.json({ error: 'A valid four-digit season year is required.' }, { status: 400 });
  }
  if (yearNum <= programYear.year) {
    return NextResponse.json({ error: 'The new season year must be later than the current season.' }, { status: 400 });
  }
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : `${yearNum} Season`;
  if (name.length > 100) {
    return NextResponse.json({ error: 'Season name must be 100 characters or fewer.' }, { status: 400 });
  }
  const carryBudget = body.carryBudget !== false; // default on
  const carryFees = body.carryFees !== false; // default on

  // Resolve the workspace row so we can re-point its active-season pointer (hygiene).
  const { data: workspace } = await supabaseAdmin
    .from('team_workspaces')
    .select('id')
    .eq('rep_team_id', teamId)
    .eq('workspace_org_id', ctx.org.id)
    .maybeSingle();

  try {
    const summary = await startNextRepSeason({
      orgId: ctx.org.id,
      teamId,
      workspaceId: (workspace?.id as string | undefined) ?? null,
      currentSeason: programYear,
      initiatorUserId: ctx.user.id,
      newName: name,
      newYear: yearNum,
      carryBudget,
      carryFees,
    });
    return NextResponse.json({ summary }, { status: 201 });
  } catch (e) {
    if (e instanceof SeasonRolloverError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error('[seasons POST] unexpected error:', e);
    return NextResponse.json({ error: 'Could not start the new season. Please try again.' }, { status: 500 });
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/seasons' });
