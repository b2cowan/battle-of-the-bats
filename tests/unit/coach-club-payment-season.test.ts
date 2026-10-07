import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { seasonReadsClubInstallment } from '../../lib/club-money-figures.ts';

/**
 * Club Tier Stage 3c, S3C-11 — call 1 (owner, 2026-10-07): "the payment counting in the season that's running when
 * the money actually moved". `seasonReadsClubInstallment` is the rule every coach cash read asks through
 * `getSeasonClubBills` (lib/coach-club-bills.ts); mig 318's trigger keeps `carried_by_program_year_id` on every writer,
 * and `check:club-money-atomicity` proves that half.
 */

const OLD = 'season-2025', WORKING = 'season-2026';
const owed = { paidAt: null, paidOn: null, sentAt: null, sentOn: null, carriedByProgramYearId: null };
const sent = (sentOn: string, carried: string | null) => ({ ...owed, sentAt: '2026-10-02T15:00:00Z', sentOn, carriedByProgramYearId: carried });
const received = (paidOn: string, carried: string | null) => ({ ...owed, paidAt: '2026-10-02T15:00:00Z', paidOn, carriedByProgramYearId: carried });

describe('which season\'s cash reads a club installment', () => {
  it('money still the team\'s belongs to its BILL\'s season (the forward view: still owed)', () => {
    assert.equal(seasonReadsClubInstallment(owed, WORKING, WORKING), true);
    assert.equal(seasonReadsClubInstallment(owed, OLD, WORKING), false, 'an earlier bill still owed is the Club tab\'s, not this season\'s cash');
    assert.equal(seasonReadsClubInstallment(owed, OLD, OLD), true);
  });
  it('a late payment of last season\'s bill counts in the season running when it was recorded — never the closed one', () => {
    const late = sent('2026-10-02', WORKING);
    assert.equal(seasonReadsClubInstallment(late, OLD, WORKING), true);
    assert.equal(seasonReadsClubInstallment(late, OLD, OLD), false, 'the closed season\'s cash never moves');
  });
  it('the day typed is irrelevant: a payment backdated into last season still counts where it was recorded', () => {
    const backdated = sent('2025-08-20', WORKING);
    assert.equal(seasonReadsClubInstallment(backdated, OLD, WORKING), true);
    assert.equal(seasonReadsClubInstallment(backdated, OLD, OLD), false);
  });
  it('received by the club reads the same as sent', () => {
    assert.equal(seasonReadsClubInstallment(received('2026-10-02', WORKING), OLD, WORKING), true);
    assert.equal(seasonReadsClubInstallment(received('2026-05-02', OLD), OLD, OLD), true, 'paid while its own season ran');
  });
  it('a payment recorded while the team had no running season is in no season\'s cash (until the next one starts)', () => {
    const between = received('2026-09-01', null);
    assert.equal(seasonReadsClubInstallment(between, OLD, OLD), false);
    assert.equal(seasonReadsClubInstallment(between, OLD, WORKING), false);
  });
});
