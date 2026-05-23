/**
 * UAT Suite: Plan Gating
 *
 * Verifies that plan-locked features are correctly gated in the UI:
 * - Free (tournament) plan sees upgrade prompts on plus-only features
 * - Plus-only features are accessible on tournament_plus/league/club
 * - Module gates (house league, rep teams, accounting) work correctly
 *
 * These tests run as org-owner (has full org permissions; plan is the only gate).
 * The test org's plan tier is set via UAT_ORG_PLAN env var (defaults to 'tournament').
 *
 * NOTE: To test plan-gating boundaries you need at least one org on 'tournament' plan.
 * To test plus-feature access you need a second org on 'tournament_plus' or above.
 * Use UAT_ORG_SLUG (free plan) and UAT_PLUS_ORG_SLUG (plus plan) env vars.
 */

import { test, expect } from '../helpers/fixtures';

const PLUS_ORG_SLUG = process.env.UAT_PLUS_ORG_SLUG ?? process.env.UAT_ORG_SLUG!;

// ── Free-plan gates ──────────────────────────────────────────────────────────

test.describe('Plan gating / free plan (tournament tier)', () => {
  test('schedule page loads on free plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/schedule`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    // Page should render — even if some features are locked
    await expect(ownerPage.locator('main, [class*="main"]').first()).toBeVisible();
  });

  test('registrations page loads on free plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/teams`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main, [class*="main"]').first()).toBeVisible();
  });

  test('auto-schedule is gated on free plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/schedule`);
    // Look for an upgrade prompt, locked badge, or disabled auto-schedule control
    const gateIndicators = ownerPage.locator(
      '[class*="locked"], [class*="upgrade"], [class*="gate"], [class*="upsell"], [data-locked="true"]'
    );
    await expect(gateIndicators.first()).toBeVisible({ timeout: 8_000 });
  });

  test('PDF export is gated on free plan', async ({ ownerPage, orgSlug }) => {
    // Navigate to a page with export controls (registrations or results)
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/teams`);
    // PDF option should either be absent or show a locked state
    const pdfLockedOrAbsent = ownerPage.locator(
      '[class*="locked"][aria-label*="pdf" i], [data-feature="pdf_exports"], [class*="upgrade"]:has-text("PDF")'
    );
    // Either present as locked, or genuinely absent from the DOM on free plan
    const count = await pdfLockedOrAbsent.count();
    const isLocked = count > 0;
    const pdfButton = ownerPage.locator('button:has-text("PDF"), [role="menuitem"]:has-text("PDF")');
    const pdfCount = await pdfButton.count();
    // If a PDF button exists, it must be disabled or show a gate
    if (pdfCount > 0) {
      const isDisabled = await pdfButton.first().isDisabled();
      expect(isDisabled || isLocked).toBe(true);
    }
    // If neither locked indicator nor button exists, that's also acceptable (feature hidden entirely)
  });

  test('billing page is accessible to owner on any plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/org/billing`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main, h1, h2').first()).toBeVisible();
  });
});

// ── Tournament Plus feature access ───────────────────────────────────────────

test.describe('Plan gating / tournament_plus features', () => {
  test('results page loads on plus org', async ({ ownerPage }) => {
    await ownerPage.goto(`/${PLUS_ORG_SLUG}/admin/tournaments/results`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main, [class*="main"]').first()).toBeVisible();
  });

  test('communication page loads on plus org', async ({ ownerPage }) => {
    await ownerPage.goto(`/${PLUS_ORG_SLUG}/admin/tournaments/communication`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible();
  });

  test('branding page loads on plus org', async ({ ownerPage }) => {
    await ownerPage.goto(`/${PLUS_ORG_SLUG}/admin/tournaments/branding`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible();
  });
});

// ── Module gates ─────────────────────────────────────────────────────────────

test.describe('Plan gating / module access', () => {
  test('house-league route is inaccessible on tournament plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/house-league`);
    // Should redirect away OR render an upgrade/locked state — NOT a blank 200
    const url = ownerPage.url();
    const hasGateContent = await ownerPage.locator(
      '[class*="locked"], [class*="upgrade"], [class*="gate"], h1:has-text("upgrade"), h1:has-text("locked")'
    ).count();
    const isRedirected = !url.includes('/house-league');
    expect(isRedirected || hasGateContent > 0).toBe(true);
  });

  test('accounting route is inaccessible on tournament plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/accounting`);
    const hasGateContent = await ownerPage.locator(
      '[class*="locked"], [class*="upgrade"], [class*="gate"]'
    ).count();
    const isRedirected = !ownerPage.url().includes('/accounting');
    expect(isRedirected || hasGateContent > 0).toBe(true);
  });

  test('rep-teams route is inaccessible on tournament plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/rep-teams`);
    const hasGateContent = await ownerPage.locator(
      '[class*="locked"], [class*="upgrade"], [class*="gate"]'
    ).count();
    const isRedirected = !ownerPage.url().includes('/rep-teams');
    expect(isRedirected || hasGateContent > 0).toBe(true);
  });
});

// ── Admin role vs owner role ─────────────────────────────────────────────────

test.describe('Plan gating / role-based capability', () => {
  test('org-admin cannot access billing page', async ({ adminPage, orgSlug }) => {
    await adminPage.goto(`/${orgSlug}/admin/org/billing`);
    // Billing is owner-only — should redirect or show forbidden
    const url = adminPage.url();
    const hasForbidden = await adminPage.locator(
      'text=forbidden, text=access denied, text=not authorized, [class*="forbidden"]'
    ).count();
    const isRedirected = !url.includes('/billing');
    expect(isRedirected || hasForbidden > 0).toBe(true);
  });

  test('org-admin can access registrations', async ({ adminPage, orgSlug }) => {
    await adminPage.goto(`/${orgSlug}/admin/tournaments/teams`);
    await expect(adminPage).not.toHaveURL(/\/auth\/login/);
    await expect(adminPage.locator('main').first()).toBeVisible();
  });
});
