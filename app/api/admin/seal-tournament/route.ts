import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { user, org } = ctx;

  // Seal requires admin or owner role
  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['admin', 'owner'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { tournamentId } = body;

  if (!tournamentId || typeof tournamentId !== 'string') {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 });
  }

  // Verify the tournament belongs to this org
  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .eq('organization_id', org.id)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
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
  const [ageGroupsRes, teamsRes, gamesRes] = await Promise.all([
    supabaseAdmin
      .from('age_groups')
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

  const ageGroups = ageGroupsRes.data ?? [];
  const teams = teamsRes.data ?? [];
  const games = gamesRes.data ?? [];

  // Build the immutable snapshot
  const snapshot = {
    tournament: {
      id:             tournament.id,
      organizationId: tournament.organization_id,
      year:           tournament.year,
      name:           tournament.name,
      isActive:       tournament.is_active,
      startDate:      tournament.start_date ?? null,
      endDate:        tournament.end_date ?? null,
    },
    ageGroups: ageGroups.map((ag: any) => ({
      id:                     ag.id,
      tournamentId:           ag.tournament_id,
      name:                   ag.name,
      minAge:                 ag.min_age,
      maxAge:                 ag.max_age,
      order:                  ag.display_order,
      contactId:              ag.contact_id ?? null,
      isClosed:               ag.is_closed,
      capacity:               ag.capacity,
      poolCount:              ag.pool_count,
      playoffConfig:          ag.playoff_config ?? null,
      pools: (ag.pools ?? []).map((p: any) => ({
        id:          p.id,
        ageGroupId:  p.age_group_id,
        name:        p.name,
        order:       p.display_order,
      })),
    })),
    teams: teams.map((t: any) => ({
      id:             t.id,
      tournamentId:   t.tournament_id,
      ageGroupId:     t.age_group_id,
      name:           t.name,
      coach:          t.coach,
      email:          t.email,
      status:         t.status,
      paymentStatus:  t.payment_status,
      registeredAt:   t.registered_at,
      poolId:         t.pool_id ?? null,
    })),
    games: games.map((g: any) => ({
      id:               g.id,
      tournamentId:     g.tournament_id,
      ageGroupId:       g.age_group_id,
      homeTeamId:       g.home_team_id,
      awayTeamId:       g.away_team_id,
      date:             g.game_date,
      time:             g.game_time,
      location:         g.location,
      diamondId:        g.diamond_id ?? null,
      homeScore:        g.home_score ?? null,
      awayScore:        g.away_score ?? null,
      status:           g.status,
      isPlayoff:        g.is_playoff,
      bracketCode:      g.bracket_code ?? null,
      homePlaceholder:  g.home_placeholder ?? null,
      awayPlaceholder:  g.away_placeholder ?? null,
    })),
  };

  // Derive summary fields
  const season = String(tournament.year);
  const division = ageGroups.length > 0
    ? ageGroups.map((ag: any) => ag.name).join(', ')
    : null;
  const totalTeams = teams.length;
  const totalGames = games.filter((g: any) =>
    g.status === 'completed' || g.status === 'submitted'
  ).length;

  // Derive champion from the FIN playoff game
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

  // SHA-256 integrity hash
  const integrityHash = createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex');

  // Insert the archive record via supabaseAdmin (bypasses RLS)
  const { data: archive, error: insertError } = await supabaseAdmin
    .from('tournament_archives')
    .insert({
      tournament_id:    tournamentId,
      org_id:           org.id,
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
      sealed_by:        user.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error('seal-tournament insert error', insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ archive });
}
