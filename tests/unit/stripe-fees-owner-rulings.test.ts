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
