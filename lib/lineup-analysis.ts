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
  const fieldList = fieldPositions ?? [];

  for (let inn = 1; inn <= inningCount; inn++) {
    const key = String(inn);
    const counts = new Map<string, number>();
    let onField = 0;
    let benched = 0;
    let idle = 0; // benched OR blank — a player who could have covered an open spot
    for (const r of rows) {
      const pos = r.inningPositions[key] ?? '';
      if (pos === BENCH_POSITION) { benched++; idle++; continue; }
      if (!pos) { idle++; continue; }
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
    if (fieldList.length && idle > 0) {
      const empty = fieldList.filter(fp => !counts.has(fp));
      if (empty.length) unfilledFieldPositions.push({ inning: inn, positions: empty });
    }
    inningFill.push({ inning: inn, onField, benched });
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

  return {
    conflicts,
    conflictInnings,
    inningFill,
    fairPlay,
    hasConflicts: conflicts.length > 0,
    benchSpread,
    unfilledFieldPositions,
  };
}
