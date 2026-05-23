/**
 * UAT Suite: Platform Admin
 *
 * Covers the /platform-admin shell — internal-only tooling for FieldLogicHQ staff.
 * All tests run as platform_admin role.
 */

import { test, expect } from '../helpers/fixtures';

// ── Core pages ───────────────────────────────────────────────────────────────

test.describe('Platform admin / navigation', () => {
  test('platform admin nav renders', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin');
    await expect(platformAdminPage.locator('nav, [class*="nav"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('no 500 on platform admin root', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin');
    await expect(platformAdminPage.locator('text=500')).not.toBeVisible();
    await expect(platformAdminPage.locator('text=Internal Server Error')).not.toBeVisible();
  });
});

// ── Orgs list ────────────────────────────────────────────────────────────────

test.describe('Platform admin / orgs', () => {
  test('orgs list page loads', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin/orgs');
    await expect(platformAdminPage).not.toHaveURL(/\/platform-admin\/login/);
    await expect(platformAdminPage.locator('main, [class*="main"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('orgs list shows at least one org', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin/orgs');
    await platformAdminPage.waitForLoadState('networkidle');
    // There should be at least one row/card for an org
    const rows = platformAdminPage.locator('table tbody tr, [class*="orgRow"], [class*="OrgRow"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('orgs list has no console errors on load', async ({ platformAdminPage }) => {
    const errors: string[] = [];
    platformAdminPage.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await platformAdminPage.goto('/platform-admin/orgs');
    await platformAdminPage.waitForLoadState('networkidle');
    const appErrors = errors.filter(e => !e.includes('chrome-extension') && !e.includes('favicon'));
    expect(appErrors).toHaveLength(0);
  });
});

// ── Plans & pricing ──────────────────────────────────────────────────────────

test.describe('Platform admin / plans', () => {
  test('plans page loads', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin/plans');
    await expect(platformAdminPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('plans-pricing page loads', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin/plans-pricing');
    await expect(platformAdminPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('stripe-prices page loads', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin/stripe-prices');
    await expect(platformAdminPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Bulk operations ──────────────────────────────────────────────────────────

test.describe('Platform admin / bulk operations', () => {
  test('bulk operations page loads', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin/bulk-operations');
    await expect(platformAdminPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Platform admin help ──────────────────────────────────────────────────────

test.describe('Platform admin / help', () => {
  test('platform admin help page loads', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin/help');
    await expect(platformAdminPage.locator('main, article, [class*="help"]').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Access control ───────────────────────────────────────────────────────────

test.describe('Platform admin / access control', () => {
  test('org-owner cannot access platform-admin', async ({ ownerPage }) => {
    await ownerPage.goto('/platform-admin/orgs');
    // Must redirect to platform-admin login (different from org login)
    await expect(ownerPage).toHaveURL(/\/platform-admin\/login/, { timeout: 8_000 });
  });

  test('unauthenticated user cannot access platform-admin', async ({ anonPage }) => {
    await anonPage.goto('/platform-admin');
    await expect(anonPage).toHaveURL(/\/platform-admin\/login/, { timeout: 8_000 });
  });
});
