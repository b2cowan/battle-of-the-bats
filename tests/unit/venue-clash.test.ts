import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findClubClashes,
  findClubClashesFor,
  repEventBooking,
  tryoutSessionBooking,
  leagueBooking,
  tournamentGameBooking,
  tournamentGameMinutes,
  windowsOverlap,
  type ClubBooking,
} from '../../lib/venue-clash.ts';
import {
  clashLine,
  clashLineText,
  clashOtherName,
  clashTimeRange,
  seriesDateMark,
  seriesSummary,
  leagueSeriesLine,
  leagueRefusalLine,
  venueSourceLine,
  VENUE_SOURCE_PILL,
  NOT_CHECKED_LINE,
} from '../../lib/venue-clash-words.ts';
import { formatTimeRange } from '../../lib/utils.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';
import { DEFAULT_BOOKING_MINUTES } from '../../lib/booking-length.ts';
import { DEFAULT_GAME_DURATION_MINUTES } from '../../lib/game-status.ts';
import { SYSTEM_TIMING_DEFAULTS } from '../../lib/schedule-conflict.ts';

/**
 * THE ONE RULE (Club Tier Stage 6a, Ask 3) — this file IS the hub's table ("What counts as a clash",
 * K4MPu4ni53Ct7yrDcmWJd9 v64, specimen 2), case by case, plus the clock and the words. If a case here changes,
 * the ruling changed: re-read the hub before editing an expectation.
 */

const LIONS = 'venue-lions';
const D2 = 'fac-d2';
const D3 = 'fac-d3';
const KINSMEN = 'venue-kinsmen';
const DB = 'fac-db';

/** A local Toronto wall clock → ISO instant ("2026-11-03 17:30"). */
const at = (local: string) => {
  const [d, t] = local.split(' ');
  return zonedWallClockToUtc(d, t)!;
};

const NAMES = { venue: 'Lions Park', facility: 'Diamond 2' };

function rep(o: { id: string; team: string; teamName?: string; type?: string; start: string; end?: string | null; venue?: string | null; fac?: string | null; status?: string; mirror?: string | null; facName?: string }): ClubBooking {
  const b = repEventBooking({
    id: o.id, team_id: o.team, event_type: o.type ?? 'practice', starts_at: at(o.start), ends_at: o.end ? at(o.end) : null,
    status: o.status ?? 'scheduled', org_venue_id: o.venue === undefined ? LIONS : o.venue, org_venue_facility_id: o.fac === undefined ? D2 : o.fac,
    source_tournament_game_id: o.mirror ?? null,
  }, { team: o.teamName ?? o.team, venue: 'Lions Park', facility: o.facName ?? (o.fac === undefined ? 'Diamond 2' : o.fac === D3 ? 'Diamond 3' : null) });
  assert.ok(b, `rep booking ${o.id} should exist`);
  return b!;
}

describe('the rule — same venue, same facility, overlapping time (hub table row 1)', () => {
  const aa14 = rep({ id: 'e14', team: 't14', teamName: '14U AA', start: '2026-11-03 17:30', end: '2026-11-03 19:30' });
  const aaa13 = rep({ id: 'e13', team: 't13', teamName: '13U AAA', start: '2026-11-03 18:00', end: '2026-11-03 20:00' });

  it('is "booked by", and names the other booking by team, kind and time', () => {
    const f = findClubClashes(aaa13, [aa14]);
    assert.equal(f.length, 1);
    assert.equal(f[0].kind, 'booked_by');
    assert.deepEqual(Object.keys(f[0].other).sort(), ['endMs', 'facilityName', 'kind', 'ownerName', 'program', 'startMs', 'venueName'].sort(),
      'a finding carries only what the line may say (Ask 5): no ids, no opponent, no players');
    assert.equal(clashLineText(clashLine(f, { sport: 'baseball', venueName: 'Lions Park', facilityName: 'Diamond 2' })),
      'Diamond 2 is booked by 14U AA practice, 5:30–7:30 p.m.');
  });

  it('a 6:00 end and a 6:00 start do not clash (overlap = one starts before the other ends)', () => {
    const early = rep({ id: 'a', team: 'tA', start: '2026-11-03 16:00', end: '2026-11-03 18:00' });
    const late = rep({ id: 'b', team: 'tB', start: '2026-11-03 18:00', end: '2026-11-03 19:30' });
    assert.deepEqual(findClubClashes(late, [early]), []);
    assert.deepEqual(findClubClashes(early, [late]), []);
    assert.equal(windowsOverlap({ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 }), false);
  });

  it('two different diamonds in one park are not a clash; moving to Diamond 3 or to 8:00 makes the line go', () => {
    const d3 = rep({ id: 'e13b', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00', fac: D3 });
    assert.deepEqual(findClubClashes(d3, [aa14]), []);
    const at8 = rep({ id: 'e13c', team: 't13', start: '2026-11-03 20:00', end: '2026-11-03 22:00' });
    assert.deepEqual(findClubClashes(at8, [aa14]), []);
  });
});

describe('the facility not set on one side — the softer "busy then" (row 2)', () => {
  const aa14 = rep({ id: 'e14', team: 't14', teamName: '14U AA', start: '2026-11-03 17:30', end: '2026-11-03 19:30' });

  it('this booking has no diamond: "Lions Park is busy then … Pick a diamond to be sure."', () => {
    const unset = rep({ id: 'p', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00', fac: null });
    const f = findClubClashes(unset, [aa14]);
    assert.equal(f.length, 1);
    assert.equal(f[0].kind, 'busy_then');
    assert.equal(clashLineText(clashLine(f, { sport: 'baseball', venueName: 'Lions Park', facilityName: null })),
      'Lions Park is busy then: 14U AA practice on Diamond 2, 5:30–7:30 p.m. Pick a diamond to be sure.');
  });

  it('the other booking has no diamond: still "busy then", and says the other side has none set', () => {
    const otherUnset = rep({ id: 'o', team: 't14', teamName: '14U AA', start: '2026-11-03 17:30', end: '2026-11-03 19:30', fac: null });
    const mine = rep({ id: 'm', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00' });
    const f = findClubClashes(mine, [otherUnset]);
    assert.equal(f[0].kind, 'busy_then');
    assert.equal(clashLineText(clashLine(f, { sport: 'baseball', venueName: 'Lions Park', facilityName: 'Diamond 2' })),
      'Lions Park is busy then: 14U AA practice, 5:30–7:30 p.m., with no diamond set.');
  });
});

describe('a place the club doesn’t own is never compared (row 3)', () => {
  it('a coach’s own place or typed words (no club venue) finds nothing, and nothing finds it', () => {
    const typed = rep({ id: 'typed', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00', venue: null, fac: null });
    const aa14 = rep({ id: 'e14', team: 't14', start: '2026-11-03 17:30', end: '2026-11-03 19:30' });
    assert.deepEqual(findClubClashes(typed, [aa14]), []);
    assert.deepEqual(findClubClashes(aa14, [typed]), []);
    assert.equal(NOT_CHECKED_LINE, 'Not one of the club’s venues, so it isn’t checked for clashes.');
  });

  it('a facility without its venue counts as unplaced (a stray id never makes a booking comparable)', () => {
    const b = repEventBooking({ id: 'x', team_id: 't', event_type: 'practice', starts_at: at('2026-11-03 18:00'), org_venue_id: null, org_venue_facility_id: D2 }, { team: 'X' })!;
    assert.equal(b.venueId, null);
    assert.equal(b.facilityId, null);
  });
});

describe('what never clashes (rows 4, 5, 9)', () => {
  it('cancelled never clashes — rep, tryout, league, tournament', () => {
    assert.equal(repEventBooking({ id: 'c', team_id: 't', event_type: 'practice', starts_at: at('2026-11-03 18:00'), status: 'cancelled', org_venue_id: LIONS }, { team: 'X' }), null);
    assert.equal(tryoutSessionBooking({ id: 'c', team_id: 't', starts_at: at('2026-11-03 18:00'), status: 'cancelled', org_venue_id: LIONS }, { team: 'X' }), null);
    assert.equal(leagueBooking({ id: 'c', kind: 'game', scheduled_at: at('2026-11-03 18:00'), status: 'cancelled', org_venue_id: LIONS }, { season: 'S' }), null);
    assert.equal(tournamentGameBooking({ id: 'c', tournament_id: 'T', game_date: '2026-11-07', game_time: '11:00', status: 'cancelled' }, { venueId: LIONS, facilityId: D3, minutes: 90 }, { tournament: 'T' }), null);
  });

  it('a postponed league game never clashes at its old time', () => {
    assert.equal(leagueBooking({ id: 'p', kind: 'game', scheduled_at: at('2026-11-03 18:00'), status: 'postponed', org_venue_id: KINSMEN }, { season: 'S' }), null);
  });

  it('an outside tournament (dates only) is never a booking', () => {
    assert.equal(repEventBooking({ id: 'x', team_id: 't', event_type: 'external_tournament', starts_at: at('2026-11-07 00:00'), org_venue_id: LIONS }, { team: 'X' }), null);
  });
});

describe('lengths (rows 6, 7)', () => {
  it(`a rep event with no end is the one ${DEFAULT_BOOKING_MINUTES}-minute length — 7:00 with no end clashes with an 8:00 league game`, () => {
    const repGame = rep({ id: 'g', team: 't13', teamName: '13U AAA', type: 'league_game', start: '2026-11-03 19:00', end: null });
    assert.equal(repGame.endMs - repGame.startMs, 90 * 60_000);
    const hl = leagueBooking({ id: 'hl', kind: 'game', scheduled_at: at('2026-11-03 20:00'), ends_at: at('2026-11-03 21:30'), org_venue_id: LIONS, org_venue_facility_id: D2 }, { season: '2026 Fall House League', venue: 'Lions Park', facility: 'Diamond 2' })!;
    const f = findClubClashes(repGame, [hl]);
    assert.equal(f.length, 1);
    assert.equal(clashLineText(clashLine(f, { sport: 'baseball', venueName: 'Lions Park', facilityName: 'Diamond 2' })),
      'Diamond 2 is booked by a 2026 Fall House League game, 8:00–9:30 p.m.');
  });

  it('an end at or before the start is the default length, never a zero-length booking', () => {
    const b = repEventBooking({ id: 'z', team_id: 't', event_type: 'practice', starts_at: at('2026-11-03 18:00'), ends_at: at('2026-11-03 17:00'), org_venue_id: LIONS }, { team: 'X' })!;
    assert.equal(b.endMs - b.startMs, DEFAULT_BOOKING_MINUTES * 60_000);
  });

  it('a tournament game is its own length: game → division → tournament → 90', () => {
    assert.equal(tournamentGameMinutes({ duration_minutes: 120 }, 75, 60), 120);
    assert.equal(tournamentGameMinutes({ duration_minutes: null }, 75, 60), 75);
    assert.equal(tournamentGameMinutes({}, undefined, 60), 60);
    assert.equal(tournamentGameMinutes({}, 0, 'x'), 90);
  });

  it('the 90 minutes is ONE number: every engine reads it', () => {
    assert.equal(DEFAULT_BOOKING_MINUTES, 90);
    assert.equal(DEFAULT_GAME_DURATION_MINUTES, DEFAULT_BOOKING_MINUTES);
    assert.equal(SYSTEM_TIMING_DEFAULTS.durationMinutes, DEFAULT_BOOKING_MINUTES);
  });
});

describe('owners — what a program checks for itself (rows 8, and Ask 4)', () => {
  it('a team against itself: no line', () => {
    const a = rep({ id: 'a', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00' });
    const b = rep({ id: 'b', team: 't13', start: '2026-11-03 18:30', end: '2026-11-03 19:30' });
    assert.deepEqual(findClubClashes(a, [b]), []);
  });

  it('a team’s tryout against its own practice: no line (same team); against another team’s practice: the line', () => {
    const tryout = tryoutSessionBooking({ id: 's', team_id: 't13', starts_at: at('2026-11-03 18:00'), ends_at: at('2026-11-03 20:00'), org_venue_id: LIONS, org_venue_facility_id: D2 }, { team: '13U AAA' })!;
    const own = rep({ id: 'own', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00' });
    const other = rep({ id: 'oth', team: 't14', teamName: '14U AA', start: '2026-11-03 17:30', end: '2026-11-03 19:30' });
    assert.deepEqual(findClubClashes(tryout, [own]), []);
    assert.equal(findClubClashes(tryout, [other]).length, 1);
    assert.equal(clashOtherName({ program: 'rep', ownerName: '13U AAA', kind: 'tryout' }), '13U AAA tryout');
  });

  it('two league bookings are house league’s own rule, never this one’s', () => {
    const g = leagueBooking({ id: 'g', kind: 'game', scheduled_at: at('2026-11-03 18:00'), org_venue_id: KINSMEN, org_venue_facility_id: DB }, { season: 'S' })!;
    const p = leagueBooking({ id: 'p', kind: 'practice', scheduled_at: at('2026-11-03 18:00'), org_venue_id: KINSMEN, org_venue_facility_id: DB }, { season: 'S2' })!;
    assert.deepEqual(findClubClashes(g, [p]), []);
  });

  it('two games in one tournament are its own rule; two of the club’s tournaments on one diamond warn', () => {
    const link = { venueId: LIONS, facilityId: D3, minutes: 90 };
    const a = tournamentGameBooking({ id: 'a', tournament_id: 'T1', game_date: '2026-11-07', game_time: '11:00' }, link, { tournament: 'UAT Rep Club Invitational 2026' })!;
    const b = tournamentGameBooking({ id: 'b', tournament_id: 'T1', game_date: '2026-11-07', game_time: '11:30' }, link, { tournament: 'UAT Rep Club Invitational 2026' })!;
    const c = tournamentGameBooking({ id: 'c', tournament_id: 'T2', game_date: '2026-11-07', game_time: '11:30' }, link, { tournament: 'Eastview Classic' })!;
    assert.deepEqual(findClubClashes(a, [b]), []);
    const f = findClubClashes(a, [c]);
    assert.equal(f.length, 1);
    assert.equal(clashOtherName(f[0].other), 'an Eastview Classic game');
  });

  it('a team’s mirrored copy of its own tournament game is never compared with that game (S6-06)', () => {
    const game = tournamentGameBooking({ id: 'G', tournament_id: 'T1', game_date: '2026-11-07', game_time: '11:00' }, { venueId: LIONS, facilityId: D3, minutes: 90 }, { tournament: 'UAT Rep Club Invitational 2026' })!;
    const copy = rep({ id: 'm', team: 't15', type: 'tournament_game', start: '2026-11-07 11:00', end: '2026-11-07 12:30', fac: D3, mirror: 'G' });
    assert.deepEqual(findClubClashes(copy, [game]), []);
    assert.deepEqual(findClubClashes(game, [copy]), []);
  });
});

describe('several findings, and the order they are said in', () => {
  it('"Diamond 3 is booked by 12U AA practice, 6:00–7:30 p.m., and by a 2026 Fall House League game, 7:00–8:30 p.m."', () => {
    const mine = rep({ id: 'm', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00', fac: D3 });
    const aa12 = rep({ id: 'p12', team: 't12', teamName: '12U AA', start: '2026-11-03 18:00', end: '2026-11-03 19:30', fac: D3 });
    const hl = leagueBooking({ id: 'hl', kind: 'game', scheduled_at: at('2026-11-03 19:00'), ends_at: at('2026-11-03 20:30'), org_venue_id: LIONS, org_venue_facility_id: D3 }, { season: '2026 Fall House League' })!;
    const f = findClubClashes(mine, [hl, aa12]);
    const line = clashLine(f, { sport: 'baseball', venueName: 'Lions Park', facilityName: 'Diamond 3' })!;
    assert.equal(line.lead, 'Diamond 3 is booked by 12U AA practice, 6:00–7:30 p.m.,');
    assert.equal(line.rest, ' and by a 2026 Fall House League game, 7:00–8:30 p.m.');
  });

  it('"booked by" findings come before "busy then", each by start', () => {
    const mine = rep({ id: 'm', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00' });
    const busy = rep({ id: 'b', team: 't11', teamName: '11U AA', start: '2026-11-03 17:00', end: '2026-11-03 18:30', fac: null });
    const exact = rep({ id: 'e', team: 't14', teamName: '14U AA', start: '2026-11-03 19:00', end: '2026-11-03 20:00' });
    const f = findClubClashes(mine, [busy, exact]);
    assert.deepEqual(f.map(x => x.kind), ['booked_by', 'busy_then']);
    assert.equal(clashLineText(clashLine(f, { sport: 'baseball', venueName: 'Lions Park', facilityName: 'Diamond 2' })),
      'Diamond 2 is booked by 14U AA practice, 7:00–8:00 p.m. Lions Park is also busy then: 11U AA practice, 5:00–6:30 p.m., with no diamond set.');
  });

  it('a batch writer gets findings per booking, and only for the ones that clash', () => {
    const aa14 = rep({ id: 'e14', team: 't14', start: '2026-11-03 17:30', end: '2026-11-03 19:30' });
    const a = rep({ id: 'd1', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00' });
    const b = rep({ id: 'd2', team: 't13', start: '2026-11-10 18:00', end: '2026-11-10 20:00' });
    const m = findClubClashesFor([a, b], [aa14]);
    assert.deepEqual([...m.keys()], ['rep_event:d1']);
  });
});

describe('one clock — instants; a tournament game converted in the platform zone, daylight saving included', () => {
  it('a tournament game on the Sunday daylight saving ends (Nov 1, 2026) reads EST, not EDT', () => {
    // 6:00 p.m. Nov 1 is 23:00Z in EST. Read wrongly as EDT it would be 22:00Z and miss this practice.
    const game = tournamentGameBooking({ id: 'G', tournament_id: 'T1', game_date: '2026-11-01', game_time: '18:00:00' }, { venueId: LIONS, facilityId: D3, minutes: 60 }, { tournament: 'Fall Classic' })!;
    assert.equal(new Date(game.startMs).toISOString(), '2026-11-01T23:00:00.000Z');
    const practice = repEventBooking({ id: 'p', team_id: 't13', event_type: 'practice', starts_at: '2026-11-01T23:30:00.000Z', ends_at: '2026-11-02T00:30:00.000Z', org_venue_id: LIONS, org_venue_facility_id: D3 }, { team: '13U AAA' })!;
    assert.equal(findClubClashes(practice, [game]).length, 1);
  });

  it('a game across the change keeps its real length in minutes', () => {
    // 11:30 p.m. Sat Oct 31 (EDT, 03:30Z) for 3 hours ends at 06:30Z — 1:30 a.m. EST, after the clocks fell back.
    const game = tournamentGameBooking({ id: 'G', tournament_id: 'T1', game_date: '2026-10-31', game_time: '23:30' }, { venueId: LIONS, facilityId: D3, minutes: 180 }, { tournament: 'Night Ball' })!;
    assert.equal(game.endMs - game.startMs, 180 * 60_000);
    const late = repEventBooking({ id: 'l', team_id: 't', event_type: 'practice', starts_at: '2026-11-01T06:00:00.000Z', ends_at: '2026-11-01T07:00:00.000Z', org_venue_id: LIONS, org_venue_facility_id: D3 }, { team: 'X' })!;
    assert.equal(findClubClashes(late, [game]).length, 1);
  });

  it('spring forward (Mar 8, 2026): a 6:00 p.m. game is 22:00Z', () => {
    const game = tournamentGameBooking({ id: 'G', tournament_id: 'T1', game_date: '2026-03-08', game_time: '18:00' }, { venueId: LIONS, facilityId: D3, minutes: 90 }, { tournament: 'T' })!;
    assert.equal(new Date(game.startMs).toISOString(), '2026-03-08T22:00:00.000Z');
  });

  it('a Sunday 9:30 p.m. game is still Sunday 9:30 p.m. — the UTC day is Monday, and that never matters', () => {
    const game = tournamentGameBooking({ id: 'G', tournament_id: 'T1', game_date: '2026-10-04', game_time: '21:30' }, { venueId: LIONS, facilityId: D3, minutes: 90 }, { tournament: 'Sunday Night Series' })!;
    assert.equal(new Date(game.startMs).toISOString(), '2026-10-05T01:30:00.000Z');
    const practice = repEventBooking({ id: 'p', team_id: 't', event_type: 'practice', starts_at: at('2026-10-04 21:00'), ends_at: at('2026-10-04 22:00'), org_venue_id: LIONS, org_venue_facility_id: D3 }, { team: '13U AAA' })!;
    const f = findClubClashes(practice, [game]);
    assert.equal(f.length, 1);
    assert.equal(clashTimeRange(f[0].other.startMs, f[0].other.endMs), '9:30–11:00 p.m.');
  });
});

describe('the words — the sport’s own, never written in (owner wording ruling, 2026-10-08)', () => {
  const aa14b = (sport: string) => {
    const mine = rep({ id: 'm', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00', facName: '2' });
    const other = rep({ id: 'o', team: 't14', teamName: '14U AA', start: '2026-11-03 17:30', end: '2026-11-03 19:30', facName: '2' });
    return { f: findClubClashes(mine, [other]), sport };
  };

  it('basketball reads Court: "Court 2 is booked by …" and "Pick a court to be sure."', () => {
    const { f } = aa14b('basketball');
    assert.equal(clashLineText(clashLine(f, { sport: 'basketball', venueName: 'Westfield School', facilityName: '2' })),
      'Court 2 is booked by 14U AA practice, 5:30–7:30 p.m.');
    const unset = rep({ id: 'u', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00', fac: null });
    const other = rep({ id: 'o', team: 't14', teamName: '14U AA', start: '2026-11-03 17:30', end: '2026-11-03 19:30', facName: '2' });
    assert.equal(clashLineText(clashLine(findClubClashes(unset, [other]), { sport: 'basketball', venueName: 'Westfield School', facilityName: null })),
      'Westfield School is busy then: 14U AA practice on Court 2, 5:30–7:30 p.m. Pick a court to be sure.');
  });

  it('softball and baseball read Diamond; a sport with no surface noun reads Field', () => {
    const { f } = aa14b('softball');
    assert.match(clashLineText(clashLine(f, { sport: 'Softball', venueName: 'Lions Park', facilityName: '2' })), /^Diamond 2 is booked by/);
    assert.match(clashLineText(clashLine(f, { sport: 'soccer', venueName: 'Lions Park', facilityName: '2' })), /^Field 2 is booked by/);
  });

  it('a facility the club named in full is said as named, never "Diamond Diamond 2"', () => {
    const { f } = aa14b('baseball');
    assert.match(clashLineText(clashLine(f, { sport: 'baseball', venueName: 'Lions Park', facilityName: 'North Diamond' })), /^North Diamond is booked by/);
  });

  it('the clock: "5:30–7:30 p.m.", "10:00 a.m.–12:00 p.m.", the period said once when shared', () => {
    assert.equal(formatTimeRange('17:30', '19:30'), '5:30–7:30 p.m.');
    assert.equal(formatTimeRange('10:00', '12:00'), '10:00 a.m.–12:00 p.m.');
    assert.equal(formatTimeRange('11:30', '13:00'), '11:30 a.m.–1:00 p.m.');
    assert.equal(formatTimeRange('18:00', null), '6:00 p.m.');
  });

  it('another program is named by what it is', () => {
    assert.equal(clashOtherName({ program: 'league', ownerName: '2026 Fall House League', kind: 'game' }), 'a 2026 Fall House League game');
    assert.equal(clashOtherName({ program: 'league', ownerName: '2026 Fall House League', kind: 'practice' }), 'a 2026 Fall House League practice');
    assert.equal(clashOtherName({ program: 'tournament', ownerName: 'UAT Rep Club Invitational 2026', kind: 'game' }), 'a UAT Rep Club Invitational 2026 game');
    assert.equal(clashOtherName({ program: 'tournament', ownerName: 'RBI Classic', kind: 'game' }), 'an RBI Classic game');
    assert.equal(clashOtherName({ program: 'rep', ownerName: '11U AA', kind: 'team_event' }), '11U AA team event');
  });
});

describe('a weekly series (specimen 1) and house league’s lines (specimen 3)', () => {
  const ctx = { sport: 'baseball', venueName: 'Lions Park', facilityName: 'Diamond 2' };
  const aa14 = rep({ id: 'e14', team: 't14', teamName: '14U AA', start: '2026-11-03 17:30', end: '2026-11-03 19:30' });

  it('marks a clashing date with who has the diamond, and sums the series in one line', () => {
    const mine = rep({ id: 'd1', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00' });
    const clash = findClubClashes(mine, [aa14]);
    assert.equal(seriesDateMark(clash, ctx), 'Diamond 2 · 14U AA practice, 5:30–7:30 p.m.');
    const eight = (hits: typeof clash[]) => [...hits, ...Array.from({ length: 8 - hits.length }, () => [])];
    const s = seriesSummary(eight([clash, clash]), ctx)!;
    assert.equal(clashLineText(s), '2 of 8 dates clash on Diamond 2. Remove them, or change the time or diamond for all.');
    assert.equal(s.tone, 'warn');
    const unset = rep({ id: 'u', team: 't13', start: '2026-11-03 18:00', end: '2026-11-03 20:00', fac: null });
    const busy = seriesSummary(eight([findClubClashes(unset, [aa14])]), { ...ctx, facilityName: null })!;
    assert.equal(clashLineText(busy), '1 of 8 dates is busy at Lions Park. Pick a diamond to be sure, or remove it.');
    assert.equal(busy.tone, 'busy', 'a venue only busy is the softer line');
    assert.equal(seriesSummary(eight([]), ctx), null);
  });

  it('house league’s series names the dates: "2 of 4 Tuesdays clash on Diamond B: 11U AA practice, 6:00–7:30 p.m., on Nov 3 and Nov 10."', () => {
    const aa11 = (d: string) => repEventBooking({ id: `p${d}`, team_id: 't11', event_type: 'practice', starts_at: at(`${d} 18:00`), ends_at: at(`${d} 19:30`), org_venue_id: KINSMEN, org_venue_facility_id: DB }, { team: '11U AA', venue: 'Kinsmen Park', facility: 'Diamond B' })!;
    const hl = (d: string) => leagueBooking({ id: `hl${d}`, kind: 'practice', scheduled_at: at(`${d} 18:00`), ends_at: at(`${d} 19:00`), org_venue_id: KINSMEN, org_venue_facility_id: DB }, { season: '2026 Fall House League' })!;
    const pool = [aa11('2026-11-03'), aa11('2026-11-10')];
    const byDate = ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'].map(date => ({ date, findings: findClubClashes(hl(date), pool) }));
    assert.equal(clashLineText(leagueSeriesLine(byDate, { sport: 'baseball', venueName: 'Kinsmen Park', facilityName: 'Diamond B' })),
      '2 of 4 Tuesdays clash on Diamond B: 11U AA practice, 6:00–7:30 p.m., on Nov 3 and Nov 10.');
  });

  it('house league’s own refusal, in red, before Create — said by the diamond, or by the park when one side has none', () => {
    const r = leagueRefusalLine({ sport: 'baseball', matchedOn: 'facility', venueName: 'Kinsmen Park', facilityName: 'Diamond B', partnerLabel: 'Greens vs Golds', partnerKind: 'game', proposedKind: 'game', startIso: at('2026-11-03 18:00'), endIso: at('2026-11-03 19:30') });
    assert.equal(`${r.lead}${r.rest}`, 'Diamond B already has Greens vs Golds, 6:00–7:30 p.m. Two league games can’t share a diamond: change the time or the diamond.');
    const s = leagueRefusalLine({ sport: 'basketball', matchedOn: 'facility', venueName: 'Westfield School', facilityName: '1', partnerLabel: 'Reds practice', partnerKind: 'practice', proposedKind: 'practice', startIso: at('2026-11-10 18:00'), endIso: at('2026-11-10 19:00'), date: '2026-11-10' });
    assert.equal(`${s.lead}${s.rest}`, 'Court 1 already has Reds practice, Nov 10, 6:00–7:00 p.m. League bookings can’t share a court: change the time or the court.');
    const v = leagueRefusalLine({ sport: 'baseball', matchedOn: 'venue', venueName: 'Kinsmen Park', facilityName: null, partnerLabel: 'Greens vs Golds', partnerKind: 'game', proposedKind: 'game', startIso: at('2026-11-03 18:00'), endIso: at('2026-11-03 19:30') });
    assert.match(`${v.lead}`, /^Kinsmen Park already has Greens vs Golds/);
  });

  it('the quiet line under Venue says where the name came from — a pill in a club; outside one, only an address', () => {
    assert.deepEqual(venueSourceLine('club', '41 Lions Park Dr', true), { pill: 'club', rest: '41 Lions Park Dr' });
    assert.deepEqual(venueSourceLine('place', '120 Westfield Rd', true), { pill: 'place', rest: '120 Westfield Rd' });
    assert.deepEqual(venueSourceLine('place', null, true), { pill: 'place', rest: '' });
    // A typed name keeps its one warning: nothing else on the form says it isn't checked.
    assert.deepEqual(venueSourceLine('typed', null, true), { pill: 'typed', rest: 'Not checked for clashes' });
    assert.deepEqual(venueSourceLine('place', '120 Westfield Rd', false), { pill: null, rest: '120 Westfield Rd' });
    assert.deepEqual(venueSourceLine('typed', null, false), { pill: null, rest: '' });
    assert.deepEqual(VENUE_SOURCE_PILL, { club: 'Club venue', place: 'Your place', typed: 'Typed' });
  });
});
