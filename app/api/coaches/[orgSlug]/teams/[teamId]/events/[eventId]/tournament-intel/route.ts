import { NextResponse } from 'next/server';
import {
  getRepTeamEventById,
  getTournamentGameSides,
  getTournament,
  getDivisions,
  getTeams,
  getGames,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canViewSchedule } from '@/lib/coach-capabilities';
import {
  getMergedTournamentHistoryForRepTeam, formatGameDateLabel, formatGameTimeLabel,
} from '@/lib/basic-coach-teams';
import { isMirroredEvent } from '@/lib/coach-tournament-games';
import { assembleOpponentTournamentIntel } from '@/lib/coach-tournament-intel';

/**
 * "Their tournament so far" (Scouting Book P3, plan §4.7) — the opponent's OTHER results in
 * the SAME tournament as this mirrored game, assembled from organizer-side data the platform
 * already hosts. Zero capture; refreshed on every read; the book fills itself between games.
 *
 * ⚠ SCOPE (plan §9 Q4, owner-ruled): this tournament ONLY. Reading the opponent's games in
 * other platform tournaments is cross-event profiling and needs a fresh owner ruling.
 * ⚠ INSTRUMENT (owner 2026-08-04): resolves the ACTIVE program year only, like every
 * scouting-book route — never the working-season read, never an archive door.
 * ⚠ READ-ONLY JOIN: mirrored rows and organizer-side games stay organizer-owned; this route
 * writes nothing anywhere.
 *
 * Answers `{ intel: null }` rather than erroring for every "there is nothing to show" case
 * (not a mirrored game, opponent unresolvable, no results yet, tournament not public) — the
 * block is a bonus on the Scouting tab, and its absence is a state, not a failure.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { assignment, programYear } = resolved;

  // Rides `schedule` like the rest of the Scouting tab — everyone who can open the drawer.
  const denied = denyUnless(canViewSchedule(assignment.capabilities), 'You do not have access to the schedule.');
  if (denied) return denied;

  const event = await getRepTeamEventById(eventId);
  if (!event || event.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (!isMirroredEvent(event)) return NextResponse.json({ intel: null });

  // Independent lookups — the game row's identity and the team's registration history — so
  // neither round trip queues behind the other on the drawer's read path.
  const [source, { history }] = await Promise.all([
    getTournamentGameSides(event.sourceTournamentGameId!),
    getMergedTournamentHistoryForRepTeam(teamId),
  ]);
  if (!source) return NextResponse.json({ intel: null });

  // Our side of the source game = a registration this team's history already reaches.
  // Whichever side is NOT ours is the opponent's registration — same resolution the
  // mirrored-schedule read uses, never a name match.
  const registrationIds = new Set(history.map(h => h.registration.id));
  const opponentTeamId =
    source.homeTeamId && registrationIds.has(source.homeTeamId) ? source.awayTeamId
      : source.awayTeamId && registrationIds.has(source.awayTeamId) ? source.homeTeamId
        : null;
  if (!opponentTeamId) return NextResponse.json({ intel: null });

  // ONE tournament's worth of reads (the same shape the public standings page loads) — the
  // pure assembler applies the reveal rules and the tie-break engine over them.
  const [tournament, divisions, teams, games] = await Promise.all([
    getTournament(source.tournamentId),
    getDivisions(source.tournamentId, { admin: true }),
    getTeams(source.tournamentId, { admin: true }),
    getGames(source.tournamentId, { admin: true }),
  ]);
  if (!tournament) return NextResponse.json({ intel: null });

  const intel = assembleOpponentTournamentIntel({
    sourceGameId: event.sourceTournamentGameId!,
    opponentTeamId,
    tournamentName: tournament.name,
    tournamentStatus: tournament.status,
    tournamentSettings: tournament.settings,
    divisions,
    teams,
    games,
  });

  return NextResponse.json({
    intel: intel && {
      ...intel,
      // Labels rendered with the SAME helpers the mirrored schedule chips use, so the tab
      // and the schedule can never spell the same game's time two ways.
      results: intel.results.map(r => ({
        ...r,
        dateLabel: formatGameDateLabel(r.gameDate),
        timeLabel: formatGameTimeLabel(r.gameTime),
      })),
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/tournament-intel' });
