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
import { getBillingHref, isTournamentTier } from './billing-urls.ts';

test('Tournament tiers manage billing inside their tournament settings', () => {
  for (const planId of ['tournament', 'tournament_plus']) {
    assert.equal(
      getBillingHref('ravens', planId),
      '/ravens/admin/tournaments/settings/subscription',
      `${planId} must never be routed into /admin/org/*`,
    );
    assert.equal(isTournamentTier(planId), true);
  }
});

test('every other tier manages billing at the org level', () => {
  for (const planId of ['league', 'club', 'team']) {
    assert.equal(getBillingHref('ravens', planId), '/ravens/admin/org/billing');
    assert.equal(isTournamentTier(planId), false);
  }
});

test('an unknown or missing plan falls back to the ORG screen, not the tournament one', () => {
  // Fail-safe direction matters: the org billing screen exists for every org-admin tier, while the
  // tournament subscription route is meaningless off the tournament tiers.
  assert.equal(getBillingHref('ravens', null), '/ravens/admin/org/billing');
  assert.equal(getBillingHref('ravens', undefined), '/ravens/admin/org/billing');
  assert.equal(getBillingHref('ravens', 'some_future_plan'), '/ravens/admin/org/billing');
});
