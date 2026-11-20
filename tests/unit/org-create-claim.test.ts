import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SAME_START_WINDOW_MS, compareSeats, isTheSameStart, isUniqueViolation, settleClaim, type RealSeat,
} from '../../lib/org-create-claim.ts';
import { readCode } from './_source-code.ts';

/**
 * TWO TABS NAMING A CLUB AT THE SAME MOMENT MAKE ONE ORGANIZATION (call C5, 2026-11-19): claim, then verify.
 * The shared create step is /api/org/create; both start doors and the League Plus door post to it.
 */
const seat = (organizationId: string, seatAt: string, extra: Partial<RealSeat> = {}): RealSeat =>
  ({ organizationId, seatAt, slug: organizationId, orgCreatedAt: seatAt, ...extra });

const T0 = '2026-11-20T15:00:00.000Z';
const T1 = '2026-11-20T15:00:00.040Z';

describe('the earliest seat keeps its organization', () => {
  it('a lone request keeps what it made (the ordinary case)', () => {
    assert.deepEqual(settleClaim([seat('a', T0)], 'a'), { keep: true });
  });

  it('two requests that BOTH see each other: exactly one keeps, the same one whichever request computes it', () => {
    const both = [seat('a', T0), seat('b', T1)];
    assert.deepEqual(settleClaim(both, 'a'), { keep: true });
    const loser = settleClaim(both, 'b');
    assert.equal(loser.keep, false);
    assert.equal(loser.keep === false && loser.winner.organizationId, 'a');
  });

  it('the first request reads before the second wrote: it sees only itself and keeps; the second then sees both and steps aside', () => {
    assert.deepEqual(settleClaim([seat('a', T0)], 'a'), { keep: true });
    assert.equal(settleClaim([seat('a', T0), seat('b', T1)], 'b').keep, false);
  });

  it('the same instant is settled by the organization id, so the two requests still agree', () => {
    const tie = [seat('b', T0), seat('a', T0)];
    assert.deepEqual(settleClaim(tie, 'a'), { keep: true });
    assert.equal(settleClaim(tie, 'b').keep, false);
    assert.equal(compareSeats(seat('a', T0), seat('b', T0)) < 0, true);
  });

  it('a seat held from before (an invitation accepted in the meantime) always outranks the new one', () => {
    const older = seat('old', '2026-09-01T10:00:00.000Z', { orgCreatedAt: '2026-09-01T10:00:00.000Z' });
    const result = settleClaim([older, seat('new', T0)], 'new');
    assert.equal(result.keep, false);
  });

  it('a read that does not find the own seat keeps the organization: never leave the person with nothing', () => {
    assert.deepEqual(settleClaim([], 'a'), { keep: true });
    assert.deepEqual(settleClaim([seat('other', T0)], 'a'), { keep: true });
  });

  it('three requests at once leave exactly one organization', () => {
    const seats = [seat('c', '2026-11-20T15:00:00.080Z'), seat('a', T0), seat('b', T1)];
    const kept = ['a', 'b', 'c'].filter(id => settleClaim(seats, id).keep);
    assert.deepEqual(kept, ['a']);
  });
});

describe('what the person who stepped aside is told', () => {
  const now = new Date('2026-11-20T15:00:30.000Z');

  it('the earlier organization was made moments ago: it is the same start, so they land in it', () => {
    assert.equal(isTheSameStart({ orgCreatedAt: T0 }, now), true);
    assert.equal(isTheSameStart({ orgCreatedAt: new Date(now.getTime() - SAME_START_WINDOW_MS).toISOString() }, now), true);
  });

  it('an older workspace is the ordinary "already has a workspace" refusal, never silently reused', () => {
    assert.equal(isTheSameStart({ orgCreatedAt: new Date(now.getTime() - SAME_START_WINDOW_MS - 1).toISOString() }, now), false);
    assert.equal(isTheSameStart({ orgCreatedAt: '2026-01-01T00:00:00.000Z' }, now), false);
    assert.equal(isTheSameStart({ orgCreatedAt: null }, now), false);
    assert.equal(isTheSameStart({ orgCreatedAt: 'not a date' }, now), false);
  });
});

describe('an address taken between the check and the insert is a clash to retry, not a failure', () => {
  it('recognises the database’s unique violation however the client words it', () => {
    assert.equal(isUniqueViolation({ code: '23505', message: 'x' }), true);
    assert.equal(isUniqueViolation(new Error('duplicate key value violates unique constraint "organizations_slug_key"')), true);
    assert.equal(isUniqueViolation(new Error('connection reset')), false);
    assert.equal(isUniqueViolation(null), false);
  });
});

describe('the shared create step settles it, once, for every door', () => {
  const route = readCode('app/api/org/create/route.ts');

  it('verifies after the owner seat is written, and removes only what this request made', () => {
    assert.match(route, /settleClaim\(await readRealSeats\(user\.id\), org\.id\)/);
    const seatAt = route.indexOf('createOrganizationMember(');
    const claimAt = route.indexOf('settleClaim(');
    const clearAt = route.indexOf('clearStartDoor(');
    assert.ok(seatAt > 0 && claimAt > seatAt && clearAt > claimAt, 'seat, then claim, then the start door is cleared');
    assert.match(route, /\.eq\('organization_id', org\.id\)\.eq\('user_id', user\.id\)/);
  });

  it('retries a generated address that was taken in between, and refuses a typed one as taken', () => {
    assert.match(route, /isUniqueViolation\(createError\)/);
    assert.match(route, /explicitSlug\) return NextResponse\.json\(\{ error: 'That public URL is already taken/);
  });

  it('every door that makes an organization posts to this one route', () => {
    for (const form of ['app/(consumer)/start/StartPaidDoorForm.tsx', 'app/(consumer)/start/tournament/StartTournamentForm.tsx']) {
      assert.match(readCode(form), /'\/api\/org\/create'/, form);
    }
  });

  it('the name step takes one create at a time, even for a double Enter before the button disables', () => {
    const form = readCode('app/(consumer)/start/StartDoorForm.tsx');
    assert.match(form, /if \(creating\.current\) return;/);
    assert.match(form, /creating\.current = true;/);
  });
});
