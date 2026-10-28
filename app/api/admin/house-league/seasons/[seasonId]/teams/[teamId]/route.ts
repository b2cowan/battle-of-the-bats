import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, updateLeagueTeam, deleteLeagueTeam } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { CHANGES_TO_SEND_WORDS } from '@/lib/league-schedule-words';

async function verifyTeam(teamId: string, seasonId: string) {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .select('id')
    .eq('id', teamId)
    .eq('season_id', seasonId)
    .single();
  return data;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; teamId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId, teamId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  if (!await verifyTeam(teamId, seasonId)) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const body = await req.json();
  const patch: { name?: string; color?: string | null; coachName?: string | null } = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if ('color'     in body)          patch.color     = body.color ?? null;
  if ('coachName' in body)          patch.coachName = body.coachName ?? null;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await updateLeagueTeam(teamId, patch);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams/[teamId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; teamId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId, teamId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  if (!await verifyTeam(teamId, seasonId)) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const { count } = await supabaseAdmin
    .from('league_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'active');

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Remove all players from this team before deleting it.' },
      { status: 409 },
    );
  }

  // ⚖ A team's games go with it (the foreign key cascades). On a published schedule those are games families were told
  // about, and a published game is cancelled, never removed (9d2·9, 9d-2b): the team stays.
  const { data: team } = await supabaseAdmin.from('league_teams')
    .select('name, league_divisions(schedule_published_at)').eq('id', teamId).single();
  const div = Array.isArray(team?.league_divisions) ? team?.league_divisions[0] : team?.league_divisions;
  if ((div as { schedule_published_at?: string | null } | null)?.schedule_published_at) {
    const { count: games } = await supabaseAdmin.from('league_games').select('id', { count: 'exact', head: true })
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
    if ((games ?? 0) > 0) {
      return NextResponse.json({ error: CHANGES_TO_SEND_WORDS.teamHasPublishedGames((team?.name as string) ?? 'This team') }, { status: 409 });
    }
  }

  await deleteLeagueTeam(teamId);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams/[teamId]' });
