import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  publicRegistrationLine, registrationChip, registrationDatesRow, registrationRefusal, registrationState, takesSignups,
} from '../../lib/league-registration-state.ts';
import { movesFrom } from '../../lib/house-league-status-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9b-1, PART 4 — THE DATES RUN THE FORM (owner S2·b; 2026-10-25 Close / Reopen until…; copy §5.2, §5.3,
 * §12). The status and the dates together, read in the club's wall clock as stored (never re-zoned); one answer for the
 * route, the register page, the public page, the club home and the season page.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const season = (over: Record<string, unknown> = {}) => ({
  status: 'registration_open', registrationOpenAt: '2026-06-01T09:00:00Z', registrationCloseAt: '2026-08-01T17:00:00Z',
  registrationClosedAt: null, ...over,
}) as Parameters<typeof registrationState>[0];

describe('registrationState', () => {
  it('an opened season follows its dates: ahead, open, past', () => {
    assert.equal(registrationState(season(), '2026-05-31T23:59'), 'opensAhead');
    assert.equal(registrationState(season(), '2026-06-01T09:00'), 'open');
    assert.equal(registrationState(season(), '2026-08-01T17:00'), 'open', 'the close minute itself still takes a sign-up');
    assert.equal(registrationState(season(), '2026-08-01T17:01'), 'closedByDate');
  });
  it('the stored time is the club’s time: an 8:00 a.m. close is not the day before', () => {
    const early = season({ registrationCloseAt: '2026-08-01T08:00:00Z' });
    assert.equal(registrationState(early, '2026-08-01T07:59'), 'open');
    assert.equal(registrationDatesRow(early, '2026-08-02T10:00').value, 'Closed Aug 1');
  });
  it('the convenor closing it, getting ready, and a season under way', () => {
    assert.equal(registrationState(season({ status: 'registration_closed' }), '2026-07-01T12:00'), 'closedByYou');
    assert.equal(registrationState(season({ status: 'draft' }), '2026-07-01T12:00'), 'draft');
    assert.equal(registrationState(season({ status: 'draft', registrationOpenAt: null }), '2026-07-01T12:00'), 'notSet');
    assert.equal(registrationState(season({ status: 'active' }), '2026-07-01T12:00'), 'ended');
  });
  it('an opened season with no dates is open until it is closed', () => {
    assert.equal(registrationState(season({ registrationOpenAt: null, registrationCloseAt: null }), '2030-01-01T00:00'), 'open');
  });
});

describe('the words follow the state (copy §5.2, §5.3, §12)', () => {
  it('only an open form takes a sign-up; a closed one says why', () => {
    assert.equal(takesSignups(season(), '2026-07-01T12:00'), true);
    assert.equal(registrationRefusal(season(), '2026-05-01T12:00'), 'Registration for this season isn’t open yet.');
    assert.equal(registrationRefusal(season(), '2026-09-01T12:00'), 'Registration for this season has closed.');
    assert.equal(registrationRefusal(season({ status: 'active' }), '2026-07-01T12:00'), 'This season is no longer taking registrations.');
  });
  it('the chip and the public line', () => {
    assert.equal(registrationChip(season(), '2026-05-01T12:00'), 'Opens Jun 1');
    assert.equal(registrationChip(season(), '2026-09-01T12:00'), 'Closed Aug 1');
    assert.equal(registrationChip(season({ status: 'registration_closed' }), '2026-07-01T12:00'), 'Registration closed');
    assert.equal(publicRegistrationLine(season(), '2026-07-01T12:00'), 'Registration closes Aug 1.');
    assert.equal(publicRegistrationLine(season({ status: 'registration_closed' }), '2026-07-01T12:00'), 'Registration for this season has closed.');
  });
  it('the dates row always says whether the date or the convenor closed it', () => {
    assert.deepEqual(registrationDatesRow(season(), '2026-09-01T12:00'), { value: 'Closed Aug 1', sub: 'The close date passed.', door: 'reopen' });
    const you = registrationDatesRow(season({ status: 'registration_closed', registrationClosedAt: '2026-07-03T16:00:00.000Z' }), '2026-07-04T12:00');
    assert.equal(you.value, 'You closed registration on Jul 3.');
    assert.equal(you.sub, 'The close date was Aug 1.');
    assert.equal(registrationDatesRow(season(), '2026-07-01T12:00').sub, 'Open until Aug 1.');
  });
});

describe('the doors and the server', () => {
  it('a season its close date closed offers Start season and Reopen until…', () => {
    assert.deepEqual(movesFrom('registration_open', 'closedByDate'), ['start', 'reopenRegistration']);
    assert.deepEqual(movesFrom('registration_open', 'open'), ['close']);
  });
  it('the sign-up route refuses through the state, not the status alone', () => {
    const route = readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');
    assert.match(route, /const closed = registrationRefusal\(season\);/);
    assert.doesNotMatch(route, /season\.status !== 'registration_open'/);
  });
  it('the season route remembers when the convenor closed it, and starts a season its date closed', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts');
    assert.match(route, /if \(newStatus === 'registration_closed'\) patch\.registrationClosedAt = new Date\(\)\.toISOString\(\);/);
    assert.match(route, /registrationState\(season\) !== 'closedByDate'/);
  });
  it('no public surface decides "open" from the status alone any more', () => {
    for (const f of ['app/[orgSlug]/league/[seasonSlug]/page.tsx', 'app/[orgSlug]/league/[seasonSlug]/register/page.tsx', 'lib/club-home-data.ts', 'lib/club-public-teams.ts']) {
      assert.doesNotMatch(readCode(f), /status === 'registration_open'/, f);
    }
  });
});
