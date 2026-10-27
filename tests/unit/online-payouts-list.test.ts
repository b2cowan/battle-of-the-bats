import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  childrenWho, mapPayoutLines, payoutContents, payoutCounts, payoutFailReason, payoutMatches, payoutStatus, payoutsSummary,
  type BtIn, type OurIndex,
} from '../../lib/online-payouts-map.ts';
import { accountingTabs } from '../../lib/admin-kit-nav.ts';
import { PAYOUTS_LIST_WORDS } from '../../lib/online-payment-words.ts';

/**
 * CLUB TIER STAGE 12d-2 PART 2: ACCOUNTING › PAYOUTS (frame 3, words §3; ask 5; owner ruling 1, 2026-10-27).
 * A payout's lines are read as people, in both flows, from the line types the sandbox showed (plan §0, 12d-2 state).
 */
const bt = (over: Partial<BtIn> & Pick<BtIn, 'id' | 'type'>): BtIn =>
  ({ reportingCategory: null, net: 0, created: 1_793_100_000, sourceId: null, sourceCharge: null, ...over });

const OURS: OurIndex = {
  payments: [
    { id: 'p-league', chargeId: 'ch_league', paymentIntentId: 'pi_l', disputeId: null, receiptNo: 1084, rail: 'card', who: 'Henry and Lily Grant', what: 'House league' },
    { id: 'p-team', chargeId: 'ch_team', paymentIntentId: 'pi_t', disputeId: null, receiptNo: 1086, rail: 'card', who: 'Riverside Rockets 12U', what: 'Fall Classic balance' },
    { id: 'p-debit', chargeId: 'py_debit', paymentIntentId: 'pi_d', disputeId: 'du_bank', receiptNo: 1078, rail: 'bank_debit', who: 'Maya Singh', what: 'House league' },
    { id: 'p-gone', chargeId: 'ch_gone', paymentIntentId: 'pi_g', disputeId: null, receiptNo: 1079, rail: 'card', who: 'Theo Grant', what: 'House league' },
  ],
  refunds: { re_ours: 'p-gone' },
  disputes: { du_card: 'p-league' },
};

describe('a payout’s lines, named (both flows)', () => {
  const lines = mapPayoutLines([
    bt({ id: 't0', type: 'payout', net: -128_450 }),
    bt({ id: 't1', type: 'charge', reportingCategory: 'charge', net: 30_000, sourceId: 'ch_league' }),
    bt({ id: 't2', type: 'charge', reportingCategory: 'charge', net: 30_000, sourceId: 'ch_team' }),
    bt({ id: 't3', type: 'payment', reportingCategory: 'charge', net: 15_000, sourceId: 'py_debit' }),
    bt({ id: 't4', type: 'refund', reportingCategory: 'refund', net: -15_000, sourceId: 're_ours' }),
    bt({ id: 't5', type: 'refund', reportingCategory: 'refund', net: -4_000, sourceId: 're_dash', sourceCharge: 'ch_team' }),
    bt({ id: 't6', type: 'payment_failure_refund', reportingCategory: 'charge_failure', net: -5_000, sourceId: 'py_debit' }),
    bt({ id: 't7', type: 'adjustment', reportingCategory: 'fee', net: 225, sourceId: 'py_debit' }),
    bt({ id: 't8', type: 'adjustment', reportingCategory: 'dispute', net: -6_500, sourceId: 'du_card', sourceCharge: 'ch_league' }),
    bt({ id: 't9', type: 'adjustment', reportingCategory: 'dispute_reversal', net: 5_000, sourceId: 'du_card' }),
    bt({ id: 't10', type: 'adjustment', reportingCategory: 'dispute', net: -5_000, sourceId: 'du_bank' }),
    bt({ id: 't11', type: 'stripe_fee', reportingCategory: 'fee', net: -500 }),
    bt({ id: 't12', type: 'charge', reportingCategory: 'charge', net: 4_500, sourceId: 'ch_elsewhere' }),
    bt({ id: 't13', type: 'payout_failure', reportingCategory: 'payout_reversal', net: 91_825 }),
  ], OURS);
  const by = (id: string) => lines.find(l => l.id === id)!;

  it('the payout itself is not a line', () => assert.equal(lines.some(l => l.id === 't0'), false));
  it('a family’s card payment: who, House league · card, receipt, net', () => {
    assert.deepEqual([by('t1').kind, by('t1').who, by('t1').what, by('t1').receiptNo, by('t1').amount],
      ['payment', 'Henry and Lily Grant', 'House league · card', 1084, 300]);
  });
  it('a team’s payment names the tournament and scope', () => assert.equal(by('t2').what, 'Fall Classic balance · card'));
  it('a bank debit (a `payment` line) is named a bank debit', () => assert.equal(by('t3').what, 'House league · bank debit'));
  it('a refund of ours, and one made in Stripe (found by its charge)', () => {
    assert.deepEqual([by('t4').kind, by('t4').who, by('t4').what, by('t4').amount], ['refund', 'Theo Grant', 'Refund to the card', -150]);
    assert.deepEqual([by('t5').kind, by('t5').who], ['refund', 'Riverside Rockets 12U']);
  });
  it('a returned debit, and our fee given back beside it', () => {
    assert.deepEqual([by('t6').kind, by('t6').what, by('t6').receiptNo], ['returned', 'Returned by the bank', 1078]);
    assert.deepEqual([by('t7').kind, by('t7').what, by('t7').amount], ['fee_back', 'Processing fee returned', 2.25]);
  });
  it('a card dispute taken and won, and a bank debit’s dispute', () => {
    assert.deepEqual([by('t8').kind, by('t8').who, by('t8').what, by('t8').amount], ['dispute', 'Henry and Lily Grant', 'Dispute', -65]);
    assert.deepEqual([by('t9').kind, by('t9').what], ['dispute_won', 'Dispute won']);
    assert.deepEqual([by('t10').kind, by('t10').who], ['dispute', 'Maya Singh']);
  });
  it('a Stripe fee, a payment not from us, and a payout that came back are named, never a bare Stripe type', () => {
    assert.deepEqual([by('t11').kind, by('t11').what, by('t11').who], ['stripe_fee', 'Stripe fee', null]);
    assert.deepEqual([by('t12').kind, by('t12').what, by('t12').who, by('t12').receiptNo], ['not_ours', 'Not from FieldLogicHQ', null, null]);
    assert.equal(by('t13').kind, 'payout_back');
    for (const l of lines) assert.doesNotMatch(l.what, /charge|payment_failure|adjustment|stripe_fee|payout_failure/);
  });
  it('the quiet count reads payments and refunds', () => {
    assert.deepEqual(payoutCounts(lines), { payments: 3, refunds: 2 });
    assert.equal(PAYOUTS_LIST_WORDS.counts(9, 1), '9 payments, 1 refund');
    assert.equal(PAYOUTS_LIST_WORDS.counts(1, 0), '1 payment');
  });
});

describe('a payout’s status, reason and contents', () => {
  it('pending and in transit are on their way; failed and canceled didn’t arrive', () => {
    assert.deepEqual(['pending', 'in_transit', 'paid', 'failed', 'canceled'].map(payoutStatus), ['on_its_way', 'on_its_way', 'paid', 'failed', 'failed']);
  });
  it('only mapped failure codes print a reason', () => {
    assert.equal(payoutFailReason('account_closed'), 'closed');
    assert.equal(payoutFailReason('invalid_account_number'), 'invalid');
    assert.equal(payoutFailReason('could_not_process'), null);
  });
  it('a manual payout is never listed; one Stripe is still matching says so', () => {
    assert.equal(payoutContents({ status: 'paid', automatic: false, reconciliationStatus: 'not_applicable' }), 'manual');
    assert.equal(payoutContents({ status: 'paid', automatic: true, reconciliationStatus: 'in_progress' }), 'matching');
    assert.equal(payoutContents({ status: 'paid', automatic: true, reconciliationStatus: 'completed' }), 'listed');
    assert.equal(payoutContents({ status: 'failed', automatic: true, reconciliationStatus: 'completed' }), 'none');
  });
});

describe('Find and the owner’s summary', () => {
  const p = { amount: 1284.5, lines: mapPayoutLines([bt({ id: 'a', type: 'charge', net: 30_000, sourceId: 'ch_league' })], OURS) };
  it('the amount on the bank statement finds the payout, however it is typed', () => {
    for (const q of ['1284.50', '1,284.50', '$1284.5']) assert.equal(payoutMatches(p, q), true, q);
    assert.equal(payoutMatches(p, '999'), false);
  });
  it('a name or a receipt finds the payout that carried it', () => {
    assert.equal(payoutMatches(p, 'lily'), true);
    assert.equal(payoutMatches(p, '1084'), true);
  });
  it('the summary: what’s on its way, and the last paid', () => {
    const sum = payoutsSummary([
      { status: 'on_its_way', amount: 600, arrives: '2026-10-28', sent: '2026-10-27T00:00:00Z' },
      { status: 'paid', amount: 1284.5, arrives: '2026-10-24', sent: '2026-10-23T00:00:00Z' },
    ]);
    assert.deepEqual(sum, { onItsWay: 600, lastPaid: { amount: 1284.5, day: '2026-10-24' } });
    assert.equal(PAYOUTS_LIST_WORDS.card.summary('$600.00', { amount: '$1,284.50', day: 'Oct 24' }), '$600.00 on its way · last paid $1,284.50 on Oct 24');
  });
  it('children are named once by a shared surname', () => {
    assert.equal(childrenWho([{ first: 'Henry', last: 'Grant' }, { first: 'Lily', last: 'Grant' }]), 'Henry and Lily Grant');
    assert.equal(childrenWho([{ first: 'Ava', last: 'Chen' }, { first: 'Theo', last: 'Grant' }]), 'Ava Chen and Theo Grant');
  });
});

describe('the tab and who reads it (ask 5; words §7 question 6)', () => {
  const BASE = '/club/admin';
  it('Payouts is LAST in Accounting’s row, and absent for a club that never connected', () => {
    const tabs = accountingTabs(BASE, { runsRepTeams: true, hasPayouts: true });
    assert.equal(tabs[tabs.length - 1].id, 'payouts');
    assert.equal(tabs[tabs.length - 1].href, '/club/admin/accounting/payouts');
    assert.ok(!accountingTabs(BASE, { runsRepTeams: true }).some(t => t.id === 'payouts'));
  });
  it('the list route only reads, for whoever may see payouts, and is not plan-gated (a wind-down club is still paid out)', () => {
    const src = readCode('app/api/admin/payouts/list/route.ts');
    assert.match(src, /export const GET/);
    assert.doesNotMatch(src, /export const (POST|PATCH|PUT|DELETE)/);
    assert.match(src, /canSeePayouts\(member, ctx\.org\)/);
    assert.doesNotMatch(src, /hasPlanFeature/);
  });
  it('the treasurer is never offered a door that moves money: the one button opens Stripe for the person who set up payouts', () => {
    const route = readCode('app/api/admin/payouts/list/route.ts');
    assert.match(route, /isAnswerer: !!answererId && answererId === ctx\.user\.id && canConnectPayouts\(member\)/);
    const list = readCode('components/admin/kit/club/money/PayoutsList.tsx');
    assert.match(list, /if \(!read\.isAnswerer\) return <span/);
    assert.doesNotMatch(list, /\/refund|RefundWindow|refundToCard|action: '(connect|disconnect|continue)'/);
  });
  it('the page is decided on the server: no payouts (or a cancelled club), no page', () => {
    assert.match(readCode('app/[orgSlug]/admin/accounting/payouts/page.tsx'),
      /if \(!ctx \|\| isOrgBillingSuspended\(ctx\.org\) \|\| !\(await clubHasPayouts\(ctx\.org\.id\)\)\) notFound\(\);/);
  });
});
