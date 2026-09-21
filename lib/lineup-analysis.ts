// Pure, testable analysis for a team lineup grid (players × innings).
// Surfaces mistakes (two players in one singular position) and fair-play balance
// (who's on the field vs. benched, and back-to-back sits). No I/O, no React.

/** Positions that may appear at most ONCE per inning. Generic OF, EH, Bench and
 *  unassigned ('') may legitimately repeat, so they're excluded from conflict flags. */
const SINGULAR_POSITIONS = new Set(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']);
export const BENCH_POSITION = 'Bench';

export interface LineupConflict {
  inning: number;
  position: string;
  count: number;        // how many players hold this singular position this inning
}

export interface InningFill {
  inning: number;
  onField: number;      // players assigned a real fielding position (not Bench / blank)
  benched: number;      // players explicitly on the bench this inning
  unassigned: number;   // players without a field/Bench decision yet
}

export interface PlayerFairPlay {
  playerId: string;
  onField: number;      // innings with a real fielding position
  benched: number;      // innings explicitly benched
  unassigned: number;   // innings left blank (undecided)
  consecutiveBench: boolean; // benched two innings in a row at any point
  positionCounts: Record<string, number>; // position code → innings played there
}

/** An inning where one or more required field positions could not be filled even though a player
 *  was idle (benched or unassigned) — usually the result of "Never" constraints leaving no eligible
 *  player for a spot. Only computed when the caller passes the sport's field positions. */
export interface UnfilledFieldPositions {
  inning: number;
  positions: string[];
}

/** The factual state of a saved or in-progress grid. Draft means work exists but decisions or
 * required field roles remain open; Needs review is reserved for a proven clash, not a guess.
 * This is an ELIGIBILITY signal ("is there anything left to fill in or fix right now") — it is
 * NOT the badge shown to a coach outside the builder. That badge also depends on whether a coach
 * has explicitly marked the lineup ready (see LineupBadge / deriveLineupBadge below): a lineup can
 * be coverage-complete (`readiness === 'ready'`) for a while before anyone marks it Ready, and it
 * stays Ready only until the next edit reopens it. */
export type LineupReadiness = 'not_started' | 'draft' | 'needs_review' | 'ready';

/** The four states shown to a coach anywhere OUTSIDE the builder — the games hub, the team
 * Overview, the schedule's lineup peek. Unlike LineupReadiness this is never invented from
 * coverage alone: 'ready' here means a coach actually pressed "Mark ready" and nothing has
 * touched the lineup since (the persisted `status` column, mig 304). */
export type LineupBadge = 'not_started' | 'draft' | 'needs_review' | 'ready';

export function deriveLineupBadge(analysis: LineupAnalysis, persistedStatus: 'draft' | 'ready'): LineupBadge {
  if (!analysis.hasAssignments) return 'not_started';
  if (analysis.hasConflicts) return 'needs_review';
  return persistedStatus === 'ready' ? 'ready' : 'draft';
}

/**
 * Whether a coach may mark this lineup Ready (D11, 2026-09-20): the gate is WRONGNESS, never
 * emptiness. An empty grid has nothing to hand off (that alone is the whole of the one-cell-
 * accident protection F02 asked for) and a proven clash is wrong; open roles and undecided
 * players are the coach's own plan — filled at the field — and never block. The server's PATCH
 * re-checks this against the saved lineup; the builder shows the button from the same rule.
 */
export function canMarkLineupReady(analysis: LineupAnalysis): boolean {
  return analysis.hasAssignments && !analysis.hasConflicts;
}

/**
 * The innings that still need a decision — a clash, a required role with no holder, or a player
 * with no field/Bench decision. This is the count Ready carries with it ("Mark ready · 3 innings
 * open", "Ready · 3 open") so a bare Ready never hides a gap; it is the same set the builder's
 * Lineup check lists row by row (a started inning with open work, and the untouched innings).
 */
export function inningsNeedingDecision(analysis: LineupAnalysis): number[] {
  const open = new Set<number>();
  for (const c of analysis.conflicts) open.add(c.inning);
  for (const m of analysis.missingFieldPositions) open.add(m.inning);
  for (const fill of analysis.inningFill) if (fill.unassigned > 0) open.add(fill.inning);
  return [...open].sort((x, y) => x - y);
}

export interface LineupAnalysis {
  conflicts: LineupConflict[];
  conflictInnings: Set<number>;
  inningFill: InningFill[];
  fairPlay: PlayerFairPlay[];
  hasConflicts: boolean;
  /** Spread of bench innings across players (fairness at a glance); null if no rows. */
  benchSpread: { min: number; max: number } | null;
  /** Fillable-but-empty field positions per inning (empty unless fieldPositions was supplied). */
  unfilledFieldPositions: UnfilledFieldPositions[];
  /** Every missing required field role, including a short-roster inning with no idle player. */
  missingFieldPositions: UnfilledFieldPositions[];
  readiness: LineupReadiness;
  hasAssignments: boolean;
}

export interface AnalyzableRow {
  playerId: string;
  inningPositions: Record<string, string>;
}

export function analyzeLineup(
  rows: AnalyzableRow[],
  inningCount: number,
  fieldPositions?: string[],
): LineupAnalysis {
  const conflicts: LineupConflict[] = [];
  const conflictInnings = new Set<number>();
  const inningFill: InningFill[] = [];
  const unfilledFieldPositions: UnfilledFieldPositions[] = [];
  const missingFieldPositions: UnfilledFieldPositions[] = [];
  const fieldList = fieldPositions ?? [];
  let hasAssignments = false;

  for (let inn = 1; inn <= inningCount; inn++) {
    const key = String(inn);
    const counts = new Map<string, number>();
    let onField = 0;
    let benched = 0;
    let unassigned = 0;
    let idle = 0; // benched OR blank — a player who could have covered an open spot
    for (const r of rows) {
      const pos = r.inningPositions[key] ?? '';
      if (pos === BENCH_POSITION) { hasAssignments = true; benched++; idle++; continue; }
      if (!pos) { idle++; unassigned++; continue; }
      hasAssignments = true;
      onField++;
      counts.set(pos, (counts.get(pos) ?? 0) + 1);
    }
    for (const [pos, count] of counts) {
      if (count > 1 && SINGULAR_POSITIONS.has(pos)) {
        conflicts.push({ inning: inn, position: pos, count });
        conflictInnings.add(inn);
      }
    }
    // A required field position with no holder, while a player sits idle, is a fillable hole
    // (typically a "Never" constraint left no eligible player) — worth flagging to the coach.
    if (fieldList.length) {
      const empty = fieldList.filter(fp => !counts.has(fp));
      if (empty.length) {
        missingFieldPositions.push({ inning: inn, positions: empty });
        if (idle > 0) unfilledFieldPositions.push({ inning: inn, positions: empty });
      }
    }
    inningFill.push({ inning: inn, onField, benched, unassigned });
  }

  const fairPlay: PlayerFairPlay[] = rows.map(r => {
    let onField = 0, benched = 0, unassigned = 0, consecutiveBench = false, prevBench = false;
    const positionCounts: Record<string, number> = {};
    for (let inn = 1; inn <= inningCount; inn++) {
      const pos = r.inningPositions[String(inn)] ?? '';
      if (pos === BENCH_POSITION) {
        benched++;
        if (prevBench) consecutiveBench = true;
        prevBench = true;
      } else {
        if (!pos) { unassigned++; } else { onField++; positionCounts[pos] = (positionCounts[pos] ?? 0) + 1; }
        prevBench = false;
      }
    }
    return { playerId: r.playerId, onField, benched, unassigned, consecutiveBench, positionCounts };
  });

  const benchCounts = fairPlay.map(f => f.benched);
  const benchSpread = benchCounts.length
    ? { min: Math.min(...benchCounts), max: Math.max(...benchCounts) }
    : null;
  const hasOpenRoles = missingFieldPositions.length > 0;
  const hasOpenDecisions = fairPlay.some(f => f.unassigned > 0);
  const readiness: LineupReadiness = !hasAssignments
    ? 'not_started'
    : conflicts.length > 0
      ? 'needs_review'
      : hasOpenRoles || hasOpenDecisions
        ? 'draft'
        : 'ready';

  return {
    conflicts,
    conflictInnings,
    inningFill,
    fairPlay,
    hasConflicts: conflicts.length > 0,
    benchSpread,
    unfilledFieldPositions,
    missingFieldPositions,
    readiness,
    hasAssignments,
  };
}
