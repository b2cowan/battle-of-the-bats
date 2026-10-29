/**
 * Unit tests for `getBillingHref` — "where does this org manage its plan?".
 *
 * WHY THIS EXISTS: Tournament and Tournament Plus orgs have no org-admin concept and are redirected
 * out of `/admin/org/*`; their billing lives under the tournament settings instead. The rule was
 * untested, and the top-nav repair (R4, 2026-08-01) added a SECOND consumer of it — the marketing
 * pricing page's viewer-aware CTAs, which now deep-link a signed-in operator to their own billing
 * screen. The first cut of that feature hardcoded the org path and would have handed the largest
 * tier a door it cannot open. Anyone tempted to hand-write the path again should fail here first.
 *
 * Runs on Node's built-in runner:  `node --test lib/billing-urls.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billingUrlOrgFromRow, getBillingHref, isTournamentTier } from './billing-urls.ts';
import { teamWorkspaceReactivatePath } from './coaches-portal-routes.ts';

test('Tournament tiers manage billing inside their tournament settings', () => {
  for (const planId of ['tournament', 'tournament_plus']) {
    assert.equal(
      getBillingHref({ slug: 'ravens', planId }),
      '/ravens/admin/tournaments/settings/subscription',
      `${planId} must never be routed into /admin/org/*`,
    );
    assert.equal(isTournamentTier(planId), true);
  }
});

test('every other tier manages billing at the org level', () => {
  for (const planId of ['league', 'club', 'club_large']) {
    assert.equal(getBillingHref({ slug: 'ravens', planId }), '/ravens/admin/org/billing');
    assert.equal(isTournamentTier(planId), false);
  }
});

test('an unknown or missing plan falls back to the ORG screen, not the tournament one', () => {
  // Fail-safe direction matters: the org billing screen exists for every org-admin tier, while the
  // tournament subscription route is meaningless off the tournament tiers.
  assert.equal(getBillingHref({ slug: 'ravens', planId: null }), '/ravens/admin/org/billing');
  assert.equal(getBillingHref({ slug: 'ravens' }), '/ravens/admin/org/billing');
  assert.equal(getBillingHref({ slug: 'ravens', planId: 'some_future_plan' }), '/ravens/admin/org/billing');
});

test('a standalone workspace uses the coach host, including when a grant changed its effective plan', () => {
  for (const org of [
    { slug: 'ravens', planId: 'team' },
    { slug: 'ravens', planId: 'league', accountKind: 'team_workspace' },
  ]) {
    for (const subscriptionStatus of ['active', 'trialing', 'past_due', null]) {
      assert.equal(getBillingHref({ ...org, subscriptionStatus }), '/ravens/coaches/billing');
    }
    const cancelled = { ...org, name: 'Ravens Coaches Portal', subscriptionStatus: 'canceled' };
    assert.equal(getBillingHref(cancelled), teamWorkspaceReactivatePath(cancelled));
    assert.equal(getBillingHref(cancelled, { purpose: 'return' }), '/ravens/coaches/billing');
    assert.equal(getBillingHref(cancelled, { host: 'admin' }), '/ravens/admin/org/billing');
  }
});

test('the explicit host lets an admin surface retain its own chrome', () => {
  assert.equal(getBillingHref({ slug: 'ravens', planId: 'team' }, { host: 'admin' }), '/ravens/admin/org/billing');
  assert.equal(getBillingHref({ slug: 'ravens', planId: 'tournament' }, { host: 'coach' }), '/ravens/coaches/billing');
  assert.equal(getBillingHref({ slug: 'ravens', planId: 'tournament' }, { host: 'admin' }), '/ravens/admin/tournaments/settings/subscription');
});

test('a database row maps to the resolver input, and a status override describes the state about to be written', () => {
  const row = { slug: 'ravens', plan_id: 'team', account_kind: 'team_workspace', subscription_status: 'active', name: 'Ravens Coaches Portal' };
  assert.deepEqual(billingUrlOrgFromRow(row), {
    slug: 'ravens', planId: 'team', accountKind: 'team_workspace', subscriptionStatus: 'active', name: 'Ravens Coaches Portal',
  });
  assert.equal(billingUrlOrgFromRow(row, 'canceled').subscriptionStatus, 'canceled');
  assert.equal(getBillingHref(billingUrlOrgFromRow(row)), '/ravens/coaches/billing');
});
