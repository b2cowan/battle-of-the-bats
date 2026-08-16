import 'server-only';
import {
  getRepTeamEvents,
  getRepTeamAttendanceReliability,
  getRepRosterPlayers,
  getRepTeamGameMomentsForSeason,
  getRepTeamPlayerAwardsHydrated,
  scopeAwardsToSeasonRoster,
  getRepTeamSeasonLineups,
  getRepTeamLineupTemplates,
} from './db';
import type { RepProgramYear, RepTeam } from './types';
import { getSportPack, DEFAULT_SPORT } from './sports';
import { cleanNamePart } from './coach-roster-name';
import { computeSeasonLineupAnalytics } from './lineup-season-analytics';
import { computeSeasonWrapped, type SeasonWrappedStats } from './season-wrapped';
import { deriveWrappedMomentSlot, type WrappedMomentSlot } from './coach-game-moments';

export interface SeasonWrappedPayload extends SeasonWrappedStats {
  seasonId: string;
  seasonName: string;
  seasonYear: number;
  seasonStatus: string;
  teamName: string;
  teamColor: string | null;
  teamSport: string;
  /**
   * Game-Day P2 — one bench moment and the season's count (owner ruling 2026-08-05).
   *
   * ⚠ A SIBLING OF THE STATS, NEVER PART OF THEM. `SeasonWrappedStats` is key-locked by test
   * against ever growing a moments field, because everything inside it is analytic — and
   * because the shareable PNG is built from that shape. A moment is coach-written free text
   * about a child; it renders on the coach's own screen and is excluded from the share card by
   * construction (`wrappedShareCardData`).
   */
  momentSlot: WrappedMomentSlot | null;
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
    /**
     * Game-Day P2 — may THIS caller receive the bench moment?
     *
     * ⚠ DEFAULTS FALSE, deliberately. The rest of this payload is a season's public-facing
     * story; a moment is a coach's private line about a child, and it is gated everywhere
     * else on `canLogGameMoment` (who runs the bench). Riding this route's own wider door
     * (`hasRecordAccess`, a union of seven duties) would have handed it to a money-only or
     * documents-only assistant who cannot see a moment on any other surface. A caller that
     * forgets this flag gets no moment, which is the safe way to be forgotten.
     */
    includeMoments?: boolean;
  },
): Promise<SeasonWrappedPayload> {
  const [events, attendanceByPlayer, roster, allAwards, lineups, templates, moments] = await Promise.all([
    getRepTeamEvents(programYear.id),
    getRepTeamAttendanceReliability(programYear.id),
    getRepRosterPlayers(programYear.id),
    getRepTeamPlayerAwardsHydrated(team.id, team.orgId),
    getRepTeamSeasonLineups(programYear.id),
    getRepTeamLineupTemplates(team.id, programYear.id),
    // ⚠ The one place a moment reaches a FINISHED season (owner ruling 2026-08-05): a moment is
    // a record of a night that happened, it cannot be edited after the fact, and it reads as it
    // read at the time. Capture and deletion stay live-season-only — this read has no sibling
    // write, so a closed season shows moments and offers no way to change one.
    // Gated at the SOURCE, like every other moments read: no grant, no payload.
    opts?.includeMoments ? getRepTeamGameMomentsForSeason(team.id, programYear.id) : Promise.resolve([]),
  ]);

  // Awards carry no year column — they scope through the year's roster rows. The shared helper
  // holds that reasoning (2026-08-16); this was the only caller that had it right, and the
  // awards report next door had it wrong for as long as it existed.
  const awards = scopeAwardsToSeasonRoster(allAwards, roster)
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

  // The dateline reads "vs Oakville Thunder", from the game the moment was captured at.
  const gameLabelById = new Map(events.map(e => [
    e.id,
    e.opponent ? `${e.homeAway === 'away' ? '@' : 'vs'} ${e.opponent}` : e.name,
  ]));

  return {
    ...stats,
    momentSlot: deriveWrappedMomentSlot(moments, gameLabelById),
    seasonId: programYear.id,
    seasonName: programYear.name,
    seasonYear: programYear.year,
    seasonStatus: programYear.status,
    teamName: team.name,
    teamColor: team.color ?? opts?.fallbackColor ?? null,
    teamSport: team.sport ?? DEFAULT_SPORT,
  };
}
