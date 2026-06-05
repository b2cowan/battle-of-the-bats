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

import type { TournamentFormat } from './types';

export type TournamentPhase = 'draft' | 'open' | 'gameday' | 'completed' | 'archived';

/** Structural format of a tournament; defaults to the standard round robin → playoffs flow. */
export function getTournamentFormat(
  tournament?: { settings?: { format?: TournamentFormat | null } | null } | null,
): TournamentFormat {
  return tournament?.settings?.format ?? 'round_robin_playoffs';
}

/** True when a tournament skips round robin and seeds its bracket directly. */
export function isPlayoffOnly(
  tournament?: { settings?: { format?: TournamentFormat | null } | null } | null,
): boolean {
  return getTournamentFormat(tournament) === 'playoff_only';
}

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
