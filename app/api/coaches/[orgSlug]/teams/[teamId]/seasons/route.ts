import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getRepTeam } from '@/lib/db';
import { getEntitledTeamMembership, resolveWorkingProgramYear } from '@/lib/coach-membership';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { startNextRepSeason, SeasonRolloverError } from '@/lib/rep-season-rollover';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  // M1 (2026-08-16): standing to roll a season is TEAM MEMBERSHIP — one gate for the mid-season
  // and the between-seasons ("stranded") states alike. The old two-branch dance (live assignment,
  // else a closed assignment on exactly the latest closed year) existed because standing itself
  // was per-season; membership answers both of its hardening checks for free — former staff hold
  // no membership, and a coach from a bygone year holds no membership either.
  // All three lookups are independent — one round trip. The roll runs FROM the live season when
  // there is one, else from the newest closed one (the Season's End recovery state — that CTA is
  // the whole way forward on that screen).
  const [team, membership, programYear] = await Promise.all([
    getRepTeam(teamId),
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
    resolveWorkingProgramYear(teamId),
  ]);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  if (!membership) return { error: forbidden() };
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No program year found for this team' }, { status: 404 }) };
  }

  // The same deliberately-narrow shape as before: only what the POST reads.
  return { ctx, team, assignment: { coachRole: membership.coachRole }, programYear };
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
