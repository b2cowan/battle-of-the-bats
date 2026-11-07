import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canOpenModule } from '@/lib/member-access';
import { withObservability } from '@/lib/observability';
import { canHouseLeague } from '@/lib/house-league-access';
import { leagueRegistrationsWaitingLine } from '@/lib/league-registrations-waiting';

const NO_LEAGUE_LINE = { count: 0, oldestSeasonId: null };

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const orgId = ctx.org.id;

  // The role holds the capability AND the plan carries the module — the one gate every route asks.
  // (Since D8 an admin holds the program capabilities by default, so a capability-only check here
  // counted a club's rep-team and league work for an org whose plan no longer carries them.)
  const canSeeTournaments = canOpenModule(ctx, ctx.org, 'module_tournaments');
  // House league's waiting registrations are counted for whoever can WORK them (the desk: the runners and the registrar),
  // the same answer the registration route gives (Club Tier Stage 13a, B2).
  const canSeeHouseLeague = canHouseLeague(ctx, ctx.org, 'register');
  const canSeeRepTeams    = canOpenModule(ctx, ctx.org, 'module_rep_teams');

  const [
    pendingTournamentCount,
    league,
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

    // House league registrations waiting for review and the season holding the oldest (the line's door), in one query;
    // the club brief's count reads the same rule (lib/league-registrations-waiting.ts). A failed read leaves the line off
    // (it shows only above 0) rather than taking the tournament count down with it.
    canSeeHouseLeague
      ? leagueRegistrationsWaitingLine(orgId).catch(e => { console.error('[attention-summary] league waiting read failed:', e); return NO_LEAGUE_LINE; })
      : Promise.resolve(NO_LEAGUE_LINE),

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
        // `pending_review` is the waiting state (mig 168's CHECK has no 'pending'). This asked for
        // 'pending' and so always answered 0 — the hub never showed a tryout waiting (found 2026-09-25).
        .eq('status', 'pending_review')
        .in('program_year_id', yearIds);
      return count ?? 0;
    })(),
  ]);

  return NextResponse.json({
    pendingTournamentCount,
    pendingLeagueCount: league.count,
    openLeagueSeasonId: league.oldestSeasonId,
    pendingTryoutCount,
  });
}, { route: '/api/admin/attention-summary' });
