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
import { resolveArmCare, type ArmCareConcern, type ArmCareLineup } from './coach-arm-care';
import { orgDayKey, tournamentToday } from './timezone';

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
  opts?: {
    team?: { sport?: string | null } | null;
    /**
     * Chunk C (wow #2): when set, also resolve the arm-care concerns for THAT event, so the
     * Overview's game-day card can warn without a second round trip. Everything the warning
     * needs — saved lineups, event dates, per-player caps, the season default and the sport's
     * pitcher position — is already loaded here.
     */
    armCareForEventId?: string | null;
    /**
     * Anything the CALLER already holds, passed through so this helper doesn't fetch it twice.
     * Same contract as `team` above, extended to the rest of the wave (Ask the Front Office
     * Phase A: its route already loads the season, lineups, events and roster to answer a
     * position question, and re-fetching all four here cost a second full round-trip wave).
     *
     * ⚠ Anything passed MUST belong to `programYear` — this helper cannot re-verify that. Pass
     * only what you fetched for the SAME active season.
     */
    programYear?: { id: string; lineupSettings?: { pitcherMaxInningsDefault?: number | null } | null } | null;
    lineups?: Awaited<ReturnType<typeof getRepTeamSeasonLineups>>;
    events?: Awaited<ReturnType<typeof getRepTeamEvents>>;
    players?: Awaited<ReturnType<typeof getRepRosterPlayers>>;
  },
): Promise<{
  analytics: SeasonLineupAnalytics;
  programYearId: string;
  armCare?: ArmCareConcern[];
  periodLabelPlural?: string;
} | null> {
  const programYear = opts?.programYear ?? (await getActiveRepProgramYear(teamId));
  if (!programYear) return null;

  const [team, lineups, events, players, templates] = await Promise.all([
    opts?.team !== undefined ? Promise.resolve(opts.team) : getRepTeam(teamId),
    opts?.lineups ?? getRepTeamSeasonLineups(programYear.id),
    opts?.events ?? getRepTeamEvents(programYear.id),
    opts?.players ?? getRepRosterPlayers(programYear.id),
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

  if (!opts?.armCareForEventId) return { analytics, programYearId: programYear.id };

  // Arm care for one specific game (D-C7). Innings at the pitcher position per player, per saved
  // lineup, plus each event's calendar day IN THE ORG'S ZONE — "days since their last outing" is a
  // calendar question, so it must not be answered from a raw UTC slice.
  const dayByEvent = new Map(events.map(e => [e.id, orgDayKey(e.startsAt)]));
  const pitcherPos = sportPack.pitcherPosition;
  const armCareLineups: ArmCareLineup[] = pitcherPos
    ? lineups.map(l => ({
        eventId: l.eventId,
        day: dayByEvent.get(l.eventId) ?? '',
        inningsByPlayer: Object.fromEntries(
          l.entries.map(e => [
            e.playerId,
            Object.values(e.inningPositions ?? {}).filter(p => p === pitcherPos).length,
          ]).filter(([, n]) => (n as number) > 0),
        ) as Record<string, number>,
      })).filter(l => l.day)
    : [];

  return {
    analytics,
    programYearId: programYear.id,
    armCare: resolveArmCare({
      today: tournamentToday(),
      todayEventId: opts.armCareForEventId,
      lineups: armCareLineups,
      players: players.map(p => ({
        id: p.id,
        name: playerDisplayName(p),
        perGameCap: p.lineupProfile?.pitcher?.maxInnings ?? null,
      })),
      seasonCap: programYear.lineupSettings?.pitcherMaxInningsDefault ?? null,
      pitcherPosition: pitcherPos,
    }),
    periodLabelPlural: sportPack.periodLabelPlural,
  };
}
