import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { notesPaidBackCents, unexplainedRefunds, type SaleNoteRecord } from '../../lib/console-money-sales.ts';
import type { MoneyRefund } from '../../lib/console-money.ts';
import { settleLooks } from '../../lib/console-money-looks.ts';
import type { NeedsLookRecord } from '../../lib/console-money-needs-look.ts';
import { readCode } from './_source-code.ts';

/**
 * GST/HST Stage 3 Part 5 (owner 2026-11-07, check 7 tightened): what a sale's credit notes explain of its refunds. ONE measure (the
 * issued notes' `refund_cents`) and ONE order (console refunds first, then the oldest) for check 7, the band and the window's
 * "no credit note" clause.
 */

const note = (over: Partial<Pick<SaleNoteRecord, 'status' | 'refund_cents'>> = {}) => ({ status: 'issued' as const, refund_cents: 0, ...over });
const refund = (id: string, amountCents: number, createdAt: string, over: Partial<MoneyRefund> = {}): MoneyRefund =>
  ({ id, amountCents, createdAt, status: 'succeeded', ourRefundId: null, ...over });

describe('what the notes paid back', () => {
  it('sums the issued notes only: a void note pays nothing back', () => {
    assert.equal(notesPaidBackCents([note({ refund_cents: 2000 }), note({ refund_cents: 1500 }), note({ status: 'void', refund_cents: 9000 })]), 3500);
  });
  it('a balance-credit or before-payment note (refund_cents 0) explains no refund', () => {
    assert.equal(notesPaidBackCents([note(), note()]), 0);
  });
});

describe('which refunds no note explains', () => {
  const dashA = refund('re_a', 2000, '2026-10-01T10:00:00.000Z');
  const dashB = refund('re_b', 3000, '2026-10-02T10:00:00.000Z');
  const ours = refund('re_o', 1000, '2026-10-03T10:00:00.000Z', { ourRefundId: 'rf_1' });
  const ids = (refunds: MoneyRefund[], paid: number) =>
    unexplainedRefunds(refunds, paid).filter(u => u.cents > 0).map(u => `${u.refund.id}:${u.cents}`);

  it('the console refund is explained first, then the oldest dashboard refund', () => {
    assert.deepEqual(ids([dashB, dashA, ours], 3000), ['re_b:3000'], 'ours 1000 + re_a 2000 covered; re_b is not');
  });
  it('a note smaller than a refund leaves the rest of that refund unexplained', () => {
    assert.deepEqual(ids([dashA], 500), ['re_a:1500']);
  });
  it('nothing paid back: every counted refund is unexplained; failed and canceled refunds are not counted', () => {
    assert.deepEqual(ids([dashA, refund('re_f', 700, '2026-10-04T10:00:00.000Z', { status: 'failed' }), refund('re_c', 800, '2026-10-05T10:00:00.000Z', { status: 'canceled' })], 0), ['re_a:2000']);
  });
  it('the band and the window read this one helper (they cannot disagree)', () => {
    const sales = readCode('lib/console-money-sales.ts');
    assert.match(sales, /function refundItems[\s\S]*?unexplainedRefunds\(refunds, explained\)/);
    const tab = readCode('app/platform-admin/orgs/[id]/MoneyTab.tsx');
    assert.match(tab, /unexplainedRefunds\(refundsSoFar, notesPaidBackCents\(/);
    assert.match(tab, /!ours && noNoteIds\.has\(r\.id\)/, 'the clause sits on an unexplained dashboard refund only');
    const store = readCode('lib/console-money-sales-store.ts');
    assert.match(store, /notesPaidBackCents\(/, "check 7's per-sale figure is the same measure");
  });
});

describe('check 7 through the one rule (settleLooks)', () => {
  const rec = (id: string, refunded: number): NeedsLookRecord => ({
    stripe_invoice_id: id, issued_at: '2026-10-14T10:00:00.000Z', status: 'paid', currency: 'cad', gst_hst_position: 'taxed', gst_hst_position_why: null,
    tax_lines: [], review_reason: null, review_note: null, evidence_missing: false, evidence_country: 'CA', evidence_region: 'ON', refunded_cents: refunded,
  });
  it('a partly explained refund stays listed, a fully explained one leaves, and one sale\'s notes never clear another\'s', () => {
    const out = settleLooks([rec('in_1', 5000), rec('in_2', 5000), rec('in_3', 5000)],
      { registration: '2026-09-26', refunded: new Map([['in_1', 2000], ['in_2', 5000]]) }, new Map());
    assert.deepEqual(out.standing.map(r => r.stripe_invoice_id), ['in_1', 'in_3']);
    assert.match(out.reasons.in_1[0].text, /^refunded \$30\.00 /);
    assert.match(out.reasons.in_3[0].text, /^refunded \$50\.00 /);
  });
});
