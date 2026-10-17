import { NextResponse } from 'next/server';
import { getOrganizationBySlug, getPublicTournamentBySlug, getTeams, getDivisions, getGames, getVenues } from '@/lib/db';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { computeTournamentStandings } from '@/lib/tie-breakers';
import type { Game } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { toPublicTeam } from '@/lib/public-tournament-data';
import { resolveGameVenueLabel } from '@/lib/venue-label';
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

  // The public pages' own rules (lib/public-tournament-data.ts getPublicContext), which this anonymous route skipped
  // until 2026-10-16 (the second sweep's fifth finding): a cancelled club shows nothing, and only an active or
  // completed tournament is public. The Teams switch hides the team LIST, not a team's page — the schedule and a
  // followed team link here, and this page is that team's schedule and record, held by those two switches below.
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [teams, divisions, games, venues] = await Promise.all([
    getTeams(tournament.id, { admin: true }),
    getDivisions(tournament.id, { admin: true }),
    getGames(tournament.id, { admin: true }),
    getVenues(tournament.id, { admin: true, includeFacilities: true }),
  ]);

  const team = teams.find(t => t.id === teamId);
  if (!team || team.status !== 'accepted') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const division = divisions.find(d => d.id === team.divisionId);
  if (!division) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The team's games show only where the public Schedule shows them (the page is on and the division is published);
  // its record only where the public Standings show (that page is on, and the games behind it are shown).
  const scheduleShown = isPublicPageEnabled(tournament, 'schedule') && (division.scheduleVisibility ?? 'unpublished') !== 'unpublished';
  const standingsShown = scheduleShown && isPublicPageEnabled(tournament, 'standings');

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

  // Team's games (pool play + playoffs, excluding cancelled) — none while its schedule isn't public. Accepted teams'
  // names only, and a game's private notes never leave (the page shows neither an unaccepted team nor a note).
  const teamMap: Record<string, string> = Object.fromEntries(teams.filter(t => t.status === 'accepted').map(t => [t.id, t.name]));

  const teamGames: (Omit<Game, 'notes'> & { homeTeamName: string; awayTeamName: string })[] = !scheduleShown ? [] : games
    .filter(
      g =>
        (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
        g.status !== 'cancelled',
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    })
    .map(({ notes: _notes, ...g }) => ({
      ...g,
      // Resolve the venue label LIVE so a facility rename ("2" → "Diamond 2")
      // shows immediately instead of the snapshot baked onto the game at schedule time.
      location: resolveGameVenueLabel(g, venues),
      homeTeamName: teamMap[g.homeTeamId] ?? g.homePlaceholder ?? 'TBD',
      awayTeamName: teamMap[g.awayTeamId] ?? g.awayPlaceholder ?? 'TBD',
    }));
  // The names the page can need: this team's and its shown games' teams — never the whole tournament's list.
  const shownTeamIds = new Set<string>([teamId, ...teamGames.flatMap(g => [g.homeTeamId, g.awayTeamId])].filter(Boolean) as string[]);
  const teamNames = Object.fromEntries(Object.entries(teamMap).filter(([id]) => shownTeamIds.has(id)));

  return NextResponse.json({
    // Public-safe team only — never expose coach email / paymentStatus / adminNotes
    // on this anonymous endpoint (J6-001). Coach NAME honors the per-tournament toggle (mig 150).
    team: toPublicTeam(team, tournament.coachNamesShowOnPublic === true),
    divisionName: division.name,
    poolName,
    gameDurationMinutes,
    tournamentName: tournament.name,
    // The record reads as no games played while the public Standings are off or the schedule isn't published.
    standings: standingsShown
      ? { ...teamStats, poolRank, poolRankLabel, inPlayoffSpot, isChampion, isRunnerUp }
      : { teamId, poolId: team.poolId ?? null, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0, rd: 0,
          poolRank: null, poolRankLabel: null, inPlayoffSpot: false, isChampion: false, isRunnerUp: false },
    games: teamGames,
    teamNames,
  });
}, { route: '/api/public/team-profile' });
