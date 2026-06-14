import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasCapability } from '@/lib/roles';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const orgId = ctx.org.id;

  const canSeeTournaments = hasCapability(ctx.role, ctx.capabilities, 'module_tournaments');
  const canSeeHouseLeague = hasCapability(ctx.role, ctx.capabilities, 'module_house_league');
  const canSeeRepTeams    = hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams');

  const [
    pendingTournamentCount,
    pendingLeagueCount,
    openLeagueSeasonId,
    pendingTryoutCount,
  ] = await Promise.all([
    // Pending tournament team registrations
    (async () => {
      if (!canSeeTournaments) return 0;
      const { data: tList } = await supabaseAdmin
        .from('tournaments')
        .select('id')
        .eq('org_id', orgId)
        .in('status', ['draft', 'active']);
      const ids = (tList ?? []).map((t: any) => t.id);
      if (ids.length === 0) return 0;
      const { count } = await supabaseAdmin
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .in('tournament_id', ids);
      return count ?? 0;
    })(),

    // Pending house league registrations in registration-open seasons
    (async () => {
      if (!canSeeHouseLeague) return 0;
      const { data: seasons } = await supabaseAdmin
        .from('league_seasons')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'registration_open');
      const ids = (seasons ?? []).map((s: any) => s.id);
      if (ids.length === 0) return 0;
      const { count } = await supabaseAdmin
        .from('league_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .in('season_id', ids);
      return count ?? 0;
    })(),

    // First registration-open season ID (for direct link)
    (async () => {
      if (!canSeeHouseLeague) return null;
      const { data } = await supabaseAdmin
        .from('league_seasons')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'registration_open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    })(),

    // Pending rep team tryout applications
    (async () => {
      if (!canSeeRepTeams) return 0;
      const { data: teams } = await supabaseAdmin
        .from('rep_teams')
        .select('id')
        .eq('org_id', orgId);
      const teamIds = (teams ?? []).map((t: any) => t.id);
      if (teamIds.length === 0) return 0;
      const { data: years } = await supabaseAdmin
        .from('rep_program_years')
        .select('id')
        .in('team_id', teamIds);
      const yearIds = (years ?? []).map((y: any) => y.id);
      if (yearIds.length === 0) return 0;
      const { count } = await supabaseAdmin
        .from('rep_tryout_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .in('program_year_id', yearIds);
      return count ?? 0;
    })(),
  ]);

  return NextResponse.json({
    pendingTournamentCount,
    pendingLeagueCount,
    openLeagueSeasonId,
    pendingTryoutCount,
  });
}, { route: '/api/admin/attention-summary' });
