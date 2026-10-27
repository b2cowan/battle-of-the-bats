import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { PRICE_WORDS } from '../../lib/house-league-money-words.ts';

/**
 * Stage 12c, the /review of 2026-10-26: four defects found after the walks, each pinned so it cannot come back.
 */
describe('a part refund Stripe refused is not a refund to record "another way"', () => {
  const route = readCode('app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts');
  it('the route refuses it, rather than falling through to "All of it"', () => {
    const at = route.indexOf("body.action === 'refund_another_way'");
    const block = route.slice(at, route.indexOf('const reason = body.reason', at));
    assert.match(block, /last\.part_refund && last\.booked_at/, 'a booked part refund is still marked done');
    assert.match(block, /if \(last\.part_refund\) return json\(\{ error: [^)]*\}, 409\)/, 'an unbooked one is refused');
    assert.ok(block.indexOf('if (last.part_refund) return') > block.indexOf('last.part_refund && last.booked_at'),
      'the refusal comes after the booked branch, so a booked part refund is not refused');
  });
  it('the listing does not count it as the latest refund (no failed chip, no "another way" menu item)', () => {
    const src = readCode('lib/team-payments-server.ts');
    assert.match(src, /r\.status === 'failed' && r\.part_refund && !r\.booked_at\) continue;\s*if \(!latest\.has/);
  });
});

describe('a price correction for a child who paid by bank debit goes back to the bank account', () => {
  const src = readCode('components/admin/kit/club/league/registrations/PriceWindow.tsx');
  it('a bank-paid child counts as an online payment, so the refund choice is offered', () => {
    assert.match(src, /l\.method === 'online_card' \|\| l\.method === 'online_bank'/);
  });
  it('and it is worded for the bank account, never the card', () => {
    assert.match(src, /toBank \? PRICE_WORDS\.hintLowerBank/);
    assert.match(src, /toBank \? PRICE_WORDS\.lowerBankChoice/);
    assert.match(src, /toBank \? PRICE_WORDS\.doneLowerBank/);
    assert.equal(PRICE_WORDS.lowerBankChoice('$25'), 'Refund $25 to the bank account');
    assert.equal(PRICE_WORDS.doneLowerBank('Henry', '$125', '$25'), 'Henry’s price is now $125. Refunded $25 to the bank account.');
    assert.doesNotMatch(PRICE_WORDS.hintLowerBank('Henry', '$150', '$25'), /\bcard\b/i);
  });
});

describe('a replayed landing finishes what a crash left', () => {
  const src = readCode('lib/online-payment-landing.ts');
  it('an already-landed payment still carries out its stored answers and sends its receipt', () => {
    const at = src.indexOf('if (op.landed_at) {');
    const block = src.slice(at, src.indexOf("return 'already';", at));
    assert.match(block, /await carryOutDecisions\(op\.id\)/);
    assert.match(block, /await sendOnlineReceiptOnce\(op\.id\)/);
  });
});

describe('an answer saved while a debit clears is settled if the debit moved meanwhile', () => {
  it('the team route settles the answer after saving it', () => {
    const route = readCode('app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts');
    const at = route.indexOf("body.action === 'clear_decision'");
    const block = route.slice(at, route.indexOf("body.action === 'refund'", at));
    assert.ok(block.indexOf('.insert({') < block.indexOf('settleDecisionAfterSave(op.id)'), 'settled AFTER the insert');
  });
  it('a landed debit has its answer carried out, a returned one stamps it, a clearing one is left to the landing', () => {
    const src = readCode('lib/online-payment-landing.ts');
    const at = src.indexOf('export async function settleDecisionAfterSave');
    const block = src.slice(at, src.indexOf('\n}\n', at));
    assert.match(block, /op\.status === 'clearing'\) return/);
    assert.match(block, /op\.status === 'returned'[\s\S]*outcome: 'returned'/);
    assert.match(block, /op\.landed_at\) await carryOutDecisions/);
  });
});
