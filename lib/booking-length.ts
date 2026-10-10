/**
 * How long a booking lasts when nothing records its length — THE one number (Club Tier Stage 6a, 2026-10-08).
 *
 * A league game or practice with no end, a rep event with no end (46% of timed rep events on dev, S6-07), a
 * tournament game whose own length, division and tournament all leave it unset: each is read as this many
 * minutes. It was written out four times (house league's clash engine, the tournament's, the schedule-health
 * metrics and the public "is it live?" window), so the cross-program clash check could have compared a
 * league game and a tournament game on two different assumptions without anyone noticing. Every one of
 * them now reads it from here.
 *
 * The tournament dashboard's "Playing now" window is the SAME question (tournament admin redesign A39, owner
 * ruling 2026-10-09): it decides when a game stops being Playing now and becomes Needs a score, so a game whose
 * length is set nowhere plays for this many minutes there too. Club 6a recorded it as "a different question with
 * its own number" (60); read in the code it was not, and that number is gone.
 */
export const DEFAULT_BOOKING_MINUTES = 90;

/** A length a person set: a positive, finite number of minutes. */
const setMinutes = (v: unknown): number | undefined =>
  (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);

/**
 * A tournament game's length — THE chain (A39): the game's own, else its division's, else its tournament's, else the
 * one booking length. Every reader asks this one question the same way: the clash check, the timeline, the schedule's
 * health, the board's Playing now, Results, the scorekeeper and the club calendar (`tournamentGameMinutes` in
 * `lib/venue-clash.ts` reads the same chain for the cross-program check; `tests/unit/game-length.test.ts` holds the two
 * to one answer). The division and tournament values are their `settings.game_duration_minutes`.
 */
export function gameLengthMinutes(gameMinutes: unknown, divisionMinutes?: unknown, tournamentMinutes?: unknown): number {
  return setMinutes(gameMinutes) ?? setMinutes(divisionMinutes) ?? setMinutes(tournamentMinutes) ?? DEFAULT_BOOKING_MINUTES;
}
