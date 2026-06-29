// Lineup auto-generator. Produces a per-player inning→position map the coach can then
// tweak — never a final answer. Fairness is a HARD guarantee (even bench counts, no
// back-to-back sits when avoidable); ties are broken RANDOMLY so each "Generate" gives a
// natural, non-repetitive rotation rather than the same rigid roster-order blocks.
//
// Diamond fielding positions (softball/baseball). The coach portal is softball/baseball
// today; a future sport would supply its own field-position list.

const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const BENCH = 'Bench';

/** Fisher–Yates shuffle (runtime randomness — this runs in the browser, not a workflow). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type PositionPolicy = 'competitive' | 'balanced' | 'development';
export type FillMode = 'empty' | 'regenerate';

export interface GeneratorPlayer {
  playerId: string;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  inningPositions: Record<string, string>; // existing grid (honored when fillMode = 'empty')
}

export interface GenerateOptions {
  players: GeneratorPlayer[];
  inningCount: number;
  policy: PositionPolicy;
  fillMode: FillMode;
}

const norm = (s: string | null | undefined) => (s ?? '').toUpperCase().trim();

/** Returns playerId → { inning(string) → position }. Only field positions + Bench are written. */
export function generateLineup(opts: GenerateOptions): Map<string, Record<string, string>> {
  const { players, inningCount, policy, fillMode } = opts;
  const fieldSet = new Set(FIELD_POSITIONS);

  const result = new Map<string, Record<string, string>>();
  for (const p of players) {
    result.set(p.playerId, fillMode === 'empty' ? { ...p.inningPositions } : {});
  }

  // Cross-inning fairness + rotation trackers
  const benchCount = new Map<string, number>(players.map(p => [p.playerId, 0]));
  let lastBench = new Set<string>();
  const posPlays = new Map<string, Map<string, number>>(); // playerId → position → times played

  const primaryOf = (p: GeneratorPlayer) => (fieldSet.has(norm(p.primaryPosition)) ? norm(p.primaryPosition) : '');
  const secondaryOf = (p: GeneratorPlayer) => (fieldSet.has(norm(p.secondaryPosition)) ? norm(p.secondaryPosition) : '');
  const bump = (id: string, pos: string) => {
    let m = posPlays.get(id);
    if (!m) { m = new Map(); posPlays.set(id, m); }
    m.set(pos, (m.get(pos) ?? 0) + 1);
  };
  const playedCount = (id: string, pos: string) => posPlays.get(id)?.get(pos) ?? 0;

  for (let inn = 1; inn <= inningCount; inn++) {
    const key = String(inn);

    // In fill-empty mode, lock cells already set this inning (e.g. coach-set pitcher).
    const lockedPositions = new Set<string>();
    const lockedPlayers = new Set<string>();
    if (fillMode === 'empty') {
      for (const p of players) {
        const cur = result.get(p.playerId)![key] ?? '';
        if (!cur) continue;
        lockedPlayers.add(p.playerId);
        if (cur !== BENCH && fieldSet.has(cur)) {
          lockedPositions.add(cur);
          bump(p.playerId, cur);
        }
      }
    }

    const available = players.filter(p => !lockedPlayers.has(p.playerId));
    const openPositions = FIELD_POSITIONS.filter(pos => !lockedPositions.has(pos));
    const onFieldNeeded = Math.min(openPositions.length, available.length);
    const benchNeeded = available.length - onFieldNeeded;

    // Who sits: fewest sits so far first (balance); among those, players who did NOT sit
    // last inning first (avoid back-to-back). Shuffle BEFORE the stable sort so fully-tied
    // players (same sit-count, same last-inning status) are chosen randomly — this is what
    // keeps the bench from settling into the same repeating trios.
    const benchOrder = shuffle(available).sort((a, b) => {
      const ba = benchCount.get(a.playerId) ?? 0, bb = benchCount.get(b.playerId) ?? 0;
      if (ba !== bb) return ba - bb;
      const la = lastBench.has(a.playerId) ? 1 : 0, lb = lastBench.has(b.playerId) ? 1 : 0;
      return la - lb;
    });
    const benched = new Set(benchOrder.slice(0, benchNeeded).map(p => p.playerId));
    lastBench = new Set(benched);
    for (const id of benched) {
      result.get(id)![key] = BENCH;
      benchCount.set(id, (benchCount.get(id) ?? 0) + 1);
    }

    // Assign open positions to the on-field players per policy. Shuffle the pool so a tied
    // choice (e.g. several players whose primary is the same spot) varies between runs.
    const unassigned = new Map(available.filter(p => !benched.has(p.playerId)).map(p => [p.playerId, p]));
    for (const pos of openPositions) {
      const pool = shuffle([...unassigned.values()]);
      if (pool.length === 0) break;
      let pick: GeneratorPlayer | undefined;
      if (policy === 'competitive') {
        pick = pool.find(p => primaryOf(p) === pos)
          ?? pool.find(p => secondaryOf(p) === pos)
          ?? leastPlayed(pool, pos, playedCount);
      } else if (policy === 'balanced') {
        const matches = pool.filter(p => primaryOf(p) === pos || secondaryOf(p) === pos);
        pick = leastPlayed(matches.length ? matches : pool, pos, playedCount);
      } else {
        pick = leastPlayed(pool, pos, playedCount);
      }
      if (!pick) continue;
      result.get(pick.playerId)![key] = pos;
      unassigned.delete(pick.playerId);
      bump(pick.playerId, pos);
    }
  }

  return result;
}

function leastPlayed(
  pool: GeneratorPlayer[],
  pos: string,
  playedCount: (id: string, pos: string) => number,
): GeneratorPlayer | undefined {
  let best: GeneratorPlayer | undefined;
  let bestN = Infinity;
  for (const p of pool) {
    const n = playedCount(p.playerId, pos);
    if (n < bestN) { bestN = n; best = p; }
  }
  return best;
}

/** Quality score for a generated lineup (higher = better). Used by generateBestLineup to
 *  pick the best of several randomized passes — mirrors the tournament scheduler's
 *  candidate-and-score approach. */
function scoreLineup(assignment: Map<string, Record<string, string>>, opts: GenerateOptions): number {
  const { players, inningCount, policy } = opts;
  const fieldSet = new Set(FIELD_POSITIONS);
  const isPref = (p: GeneratorPlayer, pos: string) => {
    const pr = norm(p.primaryPosition), se = norm(p.secondaryPosition);
    return { primary: pr === pos, secondary: se === pos };
  };

  const benchCounts: number[] = [];
  let backToBack = 0;
  let prefPrimary = 0, prefSecondary = 0, offPref = 0;
  let varietyBonus = 0;

  for (const p of players) {
    const grid = assignment.get(p.playerId) ?? {};
    let bench = 0, prevBench = false;
    const distinct = new Set<string>();
    for (let inn = 1; inn <= inningCount; inn++) {
      const pos = grid[String(inn)] ?? '';
      if (pos === BENCH) { bench++; if (prevBench) backToBack++; prevBench = true; continue; }
      prevBench = false;
      if (!pos || !fieldSet.has(pos)) continue;
      distinct.add(pos);
      const pref = isPref(p, pos);
      if (pref.primary) prefPrimary++;
      else if (pref.secondary) prefSecondary++;
      else offPref++;
    }
    benchCounts.push(bench);
    varietyBonus += distinct.size;
  }

  // Unfilled field cells across the game (only counts as a problem when players are available)
  let unfilled = 0;
  for (let inn = 1; inn <= inningCount; inn++) {
    let filled = 0, onBench = 0;
    for (const p of players) {
      const pos = assignment.get(p.playerId)?.[String(inn)] ?? '';
      if (pos === BENCH) onBench++;
      else if (fieldSet.has(pos)) filled++;
    }
    const couldFill = Math.min(FIELD_POSITIONS.length, players.length - onBench);
    unfilled += Math.max(0, couldFill - filled);
  }

  const benchSpread = benchCounts.length ? Math.max(...benchCounts) - Math.min(...benchCounts) : 0;

  // Fairness is paramount: heavy penalties for uneven bench + back-to-back + holes.
  let score = -benchSpread * 6 - backToBack * 10 - unfilled * 4;
  // Policy fit shapes the positions.
  if (policy === 'competitive') score += prefPrimary * 2 + prefSecondary * 0.5 - offPref * 1.5;
  else if (policy === 'balanced') score += (prefPrimary + prefSecondary) * 1 - offPref * 1;
  else score += varietyBonus * 1.5; // development rewards position variety
  return score;
}

/** Run several randomized passes and keep the highest-scoring lineup. Re-running still varies
 *  (each pass is randomized), so the coach can re-roll and always gets a vetted-best result. */
export function generateBestLineup(opts: GenerateOptions, candidateCount = 16): Map<string, Record<string, string>> {
  const passes = Math.max(1, Math.min(40, candidateCount));
  let best: Map<string, Record<string, string>> | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < passes; i++) {
    const candidate = generateLineup(opts);
    const s = scoreLineup(candidate, opts);
    if (s > bestScore) { bestScore = s; best = candidate; }
  }
  return best ?? generateLineup(opts);
}
