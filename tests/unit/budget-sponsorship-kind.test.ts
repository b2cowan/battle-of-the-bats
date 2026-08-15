/**
 * SPONSORSHIP IS MONEY IN, AND SO IS FUNDRAISING — pinned as arithmetic, because the way this
 * breaks is invisible to the compiler.
 *
 * WHY THIS EXISTS, PRECISELY. Migration 237 added a third `line_kind`, `sponsorship`, alongside
 * `cost` and `funding`. Nineteen readers were written as:
 *
 *     lineKind: row.line_kind === 'funding' ? 'funding' : 'cost'
 *
 * which was correct while there were exactly two kinds and became silently wrong the moment there
 * were three: every sponsorship line lands in the COST bucket. It does not throw, it does not fail
 * a type check — both sides are strings — and the only visible symptom is that a team which
 * budgeted $2,000 of sponsorship gets asked for MORE from families rather than less. The sign
 * flips: instead of reducing what players fund by $2,000, it adds $2,000 to the season's cost, so
 * the error is twice the amount and lands on every family's dues.
 *
 * So the rule is stated as sums rather than as a convention: a sponsorship line must behave
 * EXACTLY as a fundraising line does everywhere the money is counted. If someone reverts a reader
 * to `=== 'funding'`, one of these fails.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeBudgetTotals, isFundingKind, normalizeBudgetLineKind,
  BUDGET_LINE_KINDS, FUNDING_LINE_KINDS, LINE_KIND_SECTION,
} from '../../lib/coach-budget-totals.ts';
import { buildPeriodView } from '../../lib/coach-budget-periods-view.ts';
import { isRealisedRecord } from '../../lib/coach-fundraising.ts';

const line = (kind: 'cost' | 'funding' | 'sponsorship', amount: number, id: string = kind) => ({
  id, description: `${kind} line`, categoryName: 'Tournaments',
  totalAmount: amount, lineKind: kind, periods: [] as Array<{ periodDate: string | null; amount: number }>,
});

describe('a sponsorship line is money IN, exactly like fundraising', () => {
  it('normalizes to itself rather than collapsing to cost', () => {
    assert.equal(normalizeBudgetLineKind('sponsorship'), 'sponsorship');
    assert.equal(normalizeBudgetLineKind('funding'), 'funding');
    // Anything unrecognised is a cost — the column default, and what every pre-230 row is.
    assert.equal(normalizeBudgetLineKind(null), 'cost');
    assert.equal(normalizeBudgetLineKind('nonsense'), 'cost');
  });

  it('counts as funding, not as a cost', () => {
    assert.equal(isFundingKind('sponsorship'), true);
    assert.equal(isFundingKind('funding'), true);
    assert.equal(isFundingKind('cost'), false);
    assert.deepEqual(FUNDING_LINE_KINDS, ['funding', 'sponsorship']);
    // Every kind the DB accepts must be known here, or a reader will meet one it cannot place.
    assert.deepEqual(BUDGET_LINE_KINDS, ['cost', 'funding', 'sponsorship']);
  });

  it('SUBTRACTS from what players fund — the sign that would flip', () => {
    const costsOnly = computeBudgetTotals({
      lines: [line('cost', 8000)], estimatedTotal: null, rosterCount: 10,
    });
    const withSponsorship = computeBudgetTotals({
      lines: [line('cost', 8000), line('sponsorship', 2000)], estimatedTotal: null, rosterCount: 10,
    });

    assert.equal(costsOnly.perPlayer, 800, 'baseline: $8,000 over 10 players');
    assert.equal(
      withSponsorship.perPlayer, 600,
      'a $2,000 sponsorship must LOWER per-player dues to $600. If this reads 1000, the '
      + 'sponsorship was counted as a COST and every family is being asked for $400 too much.',
    );
    assert.equal(withSponsorship.expectedFunding, 2000);
    assert.equal(withSponsorship.itemized, 8000, 'itemized costs must not swallow the sponsorship');
  });

  it('is interchangeable with fundraising in the totals', () => {
    const viaFundraising = computeBudgetTotals({
      lines: [line('cost', 5000), line('funding', 1500)], estimatedTotal: null, rosterCount: 5,
    });
    const viaSponsorship = computeBudgetTotals({
      lines: [line('cost', 5000), line('sponsorship', 1500)], estimatedTotal: null, rosterCount: 5,
    });
    assert.deepEqual(
      { ...viaSponsorship }, { ...viaFundraising },
      'the two money-in kinds differ ONLY in reporting — every figure must match',
    );
  });

  it('adds both kinds together rather than picking one', () => {
    const both = computeBudgetTotals({
      lines: [line('cost', 9000), line('funding', 1000, 'f'), line('sponsorship', 2000, 's')],
      estimatedTotal: null, rosterCount: 10,
    });
    assert.equal(both.expectedFunding, 3000, 'both money-in kinds count');
    assert.equal(both.perPlayer, 600, '($9,000 − $1,000 − $2,000) ÷ 10');
  });
});

/**
 * A PLEDGE IS RECORDED BUT IS NOT MONEY — the second thing this change got wrong, found in review.
 *
 * A sponsor's entry is written the moment the sponsor is recorded, because it holds the
 * arrangement: the amount, the family, the agreed share. But while the sponsor is `pledged` no
 * income has posted and no dues credit exists. THREE season-wide readers summed entries without
 * asking, so a promise counted as banked money in the Money hub's headline figure, in Budget vs.
 * Actual's "actual", and in the season settlement pot — the last of which is what families are PAID
 * OUT OF, so a pledge could have funded a real refund of money the team never received.
 *
 * The rule now lives in one predicate, and this is it stated as a test so the fourth reader
 * inherits it rather than rediscovering it.
 */
describe('a pledge is recorded but is not money', () => {
  it('counts a received sponsor and refuses a pledged one', () => {
    assert.equal(isRealisedRecord({ kind: 'sponsor', sponsorStatus: 'received' }), true);
    assert.equal(
      isRealisedRecord({ kind: 'sponsor', sponsorStatus: 'pledged' }), false,
      'a pledged sponsor must not count as raised — the settlement pot pays families out of this',
    );
  });

  it('always counts a fundraiser, whose rows only exist once money was raised', () => {
    assert.equal(isRealisedRecord({ kind: 'fundraiser', sponsorStatus: null }), true);
    assert.equal(isRealisedRecord({ kind: 'fundraiser' }), true);
  });

  it('treats a sponsor with no status as unrealised rather than assuming the money arrived', () => {
    // Defaulting the other way is how a data glitch silently becomes income.
    assert.equal(isRealisedRecord({ kind: 'sponsor', sponsorStatus: null }), false);
    assert.equal(isRealisedRecord({ kind: 'sponsor' }), false);
  });
});

describe('the period grid keeps a sponsorship on the money-in side', () => {
  it('carries the minus sign, and gives each kind its own group', () => {
    const view = buildPeriodView([
      { ...line('cost', 1200), periods: [{ periodDate: '2027-03-01', amount: 1200 }] },
      { ...line('sponsorship', 500), periods: [{ periodDate: '2027-03-01', amount: 500 }] },
    ], 'months');

    const march = view.totals.cells['2027-03'];
    assert.equal(
      march, 700,
      'March must read $1,200 of cost LESS $500 of sponsorship. A 1700 here means the '
      + 'sponsorship was added instead of subtracted — the running balance would then be wrong '
      + 'by twice its amount.',
    );

    const sponsorGroup = view.groups.find(g => g.lineKind === 'sponsorship');
    assert.ok(sponsorGroup, 'a sponsorship line must get its own group, not merge into fundraising');
    assert.equal(sponsorGroup!.name, LINE_KIND_SECTION.sponsorship);
    // Costs first, money-in after — the same order everywhere the two appear.
    assert.equal(view.groups[0].lineKind, 'cost');
  });
});
