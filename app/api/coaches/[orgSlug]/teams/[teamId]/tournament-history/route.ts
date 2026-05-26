import { NextResponse } from 'next/server';
import { getAuthContext, forbidden, unauthorized } from '@/lib/api-auth';
import {
  findBasicCoachTeamIdForTournamentRegistration,
  getBasicCoachTournamentHistoryForTeam,
} from '@/lib/basic-coach-teams';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  getTeamScopedRepTeamAccess,
  getTeamWorkspaceForRepTeam,
} from '@/lib/team-workspace-entitlements';

async function resolveBasicCoachTeamIdForWorkspace(teamWorkspace: {
  id: string;
  sourceTournamentTeamId: string | null;
  basicCoachTeamId: string | null;
}) {
  if (teamWorkspace.basicCoachTeamId) return teamWorkspace.basicCoachTeamId;
  if (!teamWorkspace.sourceTournamentTeamId) return null;

  const basicCoachTeamId = await findBasicCoachTeamIdForTournamentRegistration(
    teamWorkspace.sourceTournamentTeamId,
  );
  if (!basicCoachTeamId) return null;

  await Promise.all([
    supabaseAdmin
      .from('team_workspaces')
      .update({ basic_coach_team_id: basicCoachTeamId })
      .eq('id', teamWorkspace.id),
    supabaseAdmin
      .from('basic_coach_teams')
      .update({ team_workspace_id: teamWorkspace.id })
      .eq('id', basicCoachTeamId),
  ]).then(results => {
    for (const { error } of results) {
      if (error) throw error;
    }
  });

  return basicCoachTeamId;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const ctx = await getAuthContext({ orgSlug });
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

    const workspace = await getTeamWorkspaceForRepTeam(teamId);
    if (!workspace) {
      return NextResponse.json({ history: [], basicCoachTeamId: null });
    }

    const basicCoachTeamId = await resolveBasicCoachTeamIdForWorkspace(workspace);
    if (!basicCoachTeamId) {
      return NextResponse.json({ history: [], basicCoachTeamId: null });
    }

    const history = await getBasicCoachTournamentHistoryForTeam(basicCoachTeamId);
    return NextResponse.json({ history, basicCoachTeamId });
  } catch (error) {
    console.error('[coaches tournament history] load error:', error);
    return NextResponse.json(
      { error: 'Tournament history could not be loaded' },
      { status: 500 },
    );
  }
}
