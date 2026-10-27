import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * CLUB TIER STAGE 12d-1 PART 5b: THE OWNER'S RULINGS OF 2026-10-27 ON PART 4'S ASKS (plan §0, "Owner rulings on Part 4's
 * asks and the /review's calls"). Each describe is one ruling, by its number.
 */
const FEES = 'lib/platform-stripe-fees.ts';

describe('the club’s own invoice stamps its fees billed (found building ruling 6)', () => {
  it('a line id is never written to a fee before its billed date (`platform_stripe_fees_billed_chk` refuses it)', () => {
    const src = readCode(FEES);
    const done = /async function completeInvoice[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    // The stamp carries the line id, the date and how, together, after the finalize; each write's error is read.
    assert.match(done, /\.update\(\{ stripe_invoice_item_id: itemId, billed_at: billedAt, billed_on: 'own_invoice', bill_error: null \}\)/);
    assert.match(done, /if \(stampError\) throw stampError;/);
    // No update anywhere writes a line id alone.
    assert.doesNotMatch(src, /update\(\{ stripe_invoice_item_id: [a-zA-Z.]+ \}\)/);
  });
});

describe('ruling 2: a cancelled club is still billed, and sees its Stripe fees list', () => {
  it('the list’s read is off the billing rail, and stays the owner’s', () => {
    const route = readCode('app/api/billing/stripe-fees/route.ts');
    assert.match(route, /getAuthContextWithRole\(\{ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true \}\)/);
    assert.match(route, /if \(ctx\.role !== 'owner'\) return forbidden\(\);/);
  });

  it('both Plan & billing pages show it on their cancelled view, not only the live one', () => {
    const kit = readCode('components/admin/kit/club/BillingKit.tsx');
    const cancelled = /if \(cancelled\) \{[\s\S]*?\n  \}\n/.exec(kit)?.[0] ?? '';
    assert.match(cancelled, /<StripeFeesList slug=\{slug\} \/>/, 'Club plans: under the reactivate card');
    const page = readCode('app/[orgSlug]/admin/org/billing/page.tsx');
    const canceledView = /if \(status === 'canceled'\) \{[\s\S]*?\n  \}\n/.exec(page)?.[0] ?? '';
    assert.match(canceledView, /canManageBilling && <StripeFeesList slug=\{currentOrg\.slug\} \/>/, 'every other plan');
  });

  it('the monthly invoice never asks whether the club is cancelled (no reprieve)', () => {
    assert.doesNotMatch(readCode(FEES), /subscription_status|subscriptionStatus|isOrgBillingSuspended/);
  });
});

describe('ruling 3: a returned debit is billed at Stripe\'s own figure, nothing when Stripe charged nothing', () => {
  it('the debit\'s charge is read from Stripe\'s session (a returned debit never lands, so no charge is stored)', () => {
    const returned = /export async function recordReturnedDebitFee[\s\S]*?\n}\n/.exec(readCode(FEES))?.[0] ?? '';
    assert.match(returned, /op\.status !== 'returned'/);
    assert.match(returned, /retrieveCheckout\(op\.stripe_account_id as string, op\.stripe_checkout_session_id as string\)/);
    assert.match(returned, /\.filter\(isStripeFee\)\.reduce\(\(s, t\) => s - t\.amount, 0\)/, 'a fee Stripe gave back nets off');
  });

  it('the daily job reads a returned debit again until its fee is found (Stripe can post it later), never once found', () => {
    const sweep = /export async function sweepDisputeFees[\s\S]*?\n}\n/.exec(readCode(FEES))?.[0] ?? '';
    assert.match(sweep, /\.eq\('status', 'returned'\)\.eq\('livemode', live\)\.gte\('returned_at', twoWeeks\)/);
    assert.match(sweep, /for \(const id of returnedIds\) if \(!recorded\.has\(id\)\) await recordReturnedDebitFee\(id\);/);
  });
});

describe('ruling 6: a fee left pending on a subscription that can no longer carry it goes to the club’s own invoice, once', () => {
  const release = /export async function releaseStrandedSubscriptionFees[\s\S]*?\n}\n/.exec(readCode(FEES))?.[0] ?? '';

  it('a line already on an invoice, or still on a subscription that rides, is left alone', () => {
    assert.match(release, /\.eq\('billed_on', 'subscription'\)\.eq\('livemode', LIVE_KEY\(\)\)\.gte\('billed_at', since\)/);
    assert.match(release, /if \(before\?\.invoice\) continue;/);
    // Stripe names the subscription on a pending line it was created on (test-mode probe 2026-10-27); a line it didn't
    // name is left alone while the club rides one.
    assert.match(release, /if \(ride && \(!on \|\| on === ride\.subscription\)\) continue;/);
    assert.match(release, /\.order\('billed_at', \{ ascending: true \}\)/, 'oldest first: a yearly line is never pushed off');
  });

  it('read before and after: deleted from Stripe, read again, and only then returned to unbilled (never billed twice)', () => {
    const del = release.indexOf('invoiceItems.del(itemId)');
    const again = release.indexOf('if (await readInvoiceItem(itemId)) continue;');
    const back = release.indexOf('.update({ stripe_invoice_item_id: null, billed_at: null, billed_on: null, bill_error: null })');
    assert.ok(del > 0 && again > del && back > again, 'delete, read again, then unbill');
    // The unbill is a compare-and-set on the very line it deleted, and clears the three columns the table ties together.
    assert.match(release, /\.eq\('id', f\.id\)\.eq\('billed_on', 'subscription'\)\.eq\('stripe_invoice_item_id', itemId\)/);
  });

  it('the daily job runs it before the monthly invoice, which then bills the fee on the club’s own invoice', () => {
    const daily = readCode('app/api/platform-admin/stripe-fees-daily/route.ts');
    const stranded = daily.indexOf("run('stranded_fees'");
    assert.ok(stranded > 0 && stranded < daily.indexOf("run('monthly_invoices'"));
    // A fee put back on a NEW subscription within Stripe's 24 hours is never handed the deleted line back.
    assert.match(readCode(FEES), /idempotencyKey: `stripe-fee:\$\{f\.id\}:\$\{ride\.subscription\}`/);
  });
});

describe('ruling 5: one "Email the pay link" after a lost card dispute warns, never skips; the bulk send still skips', () => {
  const RECEIPT = readCode('lib/online-payment-receipt.ts');

  it('house league: the bulk send skips the family; one send asks, and goes when the desk says so', () => {
    const league = /export async function sendLeaguePayLink[\s\S]*?\n}\n/.exec(RECEIPT)?.[0] ?? '';
    assert.match(league, /if \(opts\.bulk && lost\) return \{ error: DISPUTE_WORDS\.bulkWhy, disputeLost: 'skipped' \};/);
    assert.match(league, /if \(lost && opts\.askIfLost\) return \{ error: DISPUTE_WORDS\.sendAnywayBody\(false\), disputeLost: 'ask' \};/);
    // Asked only once nothing else refuses: a send that can't go never asks first.
    assert.ok(league.indexOf("disputeLost: 'ask'") > league.indexOf('if (!payLink)'), 'after every refusal');
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(route, /askIfLost: body\.bulk !== true && body\.despiteLostDispute !== true/);
    // The refund's "Email the pay link" answer and the price-raise email never ask (each is already the desk's choice).
    assert.equal((route.match(/sendLeaguePayLink\(/g) ?? []).length, 3);
    assert.equal((route.match(/askIfLost/g) ?? []).length, 1, 'only the desk’s own button asks');
    assert.match(route, /sent\.disputeLost === 'ask' \? 'dispute_lost_ask'/);
    const screen = readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx');
    assert.match(screen, /if \(!r\.ok && r\.code === 'dispute_lost_ask'\) \{ setAct\(\{ kind: 'payLinkAnyway', reg \}\); return; \}/);
    assert.match(screen, /await payLinkOne\(reg, true\)/);
    // The bulk loop never sends the "anyway" flag.
    const bulk = /async function runBulkPayLink[\s\S]*?\n  }\n/.exec(screen)?.[0] ?? '';
    assert.doesNotMatch(bulk, /despiteLostDispute/);
  });

  it('a tournament team: the reminders skip it; one send asks first, the same way', () => {
    const team = /export async function sendTeamPayLink[\s\S]*?\n}\n/.exec(RECEIPT)?.[0] ?? '';
    assert.match(team, /if \(opts\.askIfLost && await teamLostDispute\(teamId\)\) return \{ error: DISPUTE_WORDS\.sendAnywayBody\(true\), disputeLost: 'ask' \};/);
    assert.ok(team.indexOf("disputeLost: 'ask'") > team.indexOf('if (!payLink)'), 'after every refusal');
    const lost = /async function teamLostDispute[\s\S]*?\n}\n/.exec(RECEIPT)?.[0] ?? '';
    assert.match(lost, /\.eq\('status', 'lost'\)\.not\('lost_booked_at', 'is', null\)\.is\('won_back_at', null\)/, 'as the reminders read it');
    const pay = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx');
    assert.match(pay, /if \(error && data\.code === 'dispute_lost_ask'\) \{ setLinkAnyway\(true\); return; \}/);
    assert.match(pay, /<PayLinkAnywayWindow onClose=\{\(\) => setLinkAnyway\(false\)\} send=\{async \(\) => \{ setLinkAnyway\(false\); await emailPayLink\(true\); \}\} \/>/);
    assert.match(readCode('app/api/admin/tournaments/[tournamentId]/registrations/payment-reminders/route.ts'), /!lostTeams\.has\(team\.id\)/);
  });
});

describe('ruling 7: a returned answering fee goes back against the invoice that carried the answering fee', () => {
  const src = readCode(FEES);
  const credit = /async function billCredit[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
  const against = /async function creditAgainst[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';

  it('every credit is billed through it, and looks up its own answering fee by the dispute', () => {
    assert.match(src, /if \(isFeeCredit\(f\.kind\)\) return await billCredit\(f\);/);
    assert.match(credit, /\.eq\('dispute_id', f\.dispute_id \?\? ''\)\.eq\('kind', 'dispute_answer'\)/);
  });

  it('the answering fee still to come: the credit waits with it, or rides beside it on the same subscription, and they net', () => {
    assert.match(credit, /if \(!answer\.billed_at \|\| !answer\.stripe_invoice_item_id\) return waitWithIt\(\);/);
    assert.match(credit, /if \(!ride \|\| line\.parent\?\.subscription_details\?\.subscription !== ride\.subscription\) return waitWithIt\(\);/);
    // A subscription's next invoice still a draft takes the credit as a line, never a credit note.
    assert.match(against, /if \(inv\.status === 'draft'\) \{[\s\S]*?invoice: invoiceId, amount: signedCents\(f\)/);
  });

  it('on a finished invoice: a credit note on THAT invoice, owed first, then refunded to the card, never waiting for a later fee', () => {
    assert.match(credit, /return creditAgainst\(f, answer, inv\.stripe_invoice_id as string\);/, 'the club’s own invoice');
    assert.match(credit, /return creditAgainst\(f, answer, typeof line\.invoice === 'string' \? line\.invoice : line\.invoice\.id!\);/, 'a subscription’s invoice');
    assert.match(against, /const owed = inv\.status === 'paid' \? 0 : Math\.max\(0, inv\.amount_remaining\);/);
    assert.match(against, /const refund = Math\.min\(after, Math\.max\(0, inv\.amount_paid\)\);/);
    assert.match(against, /if \(refund > 0\) params\.refund_amount = refund;/);
    assert.match(against, /email_type: 'none'/, 'Stripe’s own email is off; the list says it');
    assert.match(against, /invoice_line_item: carried\.id, amount: cents/, 'against the answering fee’s own line');
  });

  it('once only: read back by its metadata, created under a key, stored on the row (unique, mig 399)', () => {
    assert.ok(against.indexOf('creditNotes.list(') > 0 && against.indexOf('creditNotes.list(') < against.indexOf('creditNotes.create('), 'read back first');
    assert.match(against, /idempotencyKey: `fee-credit:\$\{f\.id\}`/);
    assert.match(against, /\.update\(\{ stripe_credit_note_id: note\.id, billed_at: new Date\(\)\.toISOString\(\), billed_on: 'credit_note', bill_error: null \}\)/);
    const mig = readCode('supabase/migrations/399_a_returned_answering_fee_is_a_credit_note.sql');
    assert.match(mig, /CREATE UNIQUE INDEX IF NOT EXISTS platform_stripe_fees_credit_note_key/);
    assert.match(mig, /billed_on IN \('subscription', 'own_invoice', 'credit_note'\)/);
  });

  it('the Plan & billing list reads it as returned on its day, never "next 1st"', () => {
    assert.match(src, /else if \(f\.billed_on === 'credit_note'\) state = 'returned';/);
    assert.match(src, /invoiceDay: state === 'returned' \? f\.billed_at/);
    assert.match(readCode('components/admin/kit/club/StripeFeesList.tsx'), /case 'returned': return W\.billedReturned\(short\(f\.invoiceDay\)\);/);
  });
});

describe('the /review of Part 5b', () => {
  const src = readCode(FEES);
  it('a credit beside its answering fee on a subscription reads back before it is made (no second line after Stripe’s 24 hours)', () => {
    const credit = /async function billCredit[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.doesNotMatch(credit, /invoiceItems\.create\(/, 'only through subscriptionLine');
    assert.match(credit, /await subscriptionLine\(f, ride\);/);
  });

  it('a credit note is never made for a credit the club’s own invoice claimed meanwhile; its stamp is a compare-and-set on both', () => {
    const against = /async function creditAgainst[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.ok(against.indexOf("if (!now || now.billed_at || now.fee_invoice_id) return 'done';") < against.indexOf('creditNotes.create('));
    assert.match(against, /\.eq\('id', f\.id\)\.is\('billed_at', null\)\.is\('fee_invoice_id', null\);/);
  });

  it('a credit is tried again daily, error or not; a runner that lost a race writes no error on a billed fee', () => {
    const retry = /export async function retryFailedFees[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.match(retry, /\.eq\('kind', 'dispute_answer_returned'\)\.is\('billed_at', null\)/);
    const bill = /export async function billFee[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.match(bill, /bill_attempts: \(f\.bill_attempts \?\? 0\) \+ 1 \}\)\.eq\('id', f\.id\)\.is\('billed_at', null\);/);
  });

  it('a credit with no answering fee of ours is billed as before, never stuck', () => {
    const credit = /async function billCredit[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.doesNotMatch(credit, /throw new Error\('The answering fee it returns was never billed\.'\)/);
    assert.match(credit, /if \(!answer \|\| answer\.exempt_reason\) \{[\s\S]*?await subscriptionLine\(f, ride\);/);
  });
});
