/**
 * UAT Suite: Authentication
 *
 * Covers: login flows, error states, logout, protected-route redirects.
 * Roles tested: unauthenticated, org_owner, platform_admin
 */

import { test, expect } from '../helpers/fixtures';
import { loadUATEnv, type UATEnv } from '../helpers/types';

// Lazy — resolved at test runtime, not at module parse time (allows `playwright --list` without .env.local)
let _env: UATEnv | null = null;
const env = () => { if (!_env) _env = loadUATEnv(); return _env; };

// ── Login page basics ────────────────────────────────────────────────────────

test.describe('Auth / login page', () => {
  test('login page renders correctly', async ({ anonPage }) => {
    await anonPage.goto('/auth/login');
    await expect(anonPage.locator('#login-email')).toBeVisible();
    await expect(anonPage.locator('#login-password')).toBeVisible();
    await expect(anonPage.locator('#login-submit')).toBeVisible();
  });

  test('invalid credentials shows error message', async ({ anonPage }) => {
    await anonPage.goto('/auth/login');
    await anonPage.locator('#login-email').fill('notareal@user.com');
    await anonPage.locator('#login-password').fill('wrongpassword123');
    await anonPage.locator('#login-submit').click();

    // Error message must appear; the user must NOT be redirected away
    await expect(anonPage.locator('[class*="error"]')).toBeVisible({ timeout: 8_000 });
    await expect(anonPage).toHaveURL(/\/auth\/login/);
  });

  test('successful org-owner login redirects away from login', async ({ anonPage }) => {
    await anonPage.goto('/auth/login');
    await anonPage.locator('#login-email').fill(env().orgOwner.email);
    await anonPage.locator('#login-password').fill(env().orgOwner.password);
    await anonPage.locator('#login-submit').click();
    await expect(anonPage).not.toHaveURL(/\/auth\/login/, { timeout: 10_000 });
  });
});

// ── Platform admin login ─────────────────────────────────────────────────────

test.describe('Auth / platform-admin login page', () => {
  test('platform-admin login page renders', async ({ anonPage }) => {
    await anonPage.goto('/platform-admin/login');
    await expect(anonPage.locator('#pl-email')).toBeVisible();
    await expect(anonPage.locator('#pl-password')).toBeVisible();
  });

  test('invalid credentials on platform-admin login shows error', async ({ anonPage }) => {
    await anonPage.goto('/platform-admin/login');
    await anonPage.locator('#pl-email').fill('bad@user.com');
    await anonPage.locator('#pl-password').fill('wrongpass');
    await anonPage.locator('button[type="submit"]').click();
    await expect(anonPage.locator('[class*="error"]')).toBeVisible({ timeout: 8_000 });
    await expect(anonPage).toHaveURL(/\/platform-admin\/login/);
  });

  test('platform-admin login redirects to dashboard', async ({ anonPage }) => {
    await anonPage.goto('/platform-admin/login');
    await anonPage.locator('#pl-email').fill(env().platformAdmin.email);
    await anonPage.locator('#pl-password').fill(env().platformAdmin.password);
    await anonPage.locator('button[type="submit"]').click();
    await expect(anonPage).toHaveURL(/\/platform-admin(?!\/login)/, { timeout: 10_000 });
  });
});

// ── Protected route redirects ────────────────────────────────────────────────

test.describe('Auth / protected-route redirects', () => {
  test('unauthenticated access to org admin redirects to login', async ({ anonPage, orgSlug }) => {
    await anonPage.goto(`/${orgSlug}/admin`);
    // Should redirect to /auth/login or similar
    await expect(anonPage).toHaveURL(/\/(auth\/login|platform-admin\/login)/, { timeout: 8_000 });
  });

  test('unauthenticated access to platform-admin redirects to platform login', async ({ anonPage }) => {
    await anonPage.goto('/platform-admin');
    await expect(anonPage).toHaveURL(/\/platform-admin\/login/, { timeout: 8_000 });
  });

  test('unauthenticated access to coaches portal redirects to login', async ({ anonPage, orgSlug }) => {
    await anonPage.goto(`/${orgSlug}/coaches`);
    await expect(anonPage).toHaveURL(/\/auth\/login/, { timeout: 8_000 });
  });
});

// ── Authenticated session persistence ────────────────────────────────────────

test.describe('Auth / session persistence', () => {
  test('authenticated owner can access admin dashboard', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin`);
    // Should NOT redirect to login
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/, { timeout: 8_000 });
    // Admin nav or dashboard content should be present
    await expect(ownerPage.locator('nav, [class*="sidebar"], [class*="admin"]').first()).toBeVisible();
  });

  test('authenticated platform-admin can access platform dashboard', async ({ platformAdminPage }) => {
    await platformAdminPage.goto('/platform-admin');
    await expect(platformAdminPage).not.toHaveURL(/\/platform-admin\/login/, { timeout: 8_000 });
    await expect(platformAdminPage.locator('nav, [class*="nav"]').first()).toBeVisible();
  });
});
