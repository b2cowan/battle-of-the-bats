import 'server-only';
import {
  getRepTeamGameEventsForOpponentBook,
  getRepTeamOpponents,
  getRepTeamOpponentAliases,
  getRepTeamOpponentObservations,
  getRepTeamLineupsForEvents,
  getRepRosterPlayersByIds,
} from './db';
import { buildOpponentBook, type OpponentBookEntry } from './coach-opponents';
import { computeOpponentInsights, type OpponentInsightLine } from './coach-opponent-insights';
import { playerName } from './coach-roster-name';
import { positionLabel, type SportPack } from './sports';
import type { RepTeamOpponentObservation } from './types';

/**
 * One opponent's assembled card — entry, observation log, and the "numbers vs them"
 * insight lines — shared by the card GET and the staff-chat share route so the snapshot a
 * coach posts can never disagree with the card they are looking at.
 *
 * INSTRUMENT, off the season rail by decision (owner 2026-08-04): reads every season's
 * games to feed the LIVE season's preparation.
 */
export interface AssembledOpponentCard {
  entry: OpponentBookEntry;
  observations: RepTeamOpponentObservation[];
  insights: OpponentInsightLine[];
  /** THIS entry's merged-away spellings, id-bearing for the un-merge control. Served from
   *  the alias read the assembly already does — callers must not re-fetch the table. */
  aliases: { id: string; normalizedAlias: string }[];
}

export async function assembleOpponentCard(opts: {
  teamId: string;
  /** Normalized key from the URL — may be an alias of the owning entry. */
  key: string;
  /** The live season's program year id — the insights' "this season" split. */
  activeYearId: string | null;
  sportPack: SportPack;
}): Promise<AssembledOpponentCard | null> {
  const { teamId, key, activeYearId, sportPack } = opts;
  const [events, opponents, aliases] = await Promise.all([
    getRepTeamGameEventsForOpponentBook(teamId),
    getRepTeamOpponents(teamId),
    getRepTeamOpponentAliases(teamId),
  ]);
  // Observation counts are NOT fetched here: this serves ONE opponent, and its count is
  // just `observations.length` from the per-opponent read below — a team-wide count scan
  // would be a redundant round trip on every card view.
  const entries = buildOpponentBook({
    events, opponents, aliases,
    nowIso: new Date().toISOString(),
  });
  // The key may be an alias of the owning entry — normalize then look both ways.
  let entry = entries.find(e => e.key === key) ?? null;
  if (!entry) {
    const aliased = aliases.find(a => a.normalizedAlias === key);
    const owner = aliased ? opponents.find(o => o.id === aliased.opponentId) : null;
    entry = owner ? entries.find(e => e.key === owner.normalizedName) ?? null : null;
  }
  if (!entry) return null;
  const opponentId = entry.opponentId;

  // Observations and lineups depend only on the resolved entry, never on each other —
  // one round trip's latency, not two. Lineups are fetched only when the insight floors
  // are even reachable (≥2 counted meetings) — the common one-meeting card pays nothing.
  const countedIds = entry.meetings.filter(m => m.counted).map(m => m.eventId);
  const [observations, lineups] = await Promise.all([
    opponentId
      ? getRepTeamOpponentObservations(teamId, opponentId)
      : Promise.resolve<RepTeamOpponentObservation[]>([]),
    countedIds.length >= 2
      ? getRepTeamLineupsForEvents(teamId, countedIds)
      : Promise.resolve<Awaited<ReturnType<typeof getRepTeamLineupsForEvents>>>({}),
  ]);
  const playerIds = [...new Set(Object.values(lineups).flat().map(e => e.playerId))];
  const players = playerIds.length > 0 ? await getRepRosterPlayersByIds(playerIds, teamId) : [];
  const playerNames: Record<string, string> = {};
  for (const p of players) playerNames[p.id] = playerName(p);

  const insights = computeOpponentInsights({
    meetings: entry.meetings,
    activeYearId,
    unitPlural: sportPack.score.unitPlural,
    pitcherPosition: sportPack.pitcherPosition,
    pitcherPositionLabel: sportPack.pitcherPosition ? positionLabel(sportPack, sportPack.pitcherPosition) : null,
    fieldPositions: sportPack.fieldPositions,
    lineups,
    playerNames,
  });

  return {
    entry,
    observations,
    insights,
    aliases: opponentId
      ? aliases.filter(a => a.opponentId === opponentId).map(a => ({ id: a.id, normalizedAlias: a.normalizedAlias }))
      : [],
  };
}
