import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findLeagueBookingConflicts,
  scanLeagueBookingConflicts,
  countUncheckedBookings,
  isBlockingConflict,
  bookingWindow,
  bookingKey,
  resolveEndInstant,
  DEFAULT_LEAGUE_BOOKING_MINUTES,
  type LeagueBooking,
} from '../../lib/league-schedule-conflict.ts';

/**
 * House league clash detection — games and practices in ONE pool (owner decision
 * 2026-08-08), placement answered by lib/venue-identity.ts (reused verbatim, ruling R3).
 *
 * These tests pin the phase's contract:
 *  - a practice occupying a surface blocks a game on it, and vice versa;
 *  - structured matches block, typed-text matches warn;
 *  - placeholder text ("TBD") is unchecked, never clashing;
 *  - cancelled/postponed bookings vacate their slot.
 */

const T18 = '2026-06-10T18:00:00.000Z';
const T19 = '2026-06-10T19:00:00.000Z';
const T20 = '2026-06-10T20:00:00.000Z';

function game(over: Partial<LeagueBooking> & { id: string }): LeagueBooking {
  return { kind: 'game', startsAt: T18, status: 'scheduled', ...over };
}
function practice(over: Partial<LeagueBooking> & { id: string }): LeagueBooking {
  return { kind: 'practice', startsAt: T18, status: 'scheduled', ...over };
}

describe('bookingWindow', () => {
  it('is null without a start instant', () => {
    assert.equal(bookingWindow(game({ id: 'g1', startsAt: null })), null);
  });

  it('uses the recorded end when valid', () => {
    const w = bookingWindow(game({ id: 'g1', startsAt: T18, endsAt: T20 }))!;
    assert.equal(w.endMs - w.startMs, 2 * 60 * 60_000);
  });

  it('falls back to the default length when the end is missing or before the start', () => {
    const def = DEFAULT_LEAGUE_BOOKING_MINUTES * 60_000;
    assert.equal(bookingWindow(game({ id: 'g1' }))!.endMs - Date.parse(T18), def);
    const inverted = bookingWindow(game({ id: 'g2', startsAt: T19, endsAt: T18 }))!;
    assert.equal(inverted.endMs - inverted.startMs, def);
  });
});

describe('findLeagueBookingConflicts — structured references', () => {
  it('flags two games on the same surface at the same time (blocking)', () => {
    const conflicts = findLeagueBookingConflicts(
      game({ id: 'new', orgVenueId: 'v1', orgVenueFacilityId: 'f1' }),
      [game({ id: 'g2', orgVenueId: 'v1', orgVenueFacilityId: 'f1' })],
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].matchedOn, 'facility');
    assert.equal(isBlockingConflict(conflicts[0]), true);
  });

  it('does not flag different surfaces in the same venue', () => {
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'new', orgVenueId: 'v1', orgVenueFacilityId: 'f1' }),
      [game({ id: 'g2', orgVenueId: 'v1', orgVenueFacilityId: 'f2' })],
    ).length, 0);
  });

  it('compares mixed granularity at the venue level (the shared blind spot fix)', () => {
    const conflicts = findLeagueBookingConflicts(
      game({ id: 'new', orgVenueId: 'v1', orgVenueFacilityId: 'f1' }),
      [game({ id: 'g2', orgVenueId: 'v1' })],
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].matchedOn, 'venue');
  });

  it('a practice blocks a game on the same surface — one booking pool', () => {
    const conflicts = findLeagueBookingConflicts(
      game({ id: 'new', orgVenueId: 'v1', orgVenueFacilityId: 'f1' }),
      [practice({ id: 'p1', orgVenueId: 'v1', orgVenueFacilityId: 'f1', endsAt: T20 })],
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].partner.kind, 'practice');
    assert.equal(isBlockingConflict(conflicts[0]), true);
  });
});

describe('findLeagueBookingConflicts — time windows', () => {
  it('uses the recorded end: a 3-hour practice still occupies the surface at +2h', () => {
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'new', startsAt: T20, orgVenueId: 'v1' }),
      [practice({ id: 'p1', startsAt: T18, endsAt: '2026-06-10T21:00:00.000Z', orgVenueId: 'v1' })],
    ).length, 1);
  });

  it('back-to-back bookings do not overlap (no invented buffer)', () => {
    // 18:00 + default 90min = 19:30; a 19:30 start is clean.
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'new', startsAt: '2026-06-10T19:30:00.000Z', orgVenueId: 'v1' }),
      [game({ id: 'g2', startsAt: T18, orgVenueId: 'v1' })],
    ).length, 0);
  });

  it('an overlap inside the default window is caught', () => {
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'new', startsAt: T19, orgVenueId: 'v1' }),
      [game({ id: 'g2', startsAt: T18, orgVenueId: 'v1' })],
    ).length, 1);
  });
});

describe('findLeagueBookingConflicts — typed text', () => {
  it('matches trim + case-fold only, and warns rather than blocks', () => {
    const conflicts = findLeagueBookingConflicts(
      game({ id: 'new', location: '  riverside  PARK ' }),
      [game({ id: 'g2', location: 'Riverside Park' })],
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].matchedOn, 'text');
    assert.equal(isBlockingConflict(conflicts[0]), false);
  });

  it('typed text never matches a structured reference (Phase 3 is a reviewed job)', () => {
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'new', location: 'Diamond 1' }),
      [game({ id: 'g2', orgVenueId: 'v1', orgVenueFacilityId: 'f1' })],
    ).length, 0);
  });

  it('two TBD bookings never clash (placeholder = no field set, ruling R2)', () => {
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'new', location: 'TBD' }),
      [game({ id: 'g2', location: 'tbd' })],
    ).length, 0);
  });
});

describe('findLeagueBookingConflicts — exclusions', () => {
  it('skips the booking\'s own stored row (editing never self-conflicts)', () => {
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'g1', orgVenueId: 'v1' }),
      [game({ id: 'g1', orgVenueId: 'v1' })],
    ).length, 0);
  });

  it('a game and a practice sharing an id are still distinct bookings', () => {
    assert.notEqual(bookingKey(game({ id: 'x' })), bookingKey(practice({ id: 'x' })));
  });

  it('cancelled and postponed bookings vacate the slot', () => {
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'new', orgVenueId: 'v1' }),
      [
        game({ id: 'g2', orgVenueId: 'v1', status: 'cancelled' }),
        game({ id: 'g3', orgVenueId: 'v1', status: 'postponed' }),
      ],
    ).length, 0);
  });

  it('unscheduled bookings are never compared', () => {
    assert.equal(findLeagueBookingConflicts(
      game({ id: 'new', orgVenueId: 'v1' }),
      [game({ id: 'g2', orgVenueId: 'v1', startsAt: null })],
    ).length, 0);
  });
});

describe('scanLeagueBookingConflicts', () => {
  it('flags BOTH sides of a clash, across the game/practice boundary', () => {
    const bookings = [
      game({ id: 'g1', orgVenueId: 'v1', orgVenueFacilityId: 'f1' }),
      practice({ id: 'p1', orgVenueId: 'v1', orgVenueFacilityId: 'f1' }),
      game({ id: 'g2', orgVenueId: 'v1', orgVenueFacilityId: 'f2' }), // different surface — clean
    ];
    const map = scanLeagueBookingConflicts(bookings);
    assert.equal(map.size, 2);
    assert.ok(map.has('game:g1'));
    assert.ok(map.has('practice:p1'));
    assert.equal(map.get('game:g1')!.partner.id, 'p1');
  });
});

describe('resolveEndInstant', () => {
  it('resolves an ordinary end on the same day', () => {
    // 18:00 → 20:00 Toronto wall-clock: exactly 2h apart in absolute time.
    const start = resolveEndInstant(null, '2026-06-10', '18:00')!;
    const end = resolveEndInstant(start, '2026-06-10', '20:00')!;
    assert.equal(Date.parse(end) - Date.parse(start), 2 * 60 * 60_000);
  });

  it('rolls an end at/before the start forward a day (overnight booking)', () => {
    const start = resolveEndInstant(null, '2026-06-10', '23:30')!;
    const end = resolveEndInstant(start, '2026-06-10', '00:30')!;
    // 23:30 → 00:30 next day = one hour, never minus-23.
    assert.equal(Date.parse(end) - Date.parse(start), 60 * 60_000);
  });

  it('returns null when date or end time is missing', () => {
    assert.equal(resolveEndInstant('2026-06-10T22:00:00.000Z', '2026-06-10', null), null);
    assert.equal(resolveEndInstant('2026-06-10T22:00:00.000Z', null, '20:00'), null);
  });
});

describe('countUncheckedBookings', () => {
  it('counts scheduled bookings with no usable placement — and only those', () => {
    const n = countUncheckedBookings([
      game({ id: 'g1' }),                                  // no location at all → unchecked
      game({ id: 'g2', location: 'TBD' }),                 // placeholder → unchecked (R2)
      game({ id: 'g3', location: 'Riverside Park' }),      // typed text IS checked
      game({ id: 'g4', orgVenueId: 'v1' }),                // picked venue → checked
      game({ id: 'g5', startsAt: null }),                  // unscheduled → not counted
      game({ id: 'g6', status: 'cancelled' }),             // cancelled → not counted
    ]);
    assert.equal(n, 2);
  });
});
