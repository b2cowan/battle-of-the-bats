import 'server-only';
import {
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamSeasonLineups,
  getRepTeamEvents,
  getRepRosterPlayers,
  getRepTeamLineupTemplates,
} from './db';
import { getSportPack, DEFAULT_SPORT } from './sports';
import { playerDisplayName } from './coach-roster-name';
import { computeSeasonLineupAnalytics, type SeasonLineupAnalytics } from './lineup-season-analytics';

/**
 * ONE shared assembly of the season lineup-analytics inputs. This exact composition
 * (team + season lineups + events + roster → computeSeasonLineupAnalytics) was previously
 * copy-pasted by the lineup-analytics route and the insights digest, and the Player
 * Development card was about to be a third copy — any change to the input mapping (e.g. a
 * new pitcher field) now lands here once. Returns null when the team has no active program
 * year. (insights-digest still assembles its own inputs from pre-fetched data — migrate it
 * here if its fetch pattern ever converges.)
 */
export async function computeTeamSeasonLineupAnalytics(
  teamId: string,
  // Callers that already fetched the team for their own auth check pass it through so the
  // helper doesn't re-fetch it (only `sport` is read here).
  opts?: { team?: { sport?: string | null } | null },
): Promise<{ analytics: SeasonLineupAnalytics; programYearId: string } | null> {
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return null;

  const [team, lineups, events, players, templates] = await Promise.all([
    opts?.team !== undefined ? Promise.resolve(opts.team) : getRepTeam(teamId),
    getRepTeamSeasonLineups(programYear.id),
    getRepTeamEvents(programYear.id),
    getRepRosterPlayers(programYear.id),
    getRepTeamLineupTemplates(teamId, programYear.id),
  ]);

  const sportPack = getSportPack(team?.sport ?? DEFAULT_SPORT);
  const analytics = computeSeasonLineupAnalytics({
    lineups,
    scores: events.map(e => ({ eventId: e.id, teamScore: e.teamScore, opponentScore: e.opponentScore })),
    players: players.map(p => ({
      id: p.id,
      name: playerDisplayName(p),
      isPitcher: !!p.lineupProfile?.pitcher,
      pitcherCap: p.lineupProfile?.pitcher?.maxInnings ?? null,
    })),
    pitcherPosition: sportPack.pitcherPosition,
    seasonPitcherCap: programYear.lineupSettings?.pitcherMaxInningsDefault ?? null,
    templates: templates.map(t => ({
      name: t.name,
      battingOrderPlayerIds: t.entries
        .filter(e => e.battingOrder != null)
        .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
        .map(e => e.playerId),
    })),
    fieldPositions: sportPack.fieldPositions,
  });

  return { analytics, programYearId: programYear.id };
}
