/**
 * Season-over-season comparison helpers (Coaches Portal Phase 4 F2).
 *
 * Pure functions behind the "This season vs last" panel on Season Review. Kept sport-neutral:
 * a record is wins/losses/ties (a tie counts as half a win, the standard convention), so this
 * works for any sport without touching the Sport Pack vocab.
 */

export type TrendDirection = 'up' | 'down' | 'flat' | 'na';

export interface SeasonRecord {
  wins: number;
  losses: number;
  ties: number;
}

/**
 * Winning percentage as a 0–1 fraction (tie = half a win). Returns null when no games have a
 * result yet — so a season in progress with 0 games doesn't read as 0% (a false "worst ever").
 */
export function winPct(r: SeasonRecord): number | null {
  const games = r.wins + r.losses + r.ties;
  if (games <= 0) return null;
  return (r.wins + r.ties * 0.5) / games;
}

/** Compare a current value against a prior one. `na` when either side is missing (can't judge). */
export function compareValues(
  current: number | null | undefined,
  previous: number | null | undefined,
): { direction: TrendDirection; delta: number | null } {
  if (current == null || previous == null) return { direction: 'na', delta: null };
  const delta = current - previous;
  if (Math.abs(delta) < 1e-9) return { direction: 'flat', delta: 0 };
  return { direction: delta > 0 ? 'up' : 'down', delta };
}

/** Format a 0–1 winning fraction as a whole-percent string, or a dash when unknown. */
export function formatWinPct(p: number | null): string {
  if (p == null) return '—';
  return `${Math.round(p * 100)}%`;
}
