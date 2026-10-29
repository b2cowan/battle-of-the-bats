/** The preview Schedule's selection rules. All inputs come from the published-only public feed. */
import type { Division, Game, PublicTeam, Tournament } from './types';
import { publicGameState } from './game-status';
import { fanPlaceholder, gameSideNames } from './public-game-row';
import { inferGamePoolSides } from './playoff-bracket';
import { hasPlayoffs, hasRoundRobin } from './tournament-phase';

export type ScheduleStage = 'pool' | 'playoff';
// Stage 4 changes the destination and its description together here.
export const SCHEDULE_BRACKET_DOOR = { path: 'standings', label: 'The bracket', sub: 'On the Standings tab' };

/**
 * One day's playoff games, with each division's pool kept together: games sort by time first, so two pools playing the
 * same slots would otherwise interleave and print "Pool A Playoffs" / "Pool B Playoffs" once per slot. A group sits where
 * its first game is, a game with no pool (a cross-pool final) stays where it is, and nothing else moves.
 */
export function groupPoolPlayoffs(list: Game[], poolTags: Map<string, string | null>): Game[] {
  const items: Game[][] = [];
  const groups = new Map<string, Game[]>();
  for (const g of list) {
    const pool = poolTags.get(g.id);
    if (!pool) { items.push([g]); continue; }
    const key = `${g.divisionId}|${pool}`;
    const group = groups.get(key);
    if (group) group.push(g);
    else { const created = [g]; groups.set(key, created); items.push(created); }
  }
  return items.flat();
}

export function visibleScheduleGames(games: Game[], divisions: Division[]): Game[] {
  const published = new Set(divisions.filter(d => d.scheduleVisibility === 'published').map(d => d.id));
  return games.filter(g => published.has(g.divisionId));
}

export function scheduleLandingDay(dates: string[], today: string, pick: string | null, searching = false): string {
  if (searching || dates.length <= 1 || pick === 'all') return 'all';
  return (pick && dates.includes(pick) ? pick : dates.find(d => d >= today) ?? dates.at(-1)) ?? 'all';
}

export function scheduleInitialSelection({ games, divisions, teams, tournament, preference, followedTeamId, highlightId, today, now }: {
  games: Game[]; divisions: Division[]; teams: PublicTeam[]; tournament: Tournament | null;
  preference: string | null; followedTeamId: string | null; highlightId: string | null; today: string; now: Date;
}): { division: string; stage: ScheduleStage; day: string | null; highlight: string | null } {
  const visible = visibleScheduleGames(games, divisions);
  const target = visible.find(g => g.id === highlightId);
  const followed = teams.find(t => t.id === followedTeamId);
  const division = target?.divisionId ?? followed?.divisionId ?? divisions.find(d => d.name === preference)?.id ?? '';
  const playoffsToday = visible.some(g => (!division || g.divisionId === division) && g.isPlayoff &&
    (g.date === today || publicGameState(g, true, now) === 'live'));
  const stage = target ? (target.isPlayoff ? 'playoff' : 'pool') : !hasRoundRobin(tournament) ? 'playoff' :
    hasPlayoffs(tournament) && playoffsToday ? 'playoff' : 'pool';
  return { division, stage, day: target ? target.date || 'all' : null, highlight: target?.id ?? null };
}

export function scheduleGames({ games, teams, divisions, division, stage, query = '', myTeamId = null }: {
  games: Game[]; teams: PublicTeam[]; divisions: Division[]; division: string; stage: ScheduleStage;
  query?: string; myTeamId?: string | null;
}) {
  const visible = visibleScheduleGames(games, divisions);
  const stageGames = visible.filter(g => (!division || g.divisionId === division) && Boolean(g.isPlayoff) === (stage === 'playoff'));
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const poolTags = new Map<string, string | null>();
  for (const d of divisions) {
    const pools = d.pools ?? [];
    if (pools.length < 2) continue;
    const poolNames = new Map(pools.map(p => [p.id, p.name]));
    const teamPools = new Map(teams.filter(t => t.divisionId === d.id && t.poolId).map(t => [t.id, poolNames.get(t.poolId!) ?? '']));
    const divisionGames = stageGames.filter(g => g.divisionId === d.id);
    for (const g of divisionGames) poolTags.set(g.id, inferGamePoolSides(g, divisionGames, pools, teamPools));
  }
  const sorted = [...stageGames].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') ||
    (a.time || '').localeCompare(b.time || '') || (poolTags.get(a.id) ?? '').localeCompare(poolTags.get(b.id) ?? '') || a.id.localeCompare(b.id));
  const q = query.trim().toLowerCase();
  const filtered = sorted.filter(g => {
    if (myTeamId && g.homeTeamId !== myTeamId && g.awayTeamId !== myTeamId) return false;
    if (!q) return true;
    const names = gameSideNames(g, id => teamMap.get(id)?.name ?? 'TBD', fanPlaceholder);
    if (names.home === 'TBD' && names.away === 'TBD') return false;
    return [names.home, names.away, teamMap.get(g.homeTeamId)?.coach, teamMap.get(g.awayTeamId)?.coach]
      .some(s => s?.toLowerCase().includes(q));
  });
  const dates = [...new Set(sorted.map(g => g.date).filter(Boolean))].sort();
  return { games: filtered, dates, poolTags };
}

/** Only confirmed final games on today fold; unofficial, cancelled and live games never do. */
export function splitEarlierToday(games: Game[], today: string, requireFinalization: boolean, now: Date) {
  const earlier: Game[] = [], remaining: Game[] = [];
  for (const g of games) {
    (g.date === today && publicGameState(g, requireFinalization, now) === 'final' ? earlier : remaining).push(g);
  }
  return { earlier, remaining };
}

/** Authoritative replacement, including removals. Changed ids alone animate; inserts never flash as score edits. */
export function changedScheduleGameIds(previous: Game[], next: Game[]): string[] {
  const signature = (g: Game) => `${g.homeScore}:${g.awayScore}:${g.status}`;
  const before = new Map(previous.map(g => [g.id, signature(g)]));
  return next.filter(g => before.has(g.id) && before.get(g.id) !== signature(g)).map(g => g.id);
}
