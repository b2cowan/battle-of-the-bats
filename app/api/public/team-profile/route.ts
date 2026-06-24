import { NextResponse } from 'next/server';
import { getOrganizationBySlug, getTournamentsByOrg, getTeams, getDivisions, getGames } from '@/lib/db';
import { computeTournamentStandings } from '@/lib/tie-breakers';
import type { Game } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { toPublicTeam } from '@/lib/public-tournament-data';
import { decidedFinalFor } from '@/lib/champions';

export const dynamic = 'force-dynamic';

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export const GET = withObservability(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const orgSlug = searchParams.get('orgSlug');
  const tournamentSlug = searchParams.get('tournamentSlug');

  if (!teamId || !orgSlug || !tournamentSlug) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tournaments = await getTournamentsByOrg(org.id, { admin: true });
  const tournament = tournaments.find(t => t.slug === tournamentSlug) ?? null;
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [teams, divisions, games] = await Promise.all([
    getTeams(tournament.id, { admin: true }),
    getDivisions(tournament.id, { admin: true }),
    getGames(tournament.id, { admin: true }),
  ]);

  const team = teams.find(t => t.id === teamId);
  if (!team || team.status !== 'accepted') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const division = divisions.find(d => d.id === team.divisionId);
  if (!division) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const gameDurationMinutes =
    division.settings?.game_duration_minutes ??
    tournament.settings?.game_duration_minutes ??
    90;

  const pool = division.pools?.find(p => p.id === team.poolId) ?? null;
  const poolName = pool?.name ?? null;

  const teamsQualifying = division.playoffConfig?.teamsQualifying ?? null;

  // Pool-play standings from the canonical engine — the SAME ranking the standings
  // table uses (H2H, run-diff cap, coin toss). Computing it locally here is what let
  // a team's profile rank contradict the standings table (J6-032).
  const standingsRows = computeTournamentStandings(
    division.id,
    teams,
    games,
    division.playoffConfig,
    tournament.settings,
  );

  const foundStats = standingsRows.find(s => s.teamId === teamId);
  const teamStats = foundStats
    ? {
        teamId,
        poolId: foundStats.poolId ?? null,
        w: foundStats.w, l: foundStats.l, t: foundStats.t,
        pts: foundStats.pts, rf: foundStats.rf, ra: foundStats.ra, rd: foundStats.rd,
      }
    : {
        teamId,
        poolId: team.poolId ?? null,
        w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0, rd: 0,
      };

  // Rank within pool (or division if no pool)
  const rankPool = team.poolId
    ? standingsRows.filter(s => s.poolId === team.poolId)
    : standingsRows;
  const poolRank = rankPool.findIndex(s => s.teamId === teamId) + 1 || null;
  const poolRankLabel = poolRank ? ordinal(poolRank) : null;

  const inPlayoffSpot =
    teamsQualifying !== null && poolRank !== null && poolRank <= teamsQualifying;

  // Champion / runner-up from the decided division final (J6-025).
  const decidedFinal = decidedFinalFor(games, division.id);
  const isChampion = !!decidedFinal &&
    ((decidedFinal.homeScore! > decidedFinal.awayScore! ? decidedFinal.homeTeamId : decidedFinal.awayTeamId) === teamId);
  const isRunnerUp = !!decidedFinal && !isChampion &&
    (decidedFinal.homeTeamId === teamId || decidedFinal.awayTeamId === teamId);

  // Team's games (pool play + playoffs, excluding cancelled)
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

  const teamGames: (Game & { homeTeamName: string; awayTeamName: string })[] = games
    .filter(
      g =>
        (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
        g.status !== 'cancelled',
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    })
    .map(g => ({
      ...g,
      homeTeamName: teamMap[g.homeTeamId] ?? g.homePlaceholder ?? 'TBD',
      awayTeamName: teamMap[g.awayTeamId] ?? g.awayPlaceholder ?? 'TBD',
    }));

  return NextResponse.json({
    // Public-safe team only — never expose coach email / paymentStatus / adminNotes
    // on this anonymous endpoint (J6-001). Coach NAME honors the per-tournament toggle (mig 150).
    team: toPublicTeam(team, tournament.coachNamesShowOnPublic === true),
    divisionName: division.name,
    poolName,
    gameDurationMinutes,
    tournamentName: tournament.name,
    standings: {
      ...teamStats,
      poolRank,
      poolRankLabel,
      inPlayoffSpot,
      isChampion,
      isRunnerUp,
    },
    games: teamGames,
    teamNames: teamMap,
  });
}, { route: '/api/public/team-profile' });
