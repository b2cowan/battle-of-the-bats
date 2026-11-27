/**
 * The sponsor's page when money is owing AGAIN (owner 2026-11-27, all A): the sum from the invoice total, the fee said only
 * when the whole invoice is owed, no sum when the lines would not add up, and the words on the page and in the club's window.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { owingAgain as owingAgainOf, type DealPayment, type DealRefund } from '../../lib/club-sponsor-invoice.ts';
import { DEAL_WORDS } from '../../lib/club-sponsorship-deal-words.ts';

const pay = (p: Partial<DealPayment>): DealPayment => ({
  id: 'p1', amount: 1176.39, taxPart: 135.34, receivedOn: '2026-11-26', method: 'card', reference: null, note: null,
  recordedByName: 'x', recordedAt: '2026-11-26T12:00:00Z', voided: null, returned: true, card: null, ...p,
});
const refund = (r: Partial<DealRefund>): DealRefund => ({
  id: 'r1', paymentId: 'p1', amount: 1176.39, status: 'succeeded', refundedOn: '2026-11-26', createdAt: '2026-11-26T13:00:00Z', ...r,
} as DealRefund);
const withFee = { total: 1176.39, cardFee: 41.05, cardFeeTax: 5.34 };
const owingAgain = (...a: [Parameters<typeof owingAgainOf>[0], DealPayment[], DealRefund[], number, boolean?]) =>
  owingAgainOf(a[0], a[1], a[2], a[3], a[4] ?? false);

describe('owingAgain', () => {
  it('a whole refund, fee included: the lines add up and the fee is said', () => {
    const o = owingAgain(withFee, [pay({})], [refund({})], 1176.39)!;
    assert.equal(o.cause, 'refund');
    assert.deepEqual(o.rows!.map(r => [r.kind, r.amount]), [['paid', 1176.39], ['refunded', 1176.39]]);
    assert.deepEqual(o.fee, { amount: 46.39, taxed: true });
  });
  it('cheque and card, the card refunded: adds up, no fee line', () => {
    const o = owingAgain({ total: 1130 }, [
      pay({ id: 'c', amount: 500, receivedOn: '2026-11-03', method: 'cheque', returned: false }),
      pay({ amount: 630, receivedOn: '2026-11-10' }),
    ], [refund({ amount: 630 })], 630)!;
    assert.deepEqual(o.rows!.map(r => r.kind), ['paid', 'paid', 'refunded']);
    assert.equal(o.fee, null);
  });
  it('a lost dispute: the reversal puts the amount back and carries no day', () => {
    const o = owingAgain(withFee, [pay({ disputeLost: true })], [], 1176.39)!;
    assert.equal(o.cause, 'reversal');
    assert.deepEqual(o.rows!.at(-1), { kind: 'reversed', amount: 1176.39, on: null });
  });
  it('no sum when the lines would not add up: refunded and then reversed, a part refund on a payment that counts, one on its way', () => {
    const twice = owingAgain(withFee, [pay({ disputeLost: true })], [refund({ amount: 100 })], 1176.39)!;
    const part = owingAgain({ total: 1130 }, [pay({ amount: 630, returned: false })], [refund({ amount: 100 })], 500)!;
    const onWay = owingAgain(withFee, [pay({})], [refund({}), refund({ id: 'r2', status: 'pending', amount: 1 })], 1176.39)!;
    for (const o of [twice, part, onWay]) assert.deepEqual([o.cause, o.rows, o.fee], ['other', null, null]);
  });
  it('a revised invoice says no fee: the revision keeps the old fee figure though the new total does not include it', () => {
    assert.equal(owingAgain(withFee, [pay({})], [refund({})], 1176.39, true)!.fee, null);
  });
  it('names no cause when it cannot: a voided payment, or a refund and a reversal together', () => {
    const voided = pay({ id: 'c', method: 'cheque', returned: false, voided: { at: '2026-11-27T00:00:00Z', byName: 'x', reason: 'bounced' } });
    assert.equal(owingAgain(withFee, [pay({ disputeLost: true }), voided], [], 1176.39)!.cause, 'other');
    const both = owingAgain(withFee, [pay({ disputeLost: true }), pay({ id: 'p2' })], [refund({ paymentId: 'p2' })], 1176.39)!;
    assert.equal(both.cause, 'other');
  });
  it('null when nothing was refunded or reversed, or nothing is owing', () => {
    assert.equal(owingAgain({ total: 1130 }, [pay({ amount: 500, method: 'cheque', returned: false })], [], 630), null);
    assert.equal(owingAgain(withFee, [pay({})], [refund({ status: 'pending' })], 1176.39), null);
    assert.equal(owingAgain(withFee, [pay({ returned: false })], [refund({ amount: 10 })], 0), null);
  });
});

describe('the words', () => {
  const P = DEAL_WORDS.page;
  it('the page names the club and never blames the sponsor', () => {
    assert.equal(P.owingTitle(1176.39), '$1,176.39 still owing');
    assert.equal(P.owingSubRefund('Dev Club Org', 1), 'Dev Club Org shows this invoice as still owing after the refund.');
    assert.equal(P.owingSubReversal('Dev Club Org'), 'Dev Club Org shows this invoice as still owing after the card payment was reversed. Questions? Contact Dev Club Org before you pay.');
    assert.equal(P.owingFeeRefund(46.39, true), 'Still owing includes the $46.39 processing fee (tax included) from your refunded card payment.');
    assert.equal(P.refundPolicyOf('Dev Club Org'), 'Dev Club Org’s refund policy');
  });
  it('the club’s window names the amount and the fee only when the invoice carries one', () => {
    const sub = DEAL_WORDS.card.choiceOwingSub;
    assert.match(sub(true, { total: 1176.39, fee: 46.39 }), /full invoice, \$1,176\.39, which includes the \$46\.39 processing fee$/);
    assert.equal(sub(false, { total: 1176.39, fee: 46.39 }), 'The deal reads owing again and their link lets them pay $1,176.39, which includes the $46.39 processing fee');
    assert.equal(sub(false, null), 'The deal reads owing again and their link lets them pay');
  });
});
