/**
 * Bracket schedule metrics — the playoff analogue of lib/schedule-metrics.ts.
 *
 * Round-robin metrics treat each team as a fixed set of games and measure rest
 * between them. That model is wrong for a bracket: the participants are seeds
 * that flow through the tree, and a label like "Winner GF" is a ROLE, not a
 * team. Who plays which downstream game is unknown until results come in.
 *
 * What IS knowable is the bracket's structure: every advancement edge
 * ("Winner X" / "Loser X" feeds game Y) has a turnaround that depends only on
 * the two games' slots, not on who advances. So we measure the edges, not the
 * nodes:
 *   - tightest advancement turnaround (the bottleneck any advancing team faces)
 *   - feasibility violations (a game scheduled before its feeder finishes + rest)
 *   - worst-case games in a day a single advancing team could be forced into
 *   - the longest run to the title (most games one team could play, over N days)
 *
 * Pure + dependency-free so it can be unit-tested with `node --test`.
 */
import type { ScheduleIssue } from './schedule-metrics';

export interface BracketGameInput {
  /** Bracket code, e.g. "WB1-1", "SF1", "GF", "GF2". */
  code: string;
  /** Home participant placeholder, e.g. "1st Pool A" | "Winner WB1-1" | "Loser GF". */
  home: string | null;
  /** Away participant placeholder. */
  away: string | null;
  date: string | null;
  time: string | null;
  /** Pool name for split-pool (crossover='none') brackets — scopes codes so two
   *  pools' identical codes (both have a "GF") never resolve across pools. */
  pool?: string | null;
}

export interface BracketScheduleMetricsOptions {
  gameDurationMinutes: number;
  /** Minimum rest after a feeder game before a dependent game may start. */
  minRestMinutes?: number;
}

export interface BracketScheduleMetrics {
  totalGames: number;
  scheduledGames: number;
  edgeCount: number;
  scheduledEdgeCount: number;
  /** Smallest turnaround across all scheduled advancement edges (may be negative). */
  tightestTurnaroundMinutes: number | null;
  /** Scheduled edges whose turnaround is below the min-rest threshold. */
  tooTightCount: number;
  /** Scheduled edges whose turnaround is negative (game starts before its feeder ends). */
  infeasibleCount: number;
  minRestMinutes: number;
  /** Most games a single advancing team could be forced into on one day. */
  worstCaseGamesPerDay: number;
  /** Most games a single team could play overall (the deepest run, e.g. the
   *  losers-bracket grind in double elimination). Structural — needs no times. */
  longestPathGames: number;
  /** Distinct dates spanned by that longest run (null until games are scheduled). */
  longestPathDays: number | null;
  /** Wall-clock minutes from the first to the last game of that run (null until scheduled). */
  longestPathSpanMinutes: number | null;
  issues: ScheduleIssue[];
  healthScore: number;
  healthTone: 'good' | 'warning' | 'danger';
}

const ADVANCEMENT_RE = /^(winner|loser)\s+(.+)$/i;

const scopeOf = (g: BracketGameInput) => (g.pool ?? '__global__').trim().toLowerCase();
const scopedKey = (scope: string, code: string) => `${scope}::${code.trim().toUpperCase()}`;

function startMs(g: BracketGameInput): number | null {
  if (!g.date || !g.time) return null;
  const time = g.time.length === 5 ? `${g.time}:00` : g.time;
  const t = Date.parse(`${g.date}T${time}`);
  return Number.isNaN(t) ? null : t;
}

export function buildBracketScheduleMetrics(
  games: BracketGameInput[],
  options: BracketScheduleMetricsOptions,
): BracketScheduleMetrics {
  const duration = Math.max(0, options.gameDurationMinutes || 0);
  const minRest = Math.max(0, options.minRestMinutes ?? 0);

  // Index games by scoped code; precompute start/end.
  const byKey = new Map<string, BracketGameInput>();
  const startOf = new Map<string, number | null>();
  const endOf = new Map<string, number | null>();
  for (const g of games) {
    if (!g.code) continue;
    const key = scopedKey(scopeOf(g), g.code);
    byKey.set(key, g);
    const s = startMs(g);
    startOf.set(key, s);
    endOf.set(key, s == null ? null : s + duration * 60_000);
  }

  const scheduledGames = [...startOf.values()].filter(s => s != null).length;

  // Advancement edges: source game X → consuming game Y (within the same pool).
  const successors = new Map<string, string[]>();   // X key → [Y keys]
  let edgeCount = 0;
  let scheduledEdgeCount = 0;
  let tightest: number | null = null;
  let tooTight = 0;
  let infeasible = 0;

  for (const y of games) {
    if (!y.code) continue;
    const scope = scopeOf(y);
    const yKey = scopedKey(scope, y.code);
    for (const ph of [y.home, y.away]) {
      const m = (ph ?? '').match(ADVANCEMENT_RE);
      if (!m) continue;
      const xKey = scopedKey(scope, m[2]);
      const x = byKey.get(xKey);
      if (!x || xKey === yKey) continue;
      edgeCount++;
      let succ = successors.get(xKey);
      if (!succ) { succ = []; successors.set(xKey, succ); }
      succ.push(yKey);

      const xEnd = endOf.get(xKey) ?? null;
      const yStart = startOf.get(yKey) ?? null;
      if (xEnd != null && yStart != null) {
        scheduledEdgeCount++;
        const rest = Math.round((yStart - xEnd) / 60_000);
        tightest = tightest == null ? rest : Math.min(tightest, rest);
        if (rest < 0) infeasible++;
        if (rest < minRest) tooTight++;
      }
    }
  }

  // Longest path through the DAG = most games one team could play. Structural
  // (no times needed). Memoized DFS; cycle-guarded defensively.
  const lenMemo = new Map<string, number>();
  const nextMemo = new Map<string, string | null>();
  const longestFrom = (key: string, stack: Set<string>): number => {
    const cached = lenMemo.get(key);
    if (cached != null) return cached;
    if (stack.has(key)) return 1;
    stack.add(key);
    let best = 1;
    let bestNext: string | null = null;
    for (const s of successors.get(key) ?? []) {
      const candidate = 1 + longestFrom(s, stack);
      if (candidate > best) { best = candidate; bestNext = s; }
    }
    stack.delete(key);
    lenMemo.set(key, best);
    nextMemo.set(key, bestNext);
    return best;
  };

  let longestPathGames = 0;
  let longestStart: string | null = null;
  for (const key of byKey.keys()) {
    const len = longestFrom(key, new Set());
    if (len > longestPathGames) { longestPathGames = len; longestStart = key; }
  }

  // Walk the longest path to measure its day span (only across scheduled games).
  let longestPathDays: number | null = null;
  let longestPathSpanMinutes: number | null = null;
  if (longestStart) {
    const dates = new Set<string>();
    const starts: number[] = [];
    const ends: number[] = [];
    let cur: string | null = longestStart;
    while (cur) {
      const g = byKey.get(cur);
      if (g?.date && startOf.get(cur) != null) {
        dates.add(g.date);
        starts.push(startOf.get(cur)!);
        ends.push(endOf.get(cur)!);
      }
      cur = nextMemo.get(cur) ?? null;
    }
    if (dates.size > 0) {
      longestPathDays = dates.size;
      longestPathSpanMinutes = Math.round((Math.max(...ends) - Math.min(...starts)) / 60_000);
    }
  }

  // Worst-case games in a single day for one team: longest chain of same-date
  // games connected by advancement edges. Only over scheduled games.
  const sameDayMemo = new Map<string, number>();
  const sameDayLongest = (key: string, stack: Set<string>): number => {
    const cached = sameDayMemo.get(key);
    if (cached != null) return cached;
    if (stack.has(key)) return 1;
    const g = byKey.get(key);
    if (!g || startOf.get(key) == null) return 0;
    stack.add(key);
    let best = 1;
    for (const s of successors.get(key) ?? []) {
      const sg = byKey.get(s);
      if (sg && sg.date === g.date && startOf.get(s) != null) {
        best = Math.max(best, 1 + sameDayLongest(s, stack));
      }
    }
    stack.delete(key);
    sameDayMemo.set(key, best);
    return best;
  };
  let worstCaseGamesPerDay = 0;
  for (const key of byKey.keys()) {
    if (startOf.get(key) != null) worstCaseGamesPerDay = Math.max(worstCaseGamesPerDay, sameDayLongest(key, new Set()));
  }

  // ── issues + health score ───────────────────────────────────────────────────
  const issues: ScheduleIssue[] = [];
  if (infeasible > 0) {
    issues.push({
      severity: 'error',
      code: 'bracket_infeasible',
      title: `${infeasible} impossible turnaround${infeasible === 1 ? '' : 's'}`,
      detail: 'A game is scheduled to start before the game that feeds it has finished. Spread these games out or add time.',
      count: infeasible,
    });
  }
  const tightOnly = tooTight - infeasible;
  if (tightOnly > 0) {
    issues.push({
      severity: 'warning',
      code: 'bracket_tight_rest',
      title: `${tightOnly} tight turnaround${tightOnly === 1 ? '' : 's'}`,
      detail: `An advancing team would get less than ${minRest} min rest. Lengthen the gap or lower the minimum rest.`,
      count: tightOnly,
    });
  }
  if (worstCaseGamesPerDay >= 3) {
    issues.push({
      severity: worstCaseGamesPerDay >= 4 ? 'warning' : 'info',
      code: 'bracket_games_per_day',
      title: `Up to ${worstCaseGamesPerDay} games in a day`,
      detail: 'A team that keeps advancing could play this many games on a single day. Consider spreading rounds across days.',
      count: worstCaseGamesPerDay,
    });
  }

  let healthScore = 100;
  healthScore -= infeasible * 25;
  healthScore -= tightOnly * 8;
  if (worstCaseGamesPerDay >= 4) healthScore -= 20;
  else if (worstCaseGamesPerDay === 3) healthScore -= 10;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  const healthTone: BracketScheduleMetrics['healthTone'] = healthScore >= 85 ? 'good' : healthScore >= 70 ? 'warning' : 'danger';

  return {
    totalGames: byKey.size,
    scheduledGames,
    edgeCount,
    scheduledEdgeCount,
    tightestTurnaroundMinutes: tightest,
    tooTightCount: tooTight,
    infeasibleCount: infeasible,
    minRestMinutes: minRest,
    worstCaseGamesPerDay,
    longestPathGames,
    longestPathDays,
    longestPathSpanMinutes,
    issues,
    healthScore,
    healthTone,
  };
}
