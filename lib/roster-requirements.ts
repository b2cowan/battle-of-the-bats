// Shared constants + parser for the organizer roster-requirements feature (Phase 5f/5j/5k).
// Authored in Event Settings → Roster Requirements (tournaments.settings JSONB);
// consumed by the coach-side event-roster submission API (5j) and UI (5k).

import type { TournamentSettings } from './types';

/**
 * The acknowledgment statement a coach must tick when `roster_require_waiver`
 * is on and the organizer left `roster_waiver_text` blank. V1 stores no waiver
 * document — this is an acknowledgment that the team has handled the event's
 * waiver requirements, not the waiver itself.
 */
export const DEFAULT_ROSTER_WAIVER_TEXT =
  'On behalf of the team, I confirm that all listed players (or their parents/guardians) ' +
  'have agreed to this event’s waiver and assumption-of-risk requirements, and that the ' +
  'information submitted is accurate.';

/** Max length stored for an organizer-authored waiver statement. */
export const ROSTER_WAIVER_TEXT_MAX_LENGTH = 2000;

/**
 * The organizer's per-tournament roster requirements, normalized from the flat
 * `tournaments.settings` keys (5f) into a typed, defaulted shape for the coach-side
 * submit API (5j) and UI (5k). Read VALUES, never key-presence (5f review: opening
 * Event Settings can stamp `false`/`null` into legacy tournaments via a no-op save).
 */
export type RosterRequirements = {
  /** `roster_require` — does this tournament ask accepted teams for an event roster at all. */
  required: boolean;
  requireDob: boolean;
  requireJersey: boolean;
  requireWaiver: boolean;
  /** Resolved acknowledgment statement: organizer text, or the shared default when blank/absent. */
  waiverText: string;
  /** Raw stored bounds (1–99 | null). null = no bound. */
  minPlayers: number | null;
  maxPlayers: number | null;
  /**
   * Effective minimum after the LOCKED min>max rule (5f review): a stored `min > max` pair is
   * possible (the merge-patch API validates keys independently), so treat min>max as NO minimum
   * (max wins) — never an unsatisfiable gate that blocks every submission. 0 = no minimum.
   */
  effectiveMinPlayers: number;
};

/** Coerce a settings value to an int in [1,99], else null (mirrors the 5f write-side sanitizer). */
function intInRangeOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 99 ? value : null;
}

/**
 * Normalize a tournament's roster requirements from its settings JSONB. Defaults are
 * all-OFF / no-bound (legacy tournaments and tournaments that never authored requirements
 * read as "no requirement"). Pure — safe on the server and the client.
 */
export function parseRosterRequirements(
  settings: TournamentSettings | null | undefined,
): RosterRequirements {
  const s = settings ?? {};
  const min = intInRangeOrNull(s.roster_min_players);
  const max = intInRangeOrNull(s.roster_max_players);
  const waiverRaw = typeof s.roster_waiver_text === 'string' ? s.roster_waiver_text.trim() : '';
  const effectiveMinPlayers = min != null && max != null && min > max ? 0 : (min ?? 0);
  return {
    required: s.roster_require === true,
    requireDob: s.roster_require_dob === true,
    requireJersey: s.roster_require_jersey === true,
    requireWaiver: s.roster_require_waiver === true,
    waiverText: waiverRaw || DEFAULT_ROSTER_WAIVER_TEXT,
    minPlayers: min,
    maxPlayers: max,
    effectiveMinPlayers,
  };
}
