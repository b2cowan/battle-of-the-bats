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
  refundedAt: '2026-10-27T02:30:00Z', receiptNo: 1052, paidOn: '2026-10-20',
  feeBackCents: 675, feeKeptCents: 0,
};

describe('the refund block (12c words §4)', () => {
  it('one child: Refunded · To · On · Your receipt, in that order (no Stripe refund code: owner 2026-11-24, O-S6)', () => {
    assert.deepEqual(refundBlockRows(base), [
      ['Refunded', '$156.75'],
      ['To', 'Visa •••• 4242'],
      // 02:30 UTC on the 27th is the evening of the 26th in Toronto: the club's day, not the server's.
      ['On', 'Oct 26, 2026'],
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
    assert.equal(refundBlockFoot(base).at(-1), 'It can take 5 to 10 business days to appear, depending on the card company.');
  });
  it('the processing fee: included when it went back, named as not part of it while the family paid it, silent otherwise', () => {
    assert.equal(refundBlockFoot(base)[0], 'This includes the $6.75 processing fee.');
    assert.equal(refundBlockFoot({ ...base, feeBackCents: 0, feeKeptCents: 675 })[0], 'The $6.75 processing fee isn’t part of this refund.');
    assert.equal(refundBlockFoot({ ...base, feeBackCents: 0, feeKeptCents: 0 }).length, 1, 'the club paid the fee: no fee line');
  });
  it('escapes what it prints, and prints no Stripe refund code however a caller is written', () => {
    assert.ok(!refundBlockHtml({ ...base, children: [{ name: '<b>x</b>', cents: 100 }, { name: 'Ana', cents: 100 }] }).includes('<b>x</b>'));
    assert.ok(!refundBlockHtml(base).includes('re_'));
    assert.ok(!('reference' in base));
  });
  it('no refund email dates the refund by the send (the F3 class): the tournament email reads the refund row', () => {
    const src = readCode('lib/online-payment-receipt.ts');
    const fn = /export async function sendRefundEmail[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.ok(/refundedAt: \(\(r\.stripe_created_at as string \| null\) \?\? r\.created_at\)/.test(fn), 'the block is dated by the refund (Stripe’s moment, else the row)');
    assert.ok(!/new Date\(\)/.test(fn), 'no "now" inside the refund email');
  });
});
