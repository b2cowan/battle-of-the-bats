import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { refundBlockFoot, refundBlockHtml, refundBlockRows, type RefundBlockInput } from '../../lib/online-refund-block.ts';

/**
 * Club Tier Stage 12c Part 3 — ONE refund block in every refund email, both flows (plan §0g ruling 3; words
 * CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §4). "On" is the refund's own date, never the day the email went (F3).
 */
const base: RefundBlockInput = {
  refundCents: 15675, bank: false, cardBrand: 'visa', cardLast4: '4242', bankLast4: null,
  refundedAt: '2026-10-27T02:30:00Z', reference: 're_3Pq', receiptNo: 1052, paidOn: '2026-10-20',
  feeBackCents: 675, feeKeptCents: 0,
};

describe('the refund block (12c words §4)', () => {
  it('one child: Refunded · To · On · Refund reference · Your receipt, in that order', () => {
    assert.deepEqual(refundBlockRows(base), [
      ['Refunded', '$156.75'],
      ['To', 'Visa •••• 4242'],
      // 02:30 UTC on the 27th is the evening of the 26th in Toronto: the club's day, not the server's.
      ['On', 'Oct 26, 2026'],
      ['Refund reference', 're_3Pq'],
      ['Your receipt', '1052 (paid Oct 20, 2026)'],
    ]);
  });
  it('a payment for two or more children names each child with their part', () => {
    const rows = refundBlockRows({ ...base, refundCents: 31200, children: [{ name: 'Theo Grant', cents: 15000 }, { name: 'Lily Grant', cents: 15000 }] });
    assert.deepEqual(rows.filter(r => r[0] === 'For'), [['For', 'Theo Grant · $150.00'], ['For', 'Lily Grant · $150.00']]);
    assert.equal(refundBlockRows({ ...base, children: [{ name: 'Theo Grant', cents: 15000 }] }).some(r => r[0] === 'For'), false, 'one child is never listed');
  });
  it('a bank account, and the time it takes to appear, by rail', () => {
    const bank = { ...base, bank: true, bankLast4: '6789' };
    assert.deepEqual(refundBlockRows(bank).find(r => r[0] === 'To'), ['To', 'Bank account ending 6789']);
    assert.equal(refundBlockFoot(bank).at(-1), 'It takes about 3 business days to appear.');
    assert.equal(refundBlockFoot(base).at(-1), 'It takes 5 to 10 business days to appear.');
  });
  it('the processing fee: included when it went back, named as not part of it while the family paid it, silent otherwise', () => {
    assert.equal(refundBlockFoot(base)[0], 'This includes the $6.75 processing fee.');
    assert.equal(refundBlockFoot({ ...base, feeBackCents: 0, feeKeptCents: 675 })[0], 'The $6.75 processing fee isn’t part of this refund.');
    assert.equal(refundBlockFoot({ ...base, feeBackCents: 0, feeKeptCents: 0 }).length, 1, 'the club paid the fee: no fee line');
  });
  it('escapes what it prints', () => {
    assert.ok(!refundBlockHtml({ ...base, reference: '<b>x</b>' }).includes('<b>x</b>'));
  });
  it('no refund email dates the refund by the send (the F3 class): the tournament email reads the refund row', () => {
    const src = readCode('lib/online-payment-receipt.ts');
    const fn = /export async function sendRefundEmail[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.ok(fn.includes('refundedAt: r.created_at'), 'the block is dated by the refund row');
    assert.ok(!/new Date\(\)/.test(fn), 'no "now" inside the refund email');
  });
});
