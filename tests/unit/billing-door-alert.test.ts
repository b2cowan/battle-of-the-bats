import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BILLING_DOOR_ALERT_WORDS, billingDoorAlertFor } from '../../lib/billing-door-alert.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { readCode } from './_source-code.ts';

/**
 * THE PILL ON THE PLAN & BILLING DOOR — a plan payment that didn't go through is an amber "1", with no fetch (owner ruling
 * 2026-11-05, Ask 7 of "Fee invoice alerts"). Stripe-owned pricing Stage 4 (2026-11-18) retired the other half of the pill — the
 * monthly invoice for Stripe's fees, amber while open and red once overdue — with the invoice itself; what is left is always
 * amber and always one. (Renamed from fee-invoice-alert.test.ts.)
 */
describe('the words', () => {
  it('the accepted spoken label', () => {
    assert.equal(BILLING_DOOR_ALERT_WORDS.planPaymentFailed, 'Plan payment didn’t go through');
  });
  it('are the Plan & billing vocabulary\'s own (one source)', () => {
    assert.strictEqual(W.billingDoorAlert, BILLING_DOOR_ALERT_WORDS);
  });
});

describe('the pill', () => {
  it('no failed plan payment: no pill', () => {
    assert.equal(billingDoorAlertFor(false), null);
  });
  it('a failed plan payment is amber "1" with its own words (Ask 7)', () => {
    assert.deepEqual(billingDoorAlertFor(true), { count: 1, tone: 'amber', label: 'Plan payment didn’t go through' });
  });
  it('there is no red and no fee-invoice count left on the pill or the brief', () => {
    const code = readCode('lib/billing-door-alert.ts');
    assert.doesNotMatch(code, /'red'|overdue|feesOwed|platform_fee_invoices/);
    assert.doesNotMatch(readCode('app/api/admin/club-brief/route.ts'), /feesOwed/);
  });
});

describe('where the pill is worn', () => {
  it('the rail foot wears it inside the billing door and the nav guard\'s pinned text is untouched', () => {
    const rail = readCode('components/admin/kit/AdminKitRail.tsx');
    assert.match(rail, /billingAlert && <WaitingCount count=\{billingAlert\.count\} label=\{billingAlert\.label\} tone=\{billingAlert\.tone\}/);
    const hook = readCode('components/admin/kit/useAdminKitNav.ts');
    assert.match(hook, /const billingLink = kitBillingLink\(\{ orgSlug, planId: currentOrg\?\.planId, accountKind: currentOrg\?\.accountKind, role: userRole, capabilities: userCapabilities \}\)/);
  });
  it('the hook shows it to the billing door\'s owner only and reads the plan status from the org (no fetch)', () => {
    const hook = readCode('components/admin/kit/useBillingDoorAlert.ts');
    assert.match(hook, /if \(!billingLink\) return null/);
    assert.match(hook, /subscriptionStatus === 'past_due'/);
    assert.doesNotMatch(hook, /fetch\(/);
  });
  it('the phone: More\'s pill carries the count, its spoken label no longer says an invoice is unread, and the sheet row wears it too', () => {
    const bar = readCode('components/admin/kit/AdminKitBottomNav.tsx');
    // Owner 2026-11-05: while the billing signal exists the pill is ONLY its count (unread never inflates it).
    assert.match(bar, /const moreBadge = billingAlert \? billingAlert\.count : moreUnread/);
    assert.match(bar, /moreUnread > 0 \? \[`\$\{badge\(moreUnread\)\} unread`\] : \[\]/);
    assert.doesNotMatch(bar, /`More, \$\{badge\(moreBadge\)\} unread`/);
    assert.match(bar, /aria-label=\{!moreOpen && moreBadge > 0 \? moreLabel : undefined\}/);
    assert.match(bar, /\{billingAlert && <span className=\{`\$\{styles\.dropCount\} \$\{billingTone\}`\} aria-label=\{billingAlert\.label\}>/);
    assert.match(readCode('components/coaches/CoachesBottomNav.module.css'), /\.billingAmber/);
  });
  it('the provider keeps the read on for a tournament-only workspace\'s owner, and only for them', () => {
    const provider = readCode('components/admin/kit/club/ClubBriefProvider.tsx');
    assert.match(provider, /!isTournamentOnlyWorkspace\(currentOrg\) \|\| hasBillingAccess\(userRole, userCapabilities\)/);
  });
});
