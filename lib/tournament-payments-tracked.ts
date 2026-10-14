/**
 * DOES THIS TOURNAMENT TRACK PAYMENTS? — the one answer every payment surface reads (owner 2026-10-13).
 *
 * The Fee model's "Not tracked here" (stored `fee_scope: 'free'`) means the organizer is not tracking payments on
 * the platform. Payments are then ABSENT everywhere for that event — Teams' Payment column, row facts, filter, bulk
 * actions and export; the team's record; Check-in; the coach's portal; the public registration form; every email —
 * never a manual "Paid" tick and never an amber "Unpaid". A fee or how-to-pay text typed before the switch stays
 * stored (switching back brings it back), but nothing shows or sends it while the event says not tracked.
 *
 * Any other value — a fee model, or none chosen yet — tracks payments. Pure, so a plain Node unit test reads it.
 */
export function tournamentTracksPayments(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return true;
  return (settings as { fee_scope?: unknown }).fee_scope !== 'free';
}
