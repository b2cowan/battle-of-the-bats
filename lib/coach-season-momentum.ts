// Season momentum — the cumulative score-unit differential behind the Dashboard's "Season momentum"
// chart and the Results tab's trend line. PURE, no I/O, no React.
//
// Insights Reports Portal P3 (COACH_INSIGHTS_REPORTS_PORTAL_P3_BUILD_PROMPT.md). Both charts draw
// from data their panel already has in state — this is the one reduction they share, extracted so it
// is tested as a pure function rather than re-read inside two components.
//
// ── The honest-data rule this exists to enforce ─────────────────────────────────────────────────
// A game with a recorded result but no score entered cannot contribute a run/point differential — it
// has nothing to add. Silently dropping it from the series would make the chart's game count quietly
// disagree with the game log sitting beside it on the same screen (the sharpest state named in the
// build prompt). So this keeps the FULL chronological index for every game, scored or not: `points`
// carries only the scored games (nothing to plot for the rest), but each point's `index` is its
// position in the complete list, and `unscoredIndexes` names exactly where the gaps are — so a caller
// can draw a line through the scored points at their true positions and mark the gaps rather than
// pretending they aren't there.
export interface SeasonMomentumGameInput {
  teamScore: number | null;
  opponentScore: number | null;
}

export interface SeasonMomentumPoint {
  /** Position within the full chronological list passed in (0-based) — NOT the scored-only index. */
  index: number;
  /** Cumulative score-unit differential through this game. */
  cumulative: number;
}

export interface SeasonMomentumSeries {
  /** One per scored game, oldest → newest, in the order supplied. */
  points: SeasonMomentumPoint[];
  /** Chronological positions of games with a result but no score — gaps in the line, not omissions. */
  unscoredIndexes: number[];
  scoredCount: number;
  totalCount: number;
}

/**
 * `games` must already be the finalized set the caller wants plotted (a scope/tag filter already
 * applied), ordered OLDEST FIRST — the reverse of how the panels sort their game logs for display.
 */
export function computeSeasonMomentum(games: SeasonMomentumGameInput[]): SeasonMomentumSeries {
  const points: SeasonMomentumPoint[] = [];
  const unscoredIndexes: number[] = [];
  let running = 0;
  games.forEach((g, index) => {
    if (g.teamScore == null || g.opponentScore == null) {
      unscoredIndexes.push(index);
      return;
    }
    running += g.teamScore - g.opponentScore;
    points.push({ index, cumulative: running });
  });
  return { points, unscoredIndexes, scoredCount: points.length, totalCount: games.length };
}
