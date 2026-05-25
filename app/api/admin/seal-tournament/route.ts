import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAuthContextWithScope, unauthorized, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';

export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'seal_tournaments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!hasPlanFeature(ctx.org.planId, 'sealed_archives')) {
    return NextResponse.json(
      { error: requiresTournamentPlusCopy('sealed_archives') },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { tournamentId } = body;

  if (!tournamentId || typeof tournamentId !== 'string') {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  // Scope check: scoped users may only seal their assigned tournaments
  const scopeDenied = scopeGuard(ctx, tournamentId);
  if (scopeDenied) return scopeDenied;

  // Verify the tournament belongs to this org
  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }

  if (tournament.status !== 'completed' && tournament.status !== 'archived') {
    return NextResponse.json(
      { error: 'Tournament must be completed or archived before sealing.' },
      { status: 400 }
    );
  }

  // Check if already sealed — unique constraint would reject anyway, but give a clear 409
  const { data: existing } = await supabaseAdmin
    .from('tournament_archives')
    .select('id')
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Tournament already sealed', archiveId: existing.id },
      { status: 409 }
    );
  }

  // Fetch snapshot data
  const [divisionsRes, teamsRes, gamesRes] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('*, pools(*)')
      .eq('tournament_id', tournamentId)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'accepted'),
    supabaseAdmin
      .from('games')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true }),
  ]);

  const divisions = divisionsRes.data ?? [];
  const teams = teamsRes.data ?? [];
  const games = gamesRes.data ?? [];

  const snapshot = {
    tournament: {
      id:             tournament.id,
      organizationId: tournament.org_id,
      year:           tournament.year,
      name:           tournament.name,
      isActive:       tournament.is_active,
      startDate:      tournament.start_date ?? null,
      endDate:        tournament.end_date ?? null,
    },
    divisions: divisions.map((ag: any) => ({
      id:                     ag.id,
      tournamentId:           ag.tournament_id,
      name:                   ag.name,
      minAge:                 ag.min_age,
      maxAge:                 ag.max_age,
      order:                  ag.display_order,

      isClosed:               ag.is_closed,
      capacity:               ag.capacity,
      poolCount:              ag.pool_count,
      playoffConfig:          ag.playoff_config ?? null,
      pools: (ag.pools ?? []).map((p: any) => ({
        id:         p.id,
        divisionId: p.division_id,
        name:       p.name,
        order:      p.display_order,
      })),
    })),
    teams: teams.map((t: any) => ({
      id:            t.id,
      tournamentId:  t.tournament_id,
      divisionId:    t.division_id,
      name:          t.name,
      coach:         t.coach,
      email:         t.email,
      status:        t.status,
      paymentStatus: t.payment_status,
      registeredAt:  t.registered_at,
      poolId:        t.pool_id ?? null,
    })),
    games: games.map((g: any) => ({
      id:              g.id,
      tournamentId:    g.tournament_id,
      divisionId:      g.division_id,
      homeTeamId:      g.home_team_id,
      awayTeamId:      g.away_team_id,
      date:            g.game_date,
      time:            g.game_time,
      location:        g.location,
      venueId:         g.diamond_id ?? null,
      homeScore:       g.home_score ?? null,
      awayScore:       g.away_score ?? null,
      status:          g.status,
      isPlayoff:       g.is_playoff,
      bracketCode:     g.bracket_code ?? null,
      homePlaceholder: g.home_placeholder ?? null,
      awayPlaceholder: g.away_placeholder ?? null,
    })),
  };

  const season = String(tournament.year);
  const division = divisions.length > 0
    ? divisions.map((ag: any) => ag.name).join(', ')
    : null;
  const totalTeams = teams.length;
  const totalGames = games.filter((g: any) =>
    g.status === 'completed' || g.status === 'submitted'
  ).length;

  let winnerTeamId: string | null = null;
  let winnerTeamName: string | null = null;
  let runnerUpName: string | null = null;

  const finalGame = games.find((g: any) =>
    g.is_playoff && g.bracket_code === 'FIN' && g.status === 'completed'
  );

  if (finalGame) {
    const homeScore = finalGame.home_score ?? 0;
    const awayScore = finalGame.away_score ?? 0;
    const winnerId = homeScore >= awayScore ? finalGame.home_team_id : finalGame.away_team_id;
    const loserId  = homeScore >= awayScore ? finalGame.away_team_id : finalGame.home_team_id;

    const winnerTeam = teams.find((t: any) => t.id === winnerId);
    const loserTeam  = teams.find((t: any) => t.id === loserId);

    winnerTeamId   = winnerId ?? null;
    winnerTeamName = winnerTeam?.name ?? null;
    runnerUpName   = loserTeam?.name ?? null;
  }

  const integrityHash = createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex');

  const { data: archive, error: insertError } = await supabaseAdmin
    .from('tournament_archives')
    .insert({
      tournament_id:    tournamentId,
      org_id:           ctx.org.id,
      tournament_name:  tournament.name,
      season,
      division,
      final_snapshot:   snapshot,
      winner_team_id:   winnerTeamId,
      winner_team_name: winnerTeamName,
      runner_up_name:   runnerUpName,
      total_teams:      totalTeams,
      total_games:      totalGames,
      integrity_hash:   integrityHash,
      sealed_by:        ctx.user.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error('seal-tournament insert error', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ archive });
}
