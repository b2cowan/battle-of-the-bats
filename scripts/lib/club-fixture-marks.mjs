/**
 * The markers the club fixture's additive steps write on their rows (scripts/seed-club-fixture.mjs), shared with the screen
 * sweep's context (scripts/uat-fixture-context.mjs) that finds those rows again. One string in one place: a reworded mark
 * would otherwise turn the sweep's lookup into a silent "not seeded".
 */

/** Club Tier Stage 13c (`--club-dates-off`): "Saturday diamonds", its dates off, and the bookings standing on them. */
export const DATES_OFF_MARK = 'Seeded for the Stage 13c walks (scripts/seed-club-fixture.mjs --club-dates-off).';
