/**
 * UAT Suite: Tournament Admin
 *
 * Covers the core tournament admin shell — the pages an org owner or admin
 * uses most frequently. Tests cover: page load, data display, key actions.
 *
 * Roles: org_owner (default), org_admin where noted.
 */

import { test, expect } from '../helpers/fixtures';

// ── Tournament hub ───────────────────────────────────────────────────────────

test.describe('Tournament admin / hub', () => {
  test('org admin hub loads without error', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    // No error boundary text
    await expect(ownerPage.locator('text=Something went wrong')).not.toBeVisible();
    await expect(ownerPage.locator('text=500')).not.toBeVisible();
  });

  test('tournament list page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Registrations (teams) ─────────────────────────────────────────────────────

test.describe('Tournament admin / registrations', () => {
  test('registrations page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/teams`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
    await expect(ownerPage.locator('text=Something went wrong')).not.toBeVisible();
  });

  test('registrations page has no console errors on load', async ({ ownerPage, orgSlug }) => {
    const consoleErrors: string[] = [];
    ownerPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/teams`);
    await ownerPage.waitForLoadState('networkidle');
    // Filter out known benign browser extension / third-party errors
    const appErrors = consoleErrors.filter(e =>
      !e.includes('chrome-extension') &&
      !e.includes('favicon') &&
      !e.includes('ResizeObserver')
    );
    expect(appErrors).toHaveLength(0);
  });

  test('admin toolbar renders above registration list', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/teams`);
    // The toolbar should appear before the list — it's the primary nav element on the page
    const toolbar = ownerPage.locator(
      '[class*="toolbar"], [class*="AdminToolbar"], [role="toolbar"]'
    ).first();
    await expect(toolbar).toBeVisible({ timeout: 8_000 });
  });

  test('registration search/filter is accessible', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/teams`);
    // A search input or filter select should exist
    const filterEl = ownerPage.locator(
      'input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i], select[aria-label*="division" i], [class*="search"]'
    ).first();
    await expect(filterEl).toBeVisible({ timeout: 8_000 });
  });
});

// ── Schedule ─────────────────────────────────────────────────────────────────

test.describe('Tournament admin / schedule', () => {
  test('schedule page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/schedule`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('schedule page has no 500 error', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/schedule`);
    await expect(ownerPage.locator('text=500')).not.toBeVisible();
    await expect(ownerPage.locator('text=Internal Server Error')).not.toBeVisible();
  });
});

// ── Results ──────────────────────────────────────────────────────────────────

test.describe('Tournament admin / results', () => {
  test('results page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/results`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Venues ───────────────────────────────────────────────────────────────────

test.describe('Tournament admin / venues', () => {
  test('venues page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/venues`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Contacts ─────────────────────────────────────────────────────────────────

test.describe('Tournament admin / contacts', () => {
  test('contacts page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/contacts`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Org settings ─────────────────────────────────────────────────────────────

test.describe('Tournament admin / org settings', () => {
  test('org settings members page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/settings/members`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });

  test('org settings organization page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/settings/organization`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Help ─────────────────────────────────────────────────────────────────────

test.describe('Tournament admin / help', () => {
  test('tournament help page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/help/tournaments`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main, article, [class*="help"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('registration help page loads', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/help/registrations`);
    await expect(ownerPage.locator('main, article, [class*="help"]').first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Public site views ────────────────────────────────────────────────────────

test.describe('Public site', () => {
  test('org public schedule page renders', async ({ anonPage, orgSlug }) => {
    await anonPage.goto(`/${orgSlug}/schedule`);
    await expect(anonPage.locator('main, [class*="schedule"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('org public standings page renders', async ({ anonPage, orgSlug }) => {
    await anonPage.goto(`/${orgSlug}/standings`);
    await expect(anonPage.locator('main').first()).toBeVisible({ timeout: 8_000 });
  });
});
