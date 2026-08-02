import 'server-only';
import {
  getRepTeamAttendanceReliability,
  getRepRosterPlayers,
  getRepPlayerDevelopmentGoalsForPlayer,
  getRepPlayerMeasurablesForPlayer,
  getRepPlayerAwardsForPlayer,
  getRepTeamAwardTypeLibrary,
  getRepTeamSeasonLineups,
  getRepTeamLineupTemplates,
  getRepTeamMeasurableTypes,
  getRepTeamEvents,
} from './db';
import type { RepProgramYear, RepTeam } from './types';
import { getSportPack, DEFAULT_SPORT } from './sports';
import { cleanNamePart } from './coach-roster-name';
import { computeSeasonLineupAnalytics } from './lineup-season-analytics';
import { computeSeasonWrapped } from './season-wrapped';
import { computePlayerSeasonRecap, isRecapEmpty, type PlayerSeasonRecapStats } from './player-season-recap';

/**
 * lib/rep-player-season-recap.ts — assemble ONE player's season recap (Chunk D 3.2).
 *
 * The per-player sibling of `lib/rep-season-wrapped.ts`, and it follows that file's season
 * scoping exactly: `playerId` is ITSELF season-scoped (a rollover mints a new roster row each
 * season), so goals, measurables and awards need no year filter — they cannot belong to
 * another season. Attendance and lineups are keyed on the program year directly.
 *
 * ⚠ THE PAYLOAD IS AN ALLOW-LIST. This is a child's record leaving the server toward a
 * guardian's phone. The roster row this reads also carries medical notes, admin notes,
 * emergency contacts, guardian phone numbers and dues — none of which has a field to land in
 * here. Adding one is a decision, not a refactor. First name and jersey only on the identity
 * line, matching the share-safe rule the keepsake card depends on.
 */

export interface PlayerSeasonRecapPayload extends PlayerSeasonRecapStats {
  playerId: string;
  /** First name only. The surname is what the certificate is for; this payload feeds a
   *  screen and a shareable image, and a surname has no business on either. */
  playerFirstName: string;
  playerNumber: string | null;
  primaryPosition: string | null;
  seasonId: string;
  seasonName: string;
  seasonYear: number;
  seasonStatus: string;
  teamName: string;
  teamColor: string | null;
  orgName: string;
  /** The team's season, for the "12–6–2" line under the player's name. */
  teamRecord: { wins: number; losses: number; ties: number; games: number };
  /** True when nothing truthful could be assembled — the surface says so plainly. */
  isEmpty: boolean;
}

export async function assemblePlayerSeasonRecap(
  team: RepTeam,
  programYear: RepProgramYear,
  playerId: string,
  context: { orgName: string; fallbackColor?: string | null },
): Promise<PlayerSeasonRecapPayload | null> {
  // Nothing below depends on the roster, so the "is this player on this season" check does
  // not gate the batch — it is applied to the result. The roster IS needed afterwards, to
  // label the lineup engine's players.
  const [
    roster, attendanceByPlayer, goals, measurables, measurableTypes,
    playerAwardRows, awardTypes, lineups, templates, events,
  ] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamAttendanceReliability(programYear.id),
    getRepPlayerDevelopmentGoalsForPlayer(playerId),
    getRepPlayerMeasurablesForPlayer(playerId),
    // Retired types included: a test the coach stopped using mid-season still produced real
    // readings, and dropping its NAME would leave the recap describing an unnamed number.
    getRepTeamMeasurableTypes(team.id, { includeRetired: true }),
    // Player-scoped, NOT the hydrated team-wide read: that one runs two extra queries to
    // attach every awarded player's full name and every award's opponent, none of which this
    // payload may carry. Fetching a child's name in order to throw it away is the wrong shape
    // for a module whose whole discipline is first-name-only.
    getRepPlayerAwardsForPlayer(playerId),
    getRepTeamAwardTypeLibrary(team.id, team.orgId, { includeRetired: true }),
    getRepTeamSeasonLineups(programYear.id),
    getRepTeamLineupTemplates(team.id, programYear.id),
    getRepTeamEvents(programYear.id),
  ]);

  const player = roster.find(p => p.id === playerId);
  // Not on this season's roster ⇒ there is no recap, and no reason to tell the caller which
  // of "wrong player" or "wrong season" it was.
  if (!player) return null;

  const typeNameById = new Map(measurableTypes.map(t => [t.id, t.name]));
  const awardTypeById = new Map(awardTypes.map(t => [t.id, t]));

  const attendance = attendanceByPlayer.get(playerId);
  const blank = { attended: 0, known: 0, recorded: 0 };

  // Awards are scoped to the SEASON through the roster row, exactly as Wrapped does it:
  // `rep_player_awards` has no year column, and this player id belongs to this year alone.
  const playerAwards = playerAwardRows.map(a => {
    const type = awardTypeById.get(a.awardTypeId);
    return {
      name: type?.name ?? 'Award',
      emoji: type?.emoji ?? null,
      awardedAt: a.awardedAt,
    };
  });

  // Share-safe labels into the lineup engine — the same rule Wrapped documents: a reused
  // lineup with no template name builds its label from player names, and full names must
  // never reach a payload that can become an image.
  const sportPack = getSportPack(team.sport ?? DEFAULT_SPORT);
  const analytics = computeSeasonLineupAnalytics({
    lineups,
    scores: events.map(e => ({ eventId: e.id, teamScore: e.teamScore, opponentScore: e.opponentScore })),
    players: roster.map(p => {
      const first = cleanNamePart(p.playerFirstName) || 'Player';
      return {
        id: p.id,
        name: p.playerNumber ? `${first} #${p.playerNumber}` : first,
        isPitcher: !!p.lineupProfile?.pitcher,
        pitcherCap: p.lineupProfile?.pitcher?.maxInnings ?? null,
      };
    }),
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

  const mine = analytics.fairPlay.find(f => f.playerId === playerId) ?? null;

  const stats = computePlayerSeasonRecap({
    attendanceGames: attendance
      ? { ...attendance.games }
      : blank,
    attendancePractices: attendance
      ? { ...attendance.practices }
      : blank,
    goals: goals.map(g => ({ focusArea: g.focusArea, status: g.status })),
    // A reading whose type was hard-deleted has no name to show, and "8.2 → 7.6 of what?" is
    // worse than silence. Dropped rather than labelled with a placeholder.
    measurables: measurables
      .filter(m => typeNameById.has(m.measurableTypeId))
      .map(m => ({
        // The ID is the grouping key; the name is display only. Two retired-and-recreated
        // tests share a name but never an id — see RecapMeasurableInput.
        typeId: m.measurableTypeId,
        typeName: typeNameById.get(m.measurableTypeId) as string,
        value: m.value,
        // The reading carries its own unit snapshot — render THIS, never re-join to the type.
        unit: m.unit,
        recordedOn: m.recordedOn,
      })),
    awards: playerAwards,
    playingTime: mine
      ? {
          fieldInnings: mine.fieldInnings,
          benchInnings: mine.benchInnings,
          gamesWithLineup: analytics.gamesWithLineup,
          teamFieldInnings: analytics.fairPlay.map(f => f.fieldInnings),
        }
      : null,
  });

  // The team's season line under the player's name comes from the CANONICAL record rule, not
  // a fifth hand-rolled tally — a recap that disagreed with the Wrapped card a tap away would
  // be worse than no line at all. Only the record is read from the result; the other tiles
  // are the team's story, not this player's, and are deliberately not assembled here.
  const teamRecord = computeSeasonWrapped({
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
    attendance: [],
    awards: [],
    playerLabelById: {},
    reusedLineups: [],
    gamesWithLineup: 0,
    rosterCount: 0,
  }).record;

  return {
    ...stats,
    playerId: player.id,
    playerFirstName: cleanNamePart(player.playerFirstName) || 'Player',
    playerNumber: player.playerNumber,
    primaryPosition: player.primaryPosition,
    seasonId: programYear.id,
    seasonName: programYear.name,
    seasonYear: programYear.year,
    seasonStatus: programYear.status,
    teamName: team.name,
    teamColor: team.color ?? context.fallbackColor ?? null,
    orgName: context.orgName,
    teamRecord,
    isEmpty: isRecapEmpty(stats),
  };
}
