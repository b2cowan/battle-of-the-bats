import { NextResponse } from 'next/server';
import { getOrganizationBySlug, getTournamentsByOrg, getTeams, getDivisions, getGames } from '@/lib/db';
import { clampRunDiffCap, cappedGameDiff } from '@/lib/tie-breakers';
import type { Game } from '@/lib/types';
import { withObservability } from '@/lib/observability';

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

  // Compute pool-play standings for the division
  const divTeams = teams.filter(t => t.divisionId === division.id && t.status === 'accepted');
  const poolPlayGames = games.filter(
    g =>
      g.divisionId === division.id &&
      (g.status === 'completed' || g.status === 'submitted') &&
      !g.isPlayoff,
  );

  // Run-diff cap (division override → tournament default → none). Caps the RD value
  // only — rf/ra stay raw — matching getStandings (lib/db.ts).
  const runDiffCap = clampRunDiffCap(
    division.playoffConfig?.maxRunDiffPerGame ?? tournament.settings?.max_run_diff_per_game ?? null,
  );

  const standingsRows = divTeams
    .map(t => {
      const tGames = poolPlayGames.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id);
      let w = 0, l = 0, ti = 0, rf = 0, ra = 0, rd = 0;
      tGames.forEach(g => {
        const isHome = g.homeTeamId === t.id;
        const tf = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
        const ta = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
        rf += tf;
        ra += ta;
        rd += cappedGameDiff(tf - ta, runDiffCap);
        if (tf > ta) w++;
        else if (tf < ta) l++;
        else ti++;
      });
      return {
        teamId: t.id,
        poolId: t.poolId ?? null,
        w,
        l,
        t: ti,
        pts: w * 2 + ti,
        rf,
        ra,
        rd,
      };
    })
    .sort((a, b) => b.pts - a.pts || b.rd - a.rd || b.rf - a.rf);

  const teamStats = standingsRows.find(s => s.teamId === teamId) ?? {
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
    team,
    divisionName: division.name,
    poolName,
    gameDurationMinutes,
    standings: {
      ...teamStats,
      poolRank,
      poolRankLabel,
      inPlayoffSpot,
    },
    games: teamGames,
    teamNames: teamMap,
  });
}, { route: '/api/public/team-profile' });
