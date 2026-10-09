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
 * ⚠ NOT the tournament dashboard's "playing now" window (`lib/game-live-state.ts`, 60 minutes): that is how
 * long a game stays in Playing now before it reads Needs a score, a different question with its own number
 * (recorded for the tournament redesign as a finding, 2026-10-08 — the scheduler assumes 90 for the same game).
 */
export const DEFAULT_BOOKING_MINUTES = 90;
