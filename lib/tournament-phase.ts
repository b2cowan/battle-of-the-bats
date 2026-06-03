/**
 * Tournament operational phase (derived — NOT a stored status).
 * See design_decisions.md 2026-06-03.
 *
 *  draft     — status 'draft' (setup; site preview-only)
 *  open      — status 'active' AND not game-day (site + registration live, games not started)
 *  gameday   — status 'active' AND game-day (games underway)
 *  completed — status 'completed'
 *  archived  — status 'archived'
 *
 * Game-day boundary = within event dates OR the first game has started. The
 * "first game started" half needs game data, so surfaces that have it (the
 * dashboard, via its API) pass a full `isGameDay`; shell-wide surfaces that
 * don't (e.g. the mobile top-bar pill) pass the date-only signal — an accepted
 * edge-case difference.
 */

export type TournamentPhase = 'draft' | 'open' | 'gameday' | 'completed' | 'archived';

/** Date-only game-day signal: today falls within the tournament's start–end window. */
export function isWithinEventDates(
  startDate?: string | null,
  endDate?: string | null,
  today: string = new Date().toISOString().split('T')[0],
): boolean {
  if (!startDate || !endDate) return false;
  return today >= startDate && today <= endDate;
}

export function resolvePhase(opts: { status?: string | null; isGameDay: boolean }): TournamentPhase {
  const { status, isGameDay } = opts;
  if (status === 'archived') return 'archived';
  if (status === 'completed') return 'completed';
  if (status === 'draft') return 'draft';
  // active (or anything else) → split by game-day
  return isGameDay ? 'gameday' : 'open';
}

export const PHASE_LABEL: Record<TournamentPhase, string> = {
  draft: 'Draft',
  open: 'Open',
  gameday: 'Live',
  completed: 'Completed',
  archived: 'Archived',
};
