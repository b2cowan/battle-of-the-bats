/** Stage 4's ranking explainer. The switch-off body keeps its original copy until Stage 8. */
import { BREAKER_LABELS, resolveTieBreakers } from './tie-breakers';
import type { DivisionStandingRow } from './tie-breakers';
import type { Division, Game, PlayoffConfig, PublicTeam, Tournament, TournamentSettings } from './types';
import { publicGameState } from './game-status';
import { isPublicBracketVisible } from './public-pages';

export const STAT_LEGEND: { abbr: string; label: string; vis?: 'mobile' | 'desktop' }[] = [
  { abbr: 'REC', label: 'Record (W-L-T)', vis: 'mobile' },
  { abbr: 'W', label: 'Wins', vis: 'desktop' },
  { abbr: 'L', label: 'Losses', vis: 'desktop' },
  { abbr: 'T', label: 'Ties', vis: 'desktop' },
  { abbr: 'RF', label: 'Runs For' },
  { abbr: 'RA', label: 'Runs Against' },
  { abbr: 'RD', label: 'Run Differential' },
  { abbr: 'PTS', label: 'Points' },
];

export function standingsRanking(
  config: PlayoffConfig | undefined,
  settings: TournamentSettings | undefined,
  rows: Pick<DivisionStandingRow, 'runDiffCap' | 'hasPendingGame'>[],
) {
  const cap = rows.find(row => row.runDiffCap)?.runDiffCap ?? null;
  return {
    legend: STAT_LEGEND,
    order: resolveTieBreakers(config, settings).map(key => BREAKER_LABELS[key]).join(' > '),
    capNote: cap
      ? `RD shows the true run differential, with the playoff-seeding value in brackets — capped at ±${cap} per game. Seeding uses the capped figure, so a bigger RD doesn't always mean a higher seed.`
      : null,
    pendingNote: rows.some(row => row.hasPendingGame)
      ? 'Unofficial scores are included here for visibility. Standings may change once the organizer confirms them.'
      : null,
  };
}

/** Server boundary for the new competition pages. The legacy feeds keep their existing contract. */
export function publishedCompetitionData<T extends {
  divisions: Division[]; games: Game[]; teams: PublicTeam[];
  standingsByDivision: Record<string, DivisionStandingRow[]>;
}>(data: T): T {
  const divisions = data.divisions.filter(d => d.scheduleVisibility === 'published');
  const ids = new Set(divisions.map(d => d.id));
  return {
    ...data, divisions,
    games: data.games.filter(g => ids.has(g.divisionId)),
    teams: data.teams.filter(t => t.status === 'accepted' && ids.has(t.divisionId)),
    standingsByDivision: Object.fromEntries(divisions.map(d => [d.id, data.standingsByDivision[d.id] ?? []])),
  };
}

/** An invalid/withdrawn remembered selection falls back to the first published division. */
export function standingsDivision(divisions: Division[], pick: string): Division | undefined {
  return divisions.find(d => d.id === pick && d.scheduleVisibility === 'published')
    ?? divisions.find(d => d.scheduleVisibility === 'published');
}

/** Counts describe the pool games that feed this table, as in the revised drawing and the standings engine. */
export function qualificationCaption(division: Division): string {
  const count = division.playoffConfig?.teamsQualifying ?? 0;
  const perPool = (division.pools?.length ?? 0) > 1 && (division.playoffConfig?.crossover ?? 'none') === 'none';
  return count > 0 ? `Top ${count}${perPool ? ' per pool' : ''} advance` : '';
}

export function standingsCounts(tournament: Tournament, division: Division, games: Game[], requireFinalization: boolean, now: Date): string {
  if (division.scheduleVisibility !== 'published') return '';
  const counts = { final: 0, submitted: 0, remaining: 0 };
  for (const game of games) {
    if (game.divisionId !== division.id || game.isPlayoff) continue;
    const state = publicGameState(game, requireFinalization, now);
    if (state === 'final') counts.final++;
    else if (state === 'unofficial') counts.submitted++;
    else if (state !== 'cancelled') counts.remaining++;
  }
  return [
    isPublicBracketVisible(tournament) ? qualificationCaption(division) : '',
    counts.final ? `${counts.final} ${counts.final === 1 ? 'game' : 'games'} final` : '',
    counts.submitted ? `${counts.submitted} Submitted` : '',
    counts.remaining ? `${counts.remaining} left to play` : '',
  ].filter(Boolean).join(' · ');
}

/** Preserve the engine's order, including lower tie-breakers; never re-rank by points in the presenter. */
export function standingsAdvancing(tournament: Tournament, division: Division, rows: DivisionStandingRow[]): Set<string> {
  const count = division.playoffConfig?.teamsQualifying ?? 0;
  if (division.scheduleVisibility !== 'published' || !isPublicBracketVisible(tournament) || count <= 0 || !rows.some(row => row.gp > 0)) return new Set();
  const pools = division.pools ?? [];
  const combined = (division.playoffConfig?.crossover ?? 'none') !== 'none' || pools.length <= 1;
  const selected = combined ? rows.slice(0, count)
    : pools.flatMap(pool => rows.filter(row => row.poolId === pool.id).slice(0, count));
  return new Set(selected.map(row => row.teamId));
}

export function standingsRankChanges(before: DivisionStandingRow[], after: DivisionStandingRow[], pools: Division['pools']): Map<string, 'up' | 'down'> {
  const ranks = (rows: DivisionStandingRow[]) => {
    const groups = (pools?.length ?? 0) >= 2 ? pools!.map(pool => rows.filter(row => row.poolId === pool.id)) : [rows];
    return new Map(groups.flatMap(group => group.map((row, index) => [row.teamId, index] as const)));
  };
  const previous = ranks(before);
  return new Map([...ranks(after)].flatMap(([id, rank]) => {
    const old = previous.get(id);
    return old === undefined || old === rank ? [] : [[id, rank < old ? 'up' as const : 'down' as const] as const];
  }));
}
