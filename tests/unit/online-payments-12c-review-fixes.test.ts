import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { CARD_REFUND_WORDS, PRICE_WORDS } from '../../lib/house-league-money-words.ts';
import { LEAGUE_ONLINE_NOTICE_WORDS as LW, ONLINE_NOTICE_WORDS as NW } from '../../lib/online-payment-words.ts';

/**
 * Stage 12c, the /review of 2026-10-26: defects found after the walks, each pinned so it cannot come back.
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

describe('a bank dispute that beats its landing is found by the payment intent, not dropped', () => {
  const src = readCode('lib/online-payment-landing.ts');
  const block = src.slice(src.indexOf('export async function reverseDebit'), src.indexOf('await supabaseAdmin.rpc(\'online_payment_reverse\''));
  it('looks the payment up by charge, then by intent (a clearing debit has no charge yet)', () => {
    assert.match(block, /eq\('stripe_charge_id', chargeId\)/);
    assert.match(block, /eq\('stripe_payment_intent_id', intentId\)/);
  });
  it('retries a debit still on its way, and acknowledges one that never landed in a record', () => {
    assert.match(block, /op\.status === 'open' \|\| op\.status === 'clearing'\) throw/);
    assert.match(block, /console\.error\([^)]*never landed[^)]*\);\s*return;/);
  });
});

describe('"Whose was it?" never books a Stripe refund that failed', () => {
  const route = readCode('app/api/admin/house-league/seasons/[seasonId]/card-refunds/whose/[unassignedId]/route.ts');
  it('a failed or cancelled refund comes off the list instead of being booked', () => {
    assert.match(route, /stripe\.status === 'failed' \|\| stripe\.status === 'canceled'[\s\S]*?\.delete\(\)[\s\S]*?W\.errFailed/);
    assert.ok(route.indexOf("stripe.status === 'failed'") < route.indexOf('recordLeagueRefundRows('), 'checked before anything is recorded');
    assert.match(CARD_REFUND_WORDS.whose.errFailed, /no money moved/);
  });
  it('the refund event takes a held refund off the list when it fails', () => {
    const src = readCode('lib/online-payment-landing.ts');
    assert.match(src, /online_refunds_unassigned'\)\.delete\(\)\.eq\('stripe_refund_id', refund\.id\)\.is\('assigned_at', null\)/);
  });
  it('a child named twice is one pick, so the limit is checked on all of it and nothing is left in no book', () => {
    assert.match(route, /merged\.set\(child\.regId, \{ child, cents: \(had\?\.cents \?\? 0\) \+ cents \}\)/);
  });
});

describe('the notices say which rail the money came by, and the dates are the org\'s day', () => {
  it('a bank debit that couldn\'t be recorded is a bank debit refunded to the bank account', () => {
    assert.match(NW.notRecordedBody('U11 · deposit', '$100', 'x', true), /paid by bank debit[\s\S]*Refund it to the bank account/);
    assert.match(NW.notRecordedBody('U11 · deposit', '$100', 'x'), /paid by card[\s\S]*Refund it to the card/);
    assert.equal(LW.unrecordedTitle('Henry Grant', true), 'A bank debit for Henry Grant couldn’t be recorded');
    assert.equal(LW.unrecordedTitle('Henry Grant'), 'A card payment for Henry Grant couldn’t be recorded');
    assert.match(LW.unrecordedBody('Pat', '$150', null, 'Henry', 'x', true), /by bank debit[\s\S]*Refund it to the bank account/);
    assert.match(LW.unrecordedSignupBody('Fall', '$150', 'x', true), /by bank debit[\s\S]*bank account/);
    assert.doesNotMatch(LW.unrecordedSignupTitleBank, /card/i);
  });
  it('no customer-visible date is made by slicing a timestamp\'s UTC day (an evening reads a day late)', () => {
    const land = readCode('lib/online-payment-landing.ts');
    assert.doesNotMatch(land, /formatStoredDate\([^)]*\.slice\(0, 10\)/);
    assert.doesNotMatch(readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx'), /payLinkSentAt\.slice\(0, 10\)/);
  });
  it('the house-league refund email dates the refund by Stripe\'s own time, not the day we heard of it', () => {
    const src = readCode('lib/online-refund-email.ts');
    assert.match(src, /r\.stripe_created_at \?\? r\.created_at/);
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
