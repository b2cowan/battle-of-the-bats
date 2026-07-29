import 'server-only';
import {
  getRepTeamEvents,
  getRepTeamAttendanceReliability,
  getRepRosterPlayers,
  getRepTeamPlayerAwardsHydrated,
  getRepTeamSeasonLineups,
  getRepTeamLineupTemplates,
} from './db';
import type { RepProgramYear, RepTeam } from './types';
import { getSportPack, DEFAULT_SPORT } from './sports';
import { cleanNamePart } from './coach-roster-name';
import { computeSeasonLineupAnalytics } from './lineup-season-analytics';
import { computeSeasonWrapped, type SeasonWrappedStats } from './season-wrapped';

export interface SeasonWrappedPayload extends SeasonWrappedStats {
  seasonId: string;
  seasonName: string;
  seasonYear: number;
  seasonStatus: string;
  teamName: string;
  teamColor: string | null;
  teamSport: string;
}

/**
 * Assemble the Season Wrapped payload for ONE program year (Coach Portal Batch 3, wow #7).
 * Year-scoped by construction — every fetch is keyed on the given program year, so it works
 * identically for the just-closed season and any archived one. Awards have no year column;
 * they scope through the year's roster rows (rep_player_awards → rep_roster_players, which
 * are per-year). No money data — Wrapped is shareable, money stays in Insights.
 */
export async function assembleSeasonWrapped(
  team: RepTeam,
  programYear: RepProgramYear,
  opts?: {
    /** Used when the team has no color of its own (owner call, Batch 3 QA: a colorless
     *  team's card fell back to generic near-navy, which read as a dark-theme leak on the
     *  light theme — the org's brand color is the honest next-best branding). */
    fallbackColor?: string | null;
  },
): Promise<SeasonWrappedPayload> {
  const [events, attendanceByPlayer, roster, allAwards, lineups, templates] = await Promise.all([
    getRepTeamEvents(programYear.id),
    getRepTeamAttendanceReliability(programYear.id),
    getRepRosterPlayers(programYear.id),
    getRepTeamPlayerAwardsHydrated(team.id, team.orgId),
    getRepTeamSeasonLineups(programYear.id),
    getRepTeamLineupTemplates(team.id, programYear.id),
  ]);

  const rosterIds = new Set(roster.map(p => p.id));
  const awards = allAwards
    .filter(a => rosterIds.has(a.playerId))
    .map(a => ({ playerId: a.playerId, typeName: a.awardType?.name ?? 'Award' }));

  // Share-safe label: FIRST name + jersey number only (approved mockups — never a full
  // name on a card built to leave the app).
  const playerLabelById: Record<string, string> = {};
  for (const p of roster) {
    // cleanNamePart also guards against literal "null"/"undefined" strings from old imports.
    const first = cleanNamePart(p.playerFirstName) || 'Player';
    playerLabelById[p.id] = p.playerNumber ? `${first} #${p.playerNumber}` : first;
  }

  const sportPack = getSportPack(team.sport ?? DEFAULT_SPORT);
  const analytics = computeSeasonLineupAnalytics({
    lineups,
    scores: events.map(e => ({ eventId: e.id, teamScore: e.teamScore, opponentScore: e.opponentScore })),
    // Share-safe names on purpose: a reused lineup with no template name gets a label built
    // from player names, and that label rides the Wrapped payload — full names must never
    // reach a payload documented as share-safe (adversarial review). Template names are
    // coach-authored and stay as-is.
    players: roster.map(p => ({
      id: p.id,
      name: playerLabelById[p.id],
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

  const stats = computeSeasonWrapped({
    events: events.map(e => ({
      eventType: e.eventType,
      startsAt: e.startsAt,
      status: e.status,
      result: e.result ?? null,
      teamScore: e.teamScore ?? null,
      opponentScore: e.opponentScore ?? null,
      opponent: e.opponent ?? null,
      homeAway: e.homeAway ?? null,
    })),
    attendance: [...attendanceByPlayer.values()].map(a => ({
      attended: a.games.attended,
      known: a.games.known,
    })),
    awards,
    playerLabelById,
    reusedLineups: analytics.reusedLineups,
    gamesWithLineup: analytics.gamesWithLineup,
    rosterCount: roster.length,
  });

  return {
    ...stats,
    seasonId: programYear.id,
    seasonName: programYear.name,
    seasonYear: programYear.year,
    seasonStatus: programYear.status,
    teamName: team.name,
    teamColor: team.color ?? opts?.fallbackColor ?? null,
    teamSport: team.sport ?? DEFAULT_SPORT,
  };
}
