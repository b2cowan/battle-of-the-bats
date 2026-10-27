import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCode } from './_source-code.ts';
import { bankReturnReason } from '../../lib/bank-debit.ts';
import { payOptions } from '../../lib/team-pay-options.ts';
import { onlineFee } from '../../lib/online-payment-fee.ts';
import { FOREIGN_CARD_EXTRA_BPS, ONLINE_PAYMENT_RATES } from '../../lib/plan-config.ts';
import { refusalMessage } from '../../lib/team-pay-refusal.ts';
import { BANK_REASON_WORDS, reasonFull, reasonShort } from '../../lib/online-payment-words.ts';

/**
 * Club Tier Stage 12c Part 5 — bank debit, the family and the team (plan §0i–§0k; words
 * CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md §2). The rates are read from ONLINE_PAYMENT_RATES, never restated.
 */

const fee = { depositAmount: 100, totalFeeAmount: 400, depositDueDate: '2026-11-01', totalFeeDueDate: '2026-12-01' } as never;
const refusal = { teamName: 'Riverside Rockets', teamStatus: 'accepted', totalPaid: 0, org: { name: 'Riverdale Minor Ball' }, tournament: { name: 'Fall Classic' } };

describe('the bank\'s reason (words §2.3)', () => {
  it('maps each bank code the words know, and prints none for anything else', () => {
    assert.equal(bankReturnReason('insufficient_funds'), 'insufficient_funds');
    assert.equal(bankReturnReason('account_closed'), 'account_closed');
    assert.equal(bankReturnReason('no_account'), 'invalid_account');
    assert.equal(bankReturnReason('incorrect_account_details'), 'invalid_account');
    assert.equal(bankReturnReason('debit_not_authorized'), 'not_authorized');
    assert.equal(bankReturnReason('bank_cannot_process'), null);
    assert.equal(bankReturnReason(null), null);
    assert.equal(reasonFull(null), '');
    assert.equal(reasonShort('something_new'), '');
  });

  it('every reason the mapper can give has its two forms of words, and the database allows exactly those four', () => {
    for (const r of ['insufficient_funds', 'account_closed', 'invalid_account', 'not_authorized']) {
      assert.ok(BANK_REASON_WORDS[r]?.full.startsWith(': '), r);
      assert.ok(BANK_REASON_WORDS[r]?.short, r);
    }
    const mig = readCode('supabase/migrations/382_a_team_refund_can_be_part_and_a_debit_clears.sql');
    assert.match(mig, /p_reason NOT IN \('insufficient_funds', 'account_closed', 'invalid_account', 'not_authorized'\)/);
  });
});

describe('a fee per rail (words §2.1, §2.5)', () => {
  it('the bank button carries its own fee at the bank rate; the card is unchanged', () => {
    const o = payOptions({ totalPaid: null, depositPaid: null }, fee, 'family', true)!;
    const full = o.choices.find(c => c.scope === 'full')!;
    assert.deepEqual(full.fee, onlineFee(40_000, 'family', 'card'));
    assert.deepEqual(full.bankFee, onlineFee(40_000, 'family', 'bankDebit'));
    assert.equal(full.bankFee!.pctBps, ONLINE_PAYMENT_RATES.bankDebit.pctBps);
    assert.notEqual(full.bankFee!.totalCents, full.fee.totalCents);
  });

  it('no bank fee while the club\'s account does not take bank debit', () => {
    const o = payOptions({ totalPaid: null, depositPaid: null }, fee, 'family')!;
    assert.ok(o.choices.every(c => c.bankFee === null));
    assert.equal(o.savingBankCents, null);
  });

  it('the bank saving is the bank fees of deposit + balance less the bank fee of the whole, only while the family pays it', () => {
    const o = payOptions({ totalPaid: null, depositPaid: null }, fee, 'family', true)!;
    const want = onlineFee(10_000, 'family', 'bankDebit').feeCents + onlineFee(30_000, 'family', 'bankDebit').feeCents
      - onlineFee(40_000, 'family', 'bankDebit').feeCents;
    assert.equal(o.savingBankCents, want > 0 ? want : null);
    const club = payOptions({ totalPaid: null, depositPaid: null }, fee, 'club', true)!;
    assert.equal(club.savingBankCents, null);
    // The club pays: both buttons read the base amount.
    assert.equal(club.choices[0].bankFee!.totalCents, club.choices[0].fee.totalCents);
  });
});

describe('no second payment while a debit clears (ask 6)', () => {
  it('the team\'s refusal names the team and the club', () => {
    const m = refusalMessage({ ...refusal, refusal: 'clearing' })!;
    assert.match(m, /Riverside Rockets/);
    assert.match(m, /Riverdale Minor Ball will email you when it clears/);
  });

  it('both pay routes refuse a completed-but-unpaid page (a debit clearing) and compare the rail before reusing a page', () => {
    for (const f of ['app/api/pay/team/[token]/route.ts', 'app/api/pay/league/[token]/route.ts']) {
      const src = readCode(f);
      assert.match(src, /session\.payment_status === 'unpaid' \? B\.errorClearing/, f);
      assert.match(src, /\(open\.rail \?\? 'card'\) === rail/, f);
    }
  });

  it('the house league leaves a child on a clearing debit out of the total, and refuses only when every child owing is clearing', () => {
    const src = readCode('lib/league-pay-facts.ts');
    assert.match(src, /owingCents: clearing \? 0 : due, clearingCents: clearing \? due : 0/);
    assert.match(src, /if \(children\.some\(c => c\.clearingCents > 0\)\) refusal = 'clearing'/);
  });
});

describe('the webhook and the landing (§0k)', () => {
  it('"completed" unpaid records clearing; async success lands; async failure returns it', () => {
    const hook = readCode('app/api/payments/connect-webhook/route.ts');
    assert.match(hook, /case 'checkout\.session\.async_payment_failed':[\s\S]*?returnDebit\(account/);
    assert.doesNotMatch(hook, /if \(session\.payment_status === 'paid'\) await landCheckoutSession/);
    const land = readCode('lib/online-payment-landing.ts');
    assert.match(land, /if \(bank && session\.status === 'complete'\) \{ await startClearing\(op\.id, card\); return 'clearing'; \}/);
    // A debit that settles before its "completed" arrived is recorded clearing first, without a "started" email.
    assert.match(land, /if \(bank && op\.status === 'open'\) await startClearing\(op\.id, card, false\)/);
    // Each email once: only the database's first move answers true.
    assert.match(land, /if \(moved === true && tell\) await sendDebitStartedEmail/);
    assert.match(land, /if \(moved === true\) \{\s*await sendDebitReturnedEmail/);
  });

  it('a bank debit is booked the day it clears, never the day it started (review 2026-10-26)', () => {
    const land = readCode('lib/online-payment-landing.ts');
    assert.match(land, /const paidAt = bank\s*\? new Date\(\)\.toISOString\(\)/);
  });

  it('a "failed" event is checked against Stripe: a failed read is redelivered, a debit Stripe says is paid lands', () => {
    const land = readCode('lib/online-payment-landing.ts');
    const ret = /export async function returnDebit[\s\S]*?\n}\n/.exec(land)?.[0] ?? '';
    assert.doesNotMatch(ret, /retrieveCheckout\([^)]*\)\.catch/);
    assert.match(ret, /if \(session\.payment_status === 'paid'\) \{ await landCheckoutSession/);
    // A missed "failed" event is caught on any later read of the session.
    assert.match(land, /if \(bank && session\.status === 'complete' && debitFailed\(session\)\) \{ await markReturned/);
  });

  it('an overdue clearing debit is asked of Stripe when its page is read, and never breaks the page', () => {
    const src = readCode('lib/bank-debit-overdue.ts');
    assert.match(src, /\.eq\('status', 'clearing'\)\.lt\('clearing_at', cutoff\)/);
    assert.match(src, /DEBIT_OVERDUE_DAYS/);
    assert.match(src, /catch \(err\)/);
    for (const f of ['lib/team-pay-view.ts', 'lib/league-pay-view.ts']) {
      assert.match(readCode(f), /import\('\.\/bank-debit-overdue'\)\)\.settleOverdueDebits/, f);
    }
  });

  it('Part 6: a reversal is a bank-debit dispute only, and tells the family, the desk and the club\'s bill once', () => {
    const hook = readCode('app/api/payments/connect-webhook/route.ts');
    assert.match(hook, /case 'charge\.dispute\.created':[\s\S]*?reverseDebit\(account/);
    const land = readCode('lib/online-payment-landing.ts');
    const rev = /export async function reverseDebit[\s\S]*?\n}\n/.exec(land)?.[0] ?? '';
    assert.match(rev, /op\.rail !== 'bank_debit'/, 'a card dispute is 12d\'s');
    // A redelivery never emails the family twice, but still owes the desk's notice and the fee (each once-only).
    assert.match(rev, /if \(!\(res as \{ already\?: boolean \} \| null\)\?\.already\) await sendDebitReversedEmail\(op\.id as string\);\s*await afterDebitBack\(op\.id as string, 'reversed', dispute\.id\);/);
    // A dispute before its debit landed is retried, never consumed (found by the payment intent when there is no charge yet —
    // review 2026-10-26); one whose landing failed has nothing to retry for and is acknowledged.
    assert.match(rev, /if \(!op\.landed_at\) \{[\s\S]*?op\.status === 'open' \|\| op\.status === 'clearing'\) throw new Error/);
    // A return while clearing: the notice, the fee, and any decision stamped returned (nothing was taken).
    assert.match(land, /await sendDebitReturnedEmail\(opId\);\s*await afterDebitBack\(opId, 'returned'\)/);
    const after = /async function afterDebitBack[\s\S]*?\n}\n/.exec(land)?.[0] ?? '';
    assert.match(after, /outcome: 'returned'/);
    // A return's fee is Stripe's own figure on its charge (12d-1 ruling 3); a reversal's on the dispute (ruling 5).
    assert.match(after, /if \(kind === 'returned'\) await recordReturnedDebitFee\(op\.id\);/);
    assert.match(after, /else if \(stripeDisputeId\) await recordDisputeFees\(\{[^}]*rail: 'bank_debit'/);
  });

  it('Part 6: a decision made while it cleared is carried out once, from the database, after each landing', () => {
    const land = readCode('lib/online-payment-landing.ts');
    const carry = /async function carryOutDecisions[\s\S]*?\n}\n/.exec(land)?.[0] ?? '';
    assert.match(carry, /\.update\(\{ outcome: 'sent_back', outcome_at: now \}\)\s*\.eq\('id', d\.id\)\.is\('outcome', null\)\.select\('id'\)\.maybeSingle\(\)/,
      'the decision is claimed before Stripe is asked');
    assert.match(carry, /if \(!item\?\.entry_id\) continue;/, 'only a share in the book is sent back');
    // Both landings, and the already-landed replay (review 2026-10-26: a crash after the commit left an answer waiting).
    assert.equal((land.match(/await carryOutDecisions\(op\.id\)/g) ?? []).length, 3, 'both flows, and the replay');
  });

  it('Part 6 (12d-1 ruling 3): a returned debit\'s fee is what Stripe charged, and every club is billed it, comped and free included', () => {
    const fee = readCode('lib/platform-stripe-fees.ts');
    const returned = /export async function recordReturnedDebitFee[\s\S]*?\n}\n/.exec(fee)?.[0] ?? '';
    // Read from the platform's balance by the debit's charge, as a reversal is by its dispute; never a typed figure.
    assert.match(returned, /stripe\.balanceTransactions\.list\(\{ source: chargeId, limit: 100 \}\)/);
    assert.match(returned, /kind: 'returned', amountCents: charged, source: 'stripe'/);
    // Nothing when Stripe charged nothing: the one recorder writes no row for a zero.
    assert.match(fee, /if \(!\(p\.amountCents > 0\)\) return;/);
    assert.doesNotMatch(fee, /amount: \d|\b5\.00\b|RETURNED_BANK_DEBIT_FEE_CENTS/, 'no figure decides a bill');
    // Owner 2026-10-26: a comp covers the subscription only. No comped or no-subscription exemption is written any more.
    assert.doesNotMatch(fee, /exempt_reason: '(comped|no_subscription)'|exempt\('comped'\)/);
    assert.doesNotMatch(fee, /subscription_status/, 'never the stored status (plan-reader door guard)');
    assert.match(fee, /invoiceItems\.create\(\{[\s\S]*?subscription: ride\.subscription/);
    assert.match(fee, /idempotencyKey: `stripe-fee:\$\{f\.id\}:\$\{ride\.subscription\}`/);
  });

  it('12d-1 Part 4: the foreign-card rate matches the Facts doc, its canonical record', () => {
    const facts = readFileSync(join(import.meta.dirname, '..', '..', 'docs/agents/strategy/PLAN_PRICING_FACTS.md'), 'utf8');
    const m = /a card issued outside the club's country[^.]*?\+(\d+(?:\.\d+)?)% of the charge/i.exec(facts);
    assert.ok(m, 'the Facts doc names the rate');
    assert.equal(Math.round(Number(m![1]) * 100), FOREIGN_CARD_EXTRA_BPS);
  });

  it('12d-1 ruling 3: no constant bills a returned debit, and the Facts doc, its canonical record, says Stripe\'s own figure', () => {
    assert.doesNotMatch(readCode('lib/plan-config.ts'), /RETURNED_BANK_DEBIT_FEE_CENTS/);
    // Plain text, not readCode: the doc is prose, and its apostrophes would read as strings.
    const facts = readFileSync(join(import.meta.dirname, '..', '..', 'docs/agents/strategy/PLAN_PRICING_FACTS.md'), 'utf8');
    assert.match(facts, /A \*\*returned\*\* or \*\*reversed\*\* bank debit is billed at Stripe's own figure/);
    assert.doesNotMatch(facts, /a \*\*returned\*\* one at this CA\$5\.00/);
  });

  it('the status routes reload the page for a clearing or returned debit', () => {
    for (const f of ['app/api/pay/team/[token]/status/route.ts', 'app/api/pay/league/[token]/status/route.ts']) {
      const src = readCode(f);
      assert.match(src, /'clearing', 'returned', 'reversed'\]\.includes\(op\.status/, f);
      assert.match(src, /result === 'clearing' \|\| result === 'returned'/, f);
    }
  });
});
