/**
 * lib/coach-tournament-phase.ts
 *
 * Derives the COACH-facing lifecycle phase of a tournament registration from the
 * registration status (teams.status), the division's schedule visibility, the
 * tournament status, and the event dates. This is the coach analogue of the
 * organizer-side resolvePhase() in lib/tournament-phase.ts — distinct because the
 * coach's phase is gated by THEIR acceptance, not just the event clock.
 *
 * 5h renders rich UI for `pending` / `rejected` / `accepted_prep`; the accepted
 * post-prep phases (`schedule_live` / `game_day` / `result`) are derived now for
 * forward-compatibility but render the static accepted hero until 5i (game-day
 * bridge) and 5m (afterglow) add the live treatment.
 *
 * ⚠ Honesty rule: pending / waitlist / rejected teams have NO public profile
 * (lib/public-tournament-data.ts filters to accepted), so the phases that gate any
 * public/Follow surface are the `accepted_*` ones only — never `pending`/`rejected`.
 */

export type CoachTournamentPhase =
  | 'pending' // pending / waitlist — awaiting the organizer's decision
  | 'rejected' // not accepted
  | 'accepted_prep' // accepted; schedule not yet published
  | 'schedule_live' // accepted; schedule published, before game day   (5i)
  | 'game_day' // accepted; event underway                              (5i)
  | 'result'; // accepted; event complete                               (5m)

export type DeriveCoachTournamentPhaseInput = {
  /** teams.status — the registration membership status. */
  registrationStatus: string | null;
  /** True when the coach's division schedule is published (schedule_visibility === 'published'). */
  scheduleVisible: boolean;
  /** tournaments.status (draft|active|completed|archived). */
  tournamentStatus: string | null;
  /** YYYY-MM-DD start date. */
  startDate: string | null;
  /** YYYY-MM-DD end date (null for single-day events). */
  endDate: string | null;
  /** ISO date (YYYY-MM-DD); defaults to today (UTC, matching the organizer page). */
  today?: string;
};

export function deriveCoachTournamentPhase(input: DeriveCoachTournamentPhaseInput): CoachTournamentPhase {
  const today = input.today ?? new Date().toISOString().split('T')[0];
  const status = (input.registrationStatus ?? '').toLowerCase();

  if (status === 'rejected') return 'rejected';
  // pending / waitlist / anything not explicitly accepted → still awaiting a decision.
  if (status !== 'accepted') return 'pending';

  // Accepted from here — split by the event clock + schedule visibility.
  const ended =
    input.tournamentStatus === 'completed' ||
    input.tournamentStatus === 'archived' ||
    (input.endDate ? today > input.endDate : input.startDate ? today > input.startDate : false);
  if (ended) return 'result';

  // Started (and, per the `ended` check above, not past the end) → the event is underway.
  if (input.startDate && today >= input.startDate) return 'game_day';

  return input.scheduleVisible ? 'schedule_live' : 'accepted_prep';
}

/** True for any accepted phase (accepted_prep | schedule_live | game_day | result). */
export function isAcceptedPhase(phase: CoachTournamentPhase): boolean {
  return phase !== 'pending' && phase !== 'rejected';
}
