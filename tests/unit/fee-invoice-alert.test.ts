import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FEE_ALERT_WORDS, FEE_INVOICE_OWED_STATUS, canSeeFeesOwed, feeAlertFor, feesOwedFrom,
} from '../../lib/fee-invoice-alert.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { readCode } from './_source-code.ts';

const NOW = new Date('2026-12-05T12:00:00Z');

/**
 * FEE INVOICE ALERTS · PART 2 — the signal's data and the pill (FEE_INVOICE_ALERTS_PART2_BUILD_PROMPT.md).
 * Owner rulings 2026-11-05: Ask 3 (amber open, red overdue), Ask 6 (owner only), Ask 7 (a failed plan payment is an amber pill,
 * no fetch); words accepted the same day; tournament-only owners are read too; only `open` is owed.
 */
describe('the words', () => {
  it('the accepted spoken labels, with plurals', () => {
    assert.equal(FEE_ALERT_WORDS.toPay(1), '1 invoice to pay');
    assert.equal(FEE_ALERT_WORDS.toPay(2), '2 invoices to pay');
    assert.equal(FEE_ALERT_WORDS.overdue(1), '1 invoice overdue');
    assert.equal(FEE_ALERT_WORDS.overdue(3), '3 invoices overdue');
    assert.equal(FEE_ALERT_WORDS.planPaymentFailed, 'Plan payment didn’t go through');
  });
  it('are the Plan & billing vocabulary\'s own (one source)', () => {
    assert.strictEqual(W.feeAlert, FEE_ALERT_WORDS);
  });
});

describe('who gets the figure (Ask 6)', () => {
  it('the owner does; a treasurer or admin without the billing capability does not; nobody does not', () => {
    assert.equal(canSeeFeesOwed('owner', null), true);
    assert.equal(canSeeFeesOwed('admin', null), false);
    assert.equal(canSeeFeesOwed('treasurer' as never, null), false);
    assert.equal(canSeeFeesOwed(null, null), false);
  });
  it('the brief route sends it only behind that gate, and absent (not zero) otherwise', () => {
    const route = readCode('app/api/admin/club-brief/route.ts');
    assert.match(route, /if \(canSeeFeesOwed\(ctx\.role, ctx\.capabilities\)\)/);
    assert.match(route, /\.\.\.\(feesOwed \? \{ feesOwed \} : \{\}\)/);
    assert.doesNotMatch(route, /feesOwed:\s*\{\s*count:\s*0/);
  });
  it('the read is one query: this org, this Stripe mode, open rows, no Stripe call', () => {
    const read = readCode('lib/fee-invoices-owed.ts');
    assert.match(read, /\.from\('platform_fee_invoices'\)/);
    assert.match(read, /\.eq\('org_id', orgId\)/);
    assert.match(read, /\.eq\('livemode', stripeKeyIsLive\(\)\)/);
    assert.match(read, /\.eq\('status', FEE_INVOICE_OWED_STATUS\)/);
    assert.doesNotMatch(read, /stripe\.|new Stripe|getStripe/i);
    assert.equal(FEE_INVOICE_OWED_STATUS, 'open');
  });
});

describe('the rows become a count and an overdue count', () => {
  it('overdue = a due date already past; a missing or future date is merely open', () => {
    assert.deepEqual(feesOwedFrom([], NOW), { count: 0, overdue: 0 });
    assert.deepEqual(feesOwedFrom([{ due_at: '2026-12-01T11:15:11Z' }], NOW), { count: 1, overdue: 1 });
    assert.deepEqual(feesOwedFrom([{ due_at: '2026-12-09T11:15:11Z' }], NOW), { count: 1, overdue: 0 });
    assert.deepEqual(feesOwedFrom([{ due_at: null }, { due_at: '2026-12-01T00:00:00Z' }], NOW), { count: 2, overdue: 1 });
  });
  it('due exactly now is not yet overdue; an unreadable date is open, never overdue', () => {
    assert.deepEqual(feesOwedFrom([{ due_at: NOW.toISOString() }], NOW), { count: 1, overdue: 0 });
    assert.deepEqual(feesOwedFrom([{ due_at: 'not a date' }], NOW), { count: 1, overdue: 0 });
  });
});

describe('the pill', () => {
  it('nothing owed and no failed payment: no pill', () => {
    assert.equal(feeAlertFor(undefined, false), null);
    assert.equal(feeAlertFor({ count: 0, overdue: 0 }, false), null);
  });
  it('an open invoice is amber and says what to do', () => {
    assert.deepEqual(feeAlertFor({ count: 1, overdue: 0 }, false), { count: 1, tone: 'amber', label: '1 invoice to pay' });
    assert.deepEqual(feeAlertFor({ count: 2, overdue: 0 }, false), { count: 2, tone: 'amber', label: '2 invoices to pay' });
  });
  it('an overdue invoice turns it red; the number is the overdue ones, so figure, colour and words agree', () => {
    assert.deepEqual(feeAlertFor({ count: 1, overdue: 1 }, false), { count: 1, tone: 'red', label: '1 invoice overdue' });
    assert.deepEqual(feeAlertFor({ count: 3, overdue: 2 }, false), { count: 2, tone: 'red', label: '2 invoices overdue' });
  });
  it('a failed plan payment alone is amber "1" with its own words (Ask 7)', () => {
    assert.deepEqual(feeAlertFor(undefined, true), { count: 1, tone: 'amber', label: 'Plan payment didn’t go through' });
  });
  it('a failed plan payment never cools an overdue invoice, and both are spoken', () => {
    assert.deepEqual(feeAlertFor({ count: 1, overdue: 1 }, true), { count: 2, tone: 'red', label: '1 invoice overdue, Plan payment didn’t go through' });
    assert.deepEqual(feeAlertFor({ count: 1, overdue: 0 }, true), { count: 2, tone: 'amber', label: '1 invoice to pay, Plan payment didn’t go through' });
  });
});

describe('where the pill is worn', () => {
  it('the rail foot wears it inside the billing door and the nav guard\'s pinned text is untouched', () => {
    const rail = readCode('components/admin/kit/AdminKitRail.tsx');
    assert.match(rail, /feeAlert && <WaitingCount count=\{feeAlert\.count\} label=\{feeAlert\.label\} tone=\{feeAlert\.tone\}/);
    const hook = readCode('components/admin/kit/useAdminKitNav.ts');
    assert.match(hook, /const billingLink = kitBillingLink\(\{ orgSlug, planId: currentOrg\?\.planId, accountKind: currentOrg\?\.accountKind, role: userRole, capabilities: userCapabilities, isSandbox \}\)/);
  });
  it('the hook shows it to the billing door\'s owner only and reads the plan status from the org (no fetch)', () => {
    const hook = readCode('components/admin/kit/useFeeAlert.ts');
    assert.match(hook, /if \(!billingLink\) return null/);
    assert.match(hook, /subscriptionStatus === 'past_due'/);
    assert.doesNotMatch(hook, /fetch\(/);
  });
  it('the phone: More\'s pill carries the fee count, its spoken label no longer says an invoice is unread, and the sheet row wears it too', () => {
    const bar = readCode('components/admin/kit/AdminKitBottomNav.tsx');
    assert.match(bar, /const moreBadge = moreUnread \+ \(feeAlert\?\.count \?\? 0\)/);
    assert.doesNotMatch(bar, /`More, \$\{badge\(moreBadge\)\} unread`/);
    assert.match(bar, /aria-label=\{!moreOpen && moreBadge > 0 \? moreLabel : undefined\}/);
    assert.match(bar, /\{feeAlert && <span className=\{`\$\{styles\.dropCount\} \$\{feeTone\}`\} aria-label=\{feeAlert\.label\}>/);
  });
  it('the provider keeps the read on for a tournament-only workspace\'s owner, and only for them', () => {
    const provider = readCode('components/admin/kit/club/ClubBriefProvider.tsx');
    assert.match(provider, /!isTournamentOnlyWorkspace\(currentOrg\) \|\| hasBillingAccess\(userRole, userCapabilities\)/);
  });
});
