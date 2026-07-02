// Lineup auto-generator. Produces a per-player inning→position map the coach can then
// tweak — never a final answer. Fairness is a HARD guarantee (even bench counts, no
// back-to-back sits when avoidable); ties are broken RANDOMLY so each "Generate" gives a
// natural, non-repetitive rotation rather than the same rigid roster-order blocks.
//
// Each player carries position preferences (Lineup Intelligence, P1):
//   • never[]     — a HARD exclusion: the player is never auto-assigned these, in any mode.
//   • preferred[] — ranked "Best" spots (rank 1 first); shapes who takes each position but
//                   never overrides the fairness/bench guarantees above.
//   • canPlay[]   — "Okay" fallback spots, below preferred.
// If a position has no eligible player (e.g. everyone left has it in never[]) it is left BLANK
// rather than aborting the inning — the analysis layer surfaces the hole to the coach.
//
// Pitching (P2): one sport position (GenerateOptions.pitcherPosition, e.g. 'P') is governed by a
// separate pitcher depth chart, not the Best/Okay ratings. Among on-field players (fairness/bench
// runs FIRST, unchanged) the mound goes to an eligible pitcher — under their per-game innings cap —
// chosen by rank (competitive leads with the ace; balanced/development spread the load). A capped
// pitcher is never pushed past their limit; if no pitcher is available the mound falls back to a
// non-pitcher rated for it, else it's left blank (surfaced like any other unfillable spot).
//
// The on-field positions to assign are passed in per call (GenerateOptions.fieldPositions),
// sourced from the team's Sport Pack — the generator stays sport-neutral and never hard-codes
// position codes. Softball/baseball supply the 9 diamond spots; other sports supply their own.

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
  preferred: string[]; // ordered "Best" positions (rank 1 first)
  canPlay: string[];   // "Okay" positions (below preferred)
  never: string[];     // hard exclusions — never auto-assigned here, any mode
  /** Pitcher depth-chart entry (P2). null = not a pitcher. rank: 1 = ace. maxInnings: per-game
   *  arm-care cap; null = no cap. Governs the pitcherPosition slot, not the Best/Okay ratings. */
  pitcher: { rank: number; maxInnings: number | null } | null;
  inningPositions: Record<string, string>; // existing grid (honored when fillMode = 'empty')
}

interface PrefMaps {
  prefRankOf: Map<string, Map<string, number>>; // playerId → (position → 0-based rank among Best)
  canOf: Map<string, Set<string>>;              // playerId → Okay positions
  neverOf: Map<string, Set<string>>;            // playerId → hard-excluded positions
}

/** Precompute per-player preference lookups (uppercased, field-scoped). Rank is 0-based over the
 *  player's Best positions in order (contiguous — non-field entries are skipped, not counted). */
function buildPrefMaps(players: GeneratorPlayer[], fieldSet: Set<string>): PrefMaps {
  const prefRankOf = new Map<string, Map<string, number>>();
  const canOf = new Map<string, Set<string>>();
  const neverOf = new Map<string, Set<string>>();
  for (const p of players) {
    const ranks = new Map<string, number>();
    for (const pos of p.preferred ?? []) {
      const n = norm(pos);
      if (n && fieldSet.has(n) && !ranks.has(n)) ranks.set(n, ranks.size);
    }
    prefRankOf.set(p.playerId, ranks);
    canOf.set(p.playerId, new Set((p.canPlay ?? []).map(norm).filter(x => fieldSet.has(x))));
    neverOf.set(p.playerId, new Set((p.never ?? []).map(norm)));
  }
  return { prefRankOf, canOf, neverOf };
}

export interface GenerateOptions {
  players: GeneratorPlayer[];
  inningCount: number;
  policy: PositionPolicy;
  fillMode: FillMode;
  /** On-field positions to assign, exactly one player each per inning (from the Sport Pack). */
  fieldPositions: string[];
  /** The single position governed by pitcher rank + arm-care caps (e.g. 'P'). null/undefined =
   *  the sport has no pitcher slot, so pitching logic is skipped entirely. */
  pitcherPosition?: string | null;
}

const norm = (s: string | null | undefined) => (s ?? '').toUpperCase().trim();

/** Returns playerId → { inning(string) → position }. Only field positions + Bench are written. */
export function generateLineup(opts: GenerateOptions): Map<string, Record<string, string>> {
  const { players, inningCount, policy, fillMode, fieldPositions, pitcherPosition } = opts;
  const fieldSet = new Set(fieldPositions);

  const result = new Map<string, Record<string, string>>();
  for (const p of players) {
    result.set(p.playerId, fillMode === 'empty' ? { ...p.inningPositions } : {});
  }

  // Cross-inning fairness + rotation trackers
  const benchCount = new Map<string, number>(players.map(p => [p.playerId, 0]));
  let lastBench = new Set<string>();
  const posPlays = new Map<string, Map<string, number>>(); // playerId → position → times played

  const { prefRankOf, canOf, neverOf } = buildPrefMaps(players, fieldSet);
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
    const openPositions = fieldPositions.filter(pos => !lockedPositions.has(pos));
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
    // choice (e.g. several players who all prefer the same spot) varies between runs.
    const unassigned = new Map(available.filter(p => !benched.has(p.playerId)).map(p => [p.playerId, p]));
    for (const pos of openPositions) {
      // Hard 'never' filter: a player is never eligible for a position they can't play.
      const eligible = shuffle([...unassigned.values()].filter(p => !neverOf.get(p.playerId)!.has(pos)));
      if (eligible.length === 0) continue; // no eligible player → leave blank, keep filling the rest
      let pick: GeneratorPlayer | undefined;
      if (pitcherPosition && pos === pitcherPosition) {
        // Pitcher slot: prefer an eligible pitcher (still under their arm-care cap), by rank/spread.
        const eligiblePitchers = eligible.filter(p =>
          p.pitcher && (p.pitcher.maxInnings == null || playedCount(p.playerId, pos) < p.pitcher.maxInnings));
        if (eligiblePitchers.length) {
          pick = pickPitcher(eligiblePitchers, policy, pos, playedCount);
        } else {
          // No pitcher available (none flagged, or all at their cap) → fall back to a NON-pitcher
          // rated for the mound; a capped pitcher is never pushed past their limit.
          const nonPitchers = eligible.filter(p => !p.pitcher);
          pick = nonPitchers.length ? pickForPosition(pos, nonPitchers, policy, prefRankOf, canOf, playedCount) : undefined;
        }
      } else {
        pick = pickForPosition(pos, eligible, policy, prefRankOf, canOf, playedCount);
      }
      if (!pick) continue;
      result.get(pick.playerId)![key] = pos;
      unassigned.delete(pick.playerId);
      bump(pick.playerId, pos);
    }
  }

  return result;
}

/** Choose a player for one open position from an already-shuffled, never-filtered pool.
 *  competitive → the player for whom this is the highest-priority Best spot (tie: least played);
 *  balanced    → rotate among anyone who prefers OR can play it (else least played overall);
 *  development → least played overall, ignoring preferences (maximizes variety). */
function pickForPosition(
  pos: string,
  pool: GeneratorPlayer[],
  policy: PositionPolicy,
  prefRankOf: Map<string, Map<string, number>>,
  canOf: Map<string, Set<string>>,
  playedCount: (id: string, pos: string) => number,
): GeneratorPlayer | undefined {
  if (policy === 'development') return leastPlayed(pool, pos, playedCount);

  const rankAt = (p: GeneratorPlayer) => prefRankOf.get(p.playerId)?.get(pos);
  const canAt = (p: GeneratorPlayer) => canOf.get(p.playerId)?.has(pos) ?? false;

  if (policy === 'competitive') {
    const prefMatches = pool.filter(p => rankAt(p) !== undefined);
    if (prefMatches.length) {
      let best: GeneratorPlayer | undefined, bestRank = Infinity, bestPlayed = Infinity;
      for (const p of prefMatches) {
        const r = rankAt(p)!, pl = playedCount(p.playerId, pos);
        if (r < bestRank || (r === bestRank && pl < bestPlayed)) { bestRank = r; bestPlayed = pl; best = p; }
      }
      return best;
    }
    const canMatches = pool.filter(canAt);
    if (canMatches.length) return leastPlayed(canMatches, pos, playedCount);
    return leastPlayed(pool, pos, playedCount);
  }

  // balanced
  const matches = pool.filter(p => rankAt(p) !== undefined || canAt(p));
  return leastPlayed(matches.length ? matches : pool, pos, playedCount);
}

/** Choose the pitcher for the mound from an already-shuffled pool of eligible (under-cap) pitchers.
 *  competitive → lowest rank (ace) first, tie broken by fewest innings pitched so far;
 *  balanced / development → fewest innings pitched (spread the load), tie broken by lower rank.
 *  Shuffle order breaks full ties, so re-rolls vary. */
function pickPitcher(
  pool: GeneratorPlayer[],
  policy: PositionPolicy,
  pos: string,
  playedCount: (id: string, pos: string) => number,
): GeneratorPlayer | undefined {
  let best: GeneratorPlayer | undefined, bestA = Infinity, bestB = Infinity;
  for (const p of pool) {
    const rank = p.pitcher!.rank;
    const pitched = playedCount(p.playerId, pos);
    // Primary/secondary sort keys depend on policy: competitive leads with rank, others with load.
    const a = policy === 'competitive' ? rank : pitched;
    const b = policy === 'competitive' ? pitched : rank;
    if (a < bestA || (a === bestA && b < bestB)) { bestA = a; bestB = b; best = p; }
  }
  return best;
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
  const { players, inningCount, policy, fieldPositions, pitcherPosition } = opts;
  const fieldSet = new Set(fieldPositions);
  const { prefRankOf, canOf } = buildPrefMaps(players, fieldSet);

  const benchCounts: number[] = [];
  let backToBack = 0;
  let prefTop = 0, prefOther = 0, canHit = 0, offPref = 0;
  let varietyBonus = 0;
  let pitcherRankReward = 0;               // competitive: reward low-rank (ace) pitching
  const pitchersUsed = new Set<string>();  // balanced/development: reward spreading the mound

  for (const p of players) {
    const grid = assignment.get(p.playerId) ?? {};
    const ranks = prefRankOf.get(p.playerId)!;
    const can = canOf.get(p.playerId)!;
    let bench = 0, prevBench = false;
    const distinct = new Set<string>();
    for (let inn = 1; inn <= inningCount; inn++) {
      const pos = grid[String(inn)] ?? '';
      if (pos === BENCH) { bench++; if (prevBench) backToBack++; prevBench = true; continue; }
      prevBench = false;
      if (!pos || !fieldSet.has(pos)) continue;
      distinct.add(pos);
      if (pitcherPosition && pos === pitcherPosition && p.pitcher) {
        // Pitching their designated role — scored via pitcher terms, not position preference.
        pitchersUsed.add(p.playerId);
        if (policy === 'competitive') pitcherRankReward += Math.max(0.2, 2 - (p.pitcher.rank - 1) * 0.8);
        continue;
      }
      const rank = ranks.get(pos);
      if (rank === 0) prefTop++;
      else if (rank !== undefined) prefOther++;
      else if (can.has(pos)) canHit++;
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
    const couldFill = Math.min(fieldPositions.length, players.length - onBench);
    unfilled += Math.max(0, couldFill - filled);
  }

  const benchSpread = benchCounts.length ? Math.max(...benchCounts) - Math.min(...benchCounts) : 0;

  // Fairness is paramount: heavy penalties for uneven bench + back-to-back + holes.
  let score = -benchSpread * 6 - backToBack * 10 - unfilled * 4;
  // Policy fit shapes the positions (top Best spot rewarded most in competitive); pitching adds a
  // rank reward in competitive (ace-heavy) and a spread reward otherwise (more distinct pitchers).
  if (policy === 'competitive') score += prefTop * 2.5 + prefOther * 1.5 + canHit * 0.5 - offPref * 1.5 + pitcherRankReward;
  else if (policy === 'balanced') score += (prefTop + prefOther) * 1 + canHit * 0.75 - offPref * 1 + pitchersUsed.size;
  else score += varietyBonus * 1.5 + pitchersUsed.size; // development rewards position variety + spread
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
