/** Stage 4's preview-only selection rules; no changes to standings or bracket computation. */
import { decidedFinalFor, isTournamentPlayoffsComplete } from './champions';
import { gameStartMs, publicGameState } from './game-status';
import { scheduleGames } from './public-schedule';
import { qualificationCaption } from './public-standings';
import { isPublicBracketVisible } from './public-pages';
import { hasPlayoffPlan } from './playoff-plan';
import { bracketGameLabel, computeBracketColumns, groupGamesByBracketId, inferGamePoolSides } from './playoff-bracket';
import { publicGameRound } from './public-game-detail';
import { formatShortWeekdayDate } from './timezone';
import { formatPoolName } from './utils';
import type { Division, Game, PublicTeam, Tournament } from './types';

interface PlayoffDoorData {
  tournament: Tournament;
  divisions: Division[];
  games: Game[];
  teams: PublicTeam[];
  requireFinalization: boolean;
}

/** Same structural rule as the public tab: a saved plan or a published playoff game, including bracket-only events. */
export function hasPublicPlayoffBracket(tournament: Tournament, divisions: Division[], games: Game[]): boolean {
  const published = new Set(divisions.filter(d => d.scheduleVisibility === 'published').map(d => d.id));
  return isPublicBracketVisible(tournament) && (divisions.some(d => hasPlayoffPlan(d.playoffConfig))
    || games.some(g => g.isPlayoff && published.has(g.divisionId)));
}

export function playoffDoorSub(data: PlayoffDoorData, divisionId: string, now: Date): string | null {
  const division = data.divisions.find(d => d.id === divisionId);
  if (!division || !data.games.some(g => g.divisionId === divisionId && g.isPlayoff)) return null;
  const count = qualificationCaption(division);
  const next = nextPlayoffGame({ ...data, divisionId, now });
  const state = next.kind === 'live' ? publicGameRound(next.game) === 'Championship' ? 'the championship is live now' : 'playoffs are live now'
    : next.kind === 'upcoming' ? `starts ${formatShortWeekdayDate(next.game.date).split(',')[0]}` : null;
  return [count, state].filter(Boolean).join(' · ') || null;
}

/** Presentation only: the canonical column builder owns the format, custom round labels and ordering. */
export function publicBracketRounds(games: Game[]) {
  const positions = computeBracketColumns(games);
  const rounds = new Map<string, { title: string; rank: number; games: Game[] }>();
  for (const game of games) {
    const canonical = positions.get(game.id);
    if (!canonical) continue;
    // The shipped renderer puts the if-needed double-elimination reset to the right of the grand final.
    const info = game.bracketCode?.toUpperCase() === 'GF2'
      ? { key: 'GF2', title: 'Championship (Game 2, if needed)', rank: 501 } : canonical;
    const group = rounds.get(info.key) ?? { title: publicGameRound({ ...game, roundLabel: info.title === 'Finals' ? 'Championship' : info.title }), rank: info.rank, games: [] };
    group.games.push(game);
    rounds.set(info.key, group);
  }
  return [...rounds.values()].sort((a, b) => a.rank - b.rank).map(round => ({ ...round,
    games: [...round.games].sort((a, b) => {
      if (/^FIN/i.test(a.bracketCode ?? '') && /^3RD/i.test(b.bracketCode ?? '')) return -1;
      if (/^3RD/i.test(a.bracketCode ?? '') && /^FIN/i.test(b.bracketCode ?? '')) return 1;
      return (a.bracketCode ?? '').localeCompare(b.bracketCode ?? '');
    }),
  }));
}

export const publicBracketGameLabel = (game: Game): string => game.roundLabel?.trim()
  || (/^(FIN|GF|GF2)$/i.test(game.bracketCode ?? '') ? publicGameRound(game) : bracketGameLabel(game.bracketCode ?? ''));

/** Independent tiers stay separate. A cross-pool feed stays in one diagram, so its connectors do not lose a source. */
export function publicBracketSections(games: Game[], teams: PublicTeam[], pools: { id: string; name: string }[]) {
  const groups = groupGamesByBracketId(games);
  const teamPools = new Map(teams.map(team => [team.id, pools.find(pool => pool.id === team.poolId)?.name ?? '']));
  return groups.flatMap((group, index) => {
    const name = groups.length > 1 ? group.label || `Bracket ${index + 1}` : '';
    const attribution = new Map(group.games.map(game => [game.id, inferGamePoolSides(game, group.games, pools, teamPools)]));
    if (pools.length >= 2 && group.games.every(game => attribution.get(game.id))) return pools.flatMap(pool => {
      const selected = group.games.filter(game => attribution.get(game.id) === pool.name);
      return selected.length ? [{ key: `${group.key}:${pool.id}`, name: [name, `${formatPoolName(pool.name)} Playoffs`].filter(Boolean).join(' · '), games: selected }] : [];
    });
    return [{ key: group.key, name, games: group.games }];
  });
}

/** Scores update in place. Only a shell-level change asks the server to repaint the band/tabs. */
export function competitionShellSignature(data: { tournament: Pick<Tournament, 'status' | 'championsCrownedAt'> | null; pageEnabled: boolean }): string {
  return `${data.pageEnabled}:${data.tournament?.status ?? ''}:${data.tournament?.championsCrownedAt ?? ''}`;
}

export type NextPlayoffGame =
  | { kind: 'live' | 'upcoming'; game: Game }
  | { kind: 'champion'; teamId: string; game: Game }
  | { kind: 'none' };

/** One chosen division. TBD sides remain eligible; past unscored and cancelled games cannot become Up next. */
export function nextPlayoffGame({ games, teams, divisions, divisionId, requireFinalization, now }: {
  games: Game[];
  teams: PublicTeam[];
  divisions: Division[];
  divisionId: string;
  requireFinalization: boolean;
  now: Date;
}): NextPlayoffGame {
  const division = divisions.find(d => d.id === divisionId && d.scheduleVisibility === 'published');
  if (!division) return { kind: 'none' };
  const list = scheduleGames({ games, teams, divisions, division: divisionId, stage: 'playoff' }).games;
  const live = list.find(g => publicGameState(g, requireFinalization, now) === 'live');
  if (live) return { kind: 'live', game: live };
  const next = list.find(g => publicGameState(g, requireFinalization, now) === 'upcoming'
    && (gameStartMs(g) ?? -Infinity) > now.getTime());
  if (next) return { kind: 'upcoming', game: next };
  // Reuse the tier-aware crown rule; an unresolved reset or placement game still blocks completion.
  if (isTournamentPlayoffsComplete(list, [division])) {
    const final = decidedFinalFor(list, divisionId)!;
    const teamId = final.homeScore! > final.awayScore! ? final.homeTeamId : final.awayTeamId;
    return { kind: 'champion', teamId, game: final };
  }
  return { kind: 'none' };
}
