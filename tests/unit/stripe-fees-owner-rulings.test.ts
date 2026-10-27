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

describe('ruling 2:a cancelled club is still billed, and sees its Stripe fees list', () => {
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
    assert.match(sweep, /\.eq\('status', 'returned'\)\.eq\('livemode', live\)\.gte\('returned_at', since\)/);
    assert.match(sweep, /for \(const id of returnedIds\) if \(!recorded\.has\(id\)\) await recordReturnedDebitFee\(id\);/);
  });
});

describe('ruling 5: one "Email the pay link" after a lost card dispute warns, never skips; the bulk send still skips', () => {
  const RECEIPT = readCode('lib/online-payment-receipt.ts');

  it('house league: the bulk send skips the family; one send asks, and goes when the desk says so', () => {
    const league = /export async function sendLeaguePayLink[\s\S]*?\n}\n/.exec(RECEIPT)?.[0] ?? '';
    assert.match(league, /if \(opts\.bulk && lost\) return \{ error: DISPUTE_WORDS\.bulkWhy, disputeLost: 'skipped' \};/);
    assert.match(league, /if \(lost && !opts\.despiteLostDispute\) return \{ error: DISPUTE_WORDS\.sendAnywayBody\(false\), disputeLost: 'ask' \};/);
    // Asked only once nothing else refuses: a send that can't go never asks first.
    assert.ok(league.indexOf("disputeLost: 'ask'") > league.indexOf('if (!payLink)'), 'after every refusal');
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(route, /despiteLostDispute: body\.despiteLostDispute === true/);
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
    assert.match(team, /if \(!opts\.despiteLostDispute && await teamLostDispute\(teamId\)\) return \{ error: DISPUTE_WORDS\.sendAnywayBody\(true\), disputeLost: 'ask' \};/);
    assert.ok(team.indexOf("disputeLost: 'ask'") > team.indexOf('if (!payLink)'), 'after every refusal');
    const lost = /async function teamLostDispute[\s\S]*?\n}\n/.exec(RECEIPT)?.[0] ?? '';
    assert.match(lost, /\.eq\('status', 'lost'\)\.not\('lost_booked_at', 'is', null\)\.is\('won_back_at', null\)/, 'as the reminders read it');
    const pay = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx');
    assert.match(pay, /if \(error && data\.code === 'dispute_lost_ask'\) \{ setLinkAnyway\(true\); return; \}/);
    assert.match(pay, /<PayLinkAnywayWindow onClose=\{\(\) => setLinkAnyway\(false\)\} send=\{async \(\) => \{ setLinkAnyway\(false\); await emailPayLink\(true\); \}\} \/>/);
    assert.match(readCode('app/api/admin/tournaments/[tournamentId]/registrations/payment-reminders/route.ts'), /!lostTeams\.has\(team\.id\)/);
  });
});
