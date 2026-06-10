// Shared constants for the organizer roster-requirements feature (Phase 5f/5k).
// Authored in Event Settings → Roster Requirements (tournaments.settings JSONB);
// consumed by the coach-side event-roster submission (5k).

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
