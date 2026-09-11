/**
 * "Read-only past season" holds PER ROW, and it holds on every verb (development lifecycle
 * Phase 0, F04).
 *
 * ⚠ A goal and a reading attach to a roster ROW, which is season-scoped. The create routes refused
 * a row from a season other than the assignment's working one; the goal edit/delete and the
 * reading delete did not — they checked org, team, player and the write grant, then called a
 * scoped mutation. A current coach holding an old same-team id could therefore reach a historical
 * record. Nothing in the product hands out such an id, so the exposure was narrow; the reason to
 * close it is that history is only credible when "read-only" is enforced beyond navigation.
 *
 * ONE rule, stated once, applied by every goal and reading write. The assignment already names the
 * working season (draft|active-filtered lookup), so this costs no query. Sessions do not need it —
 * their resolver looks the session up INSIDE the working season.
 *
 * Pure module (no Next import) so the rule is unit-testable; the route wraps the answer.
 */

export const PAST_SEASON_MESSAGE = 'This player belongs to a past season, which is read-only.';

export function pastSeasonRefusal(
  player: { programYearId: string },
  assignment: { programYearId: string },
): { status: 409; error: string } | null {
  return player.programYearId === assignment.programYearId
    ? null
    : { status: 409, error: PAST_SEASON_MESSAGE };
}
