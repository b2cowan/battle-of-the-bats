/**
 * Auth setup — runs once before the full UAT suite.
 *
 * Logs in as each UAT role and saves the session state to a file.
 * Subsequent test files load the saved state via `storageState`, so
 * every test starts already authenticated — no re-login overhead.
 *
 * Run order: this file matches the 'auth-setup' Playwright project,
 * which is listed as a dependency of the 'uat' project in playwright.config.ts.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loadUATEnv } from './helpers/types';

// Defer env validation to test runtime so `playwright --list` works without .env.local
let _env: ReturnType<typeof loadUATEnv> | null = null;
function env() {
  if (!_env) _env = loadUATEnv();
  return _env;
}

const SESSION_DIR = path.join(__dirname, '.auth');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginOrgUser(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  savePath: string,
) {
  await page.goto('/auth/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();

  // Multi-org users can land on the workspace picker while the URL transition is
  // still settling, so wait for either authenticated page evidence or navigation.
  await expect.poll(async () => {
    if (!new URL(page.url()).pathname.startsWith('/auth/login')) return true;
    return page.getByText(`Logged in as ${email}`).isVisible();
  }, { timeout: 45_000 }).toBe(true);

  await page.context().storageState({ path: savePath });
}

async function loginPlatformAdmin(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  savePath: string,
) {
  await page.goto('/platform-admin/login');
  await page.locator('#pl-email').fill(email);
  await page.locator('#pl-password').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait for signIn + platform_users DB check + Next.js redirect to fully resolve.
  // The layout does a Supabase query before redirecting, so this can take several seconds.
  await expect.poll(async () => {
    if (!new URL(page.url()).pathname.startsWith('/platform-admin/login')) return true;
    return page.getByRole('heading', { name: /Platform Admin|Dashboard|Organizations/ }).isVisible();
  }, { timeout: 45_000 }).toBe(true);

  await page.context().storageState({ path: savePath });
}

// ── Setup tests (one per role) ────────────────────────────────────────────────

setup('authenticate: platform-admin', async ({ page }) => {
  const savePath = path.join(__dirname, '.auth/platform-admin.json');
  await loginPlatformAdmin(page, env().platformAdmin.email, env().platformAdmin.password, savePath);
  console.log(`  ✓ platform-admin session saved → ${savePath}`);
});

setup('authenticate: org-owner', async ({ page }) => {
  const savePath = path.join(__dirname, '.auth/org-owner.json');
  await loginOrgUser(page, env().orgOwner.email, env().orgOwner.password, savePath);
  console.log(`  ✓ org-owner session saved → ${savePath}`);
});

setup('authenticate: org-admin', async ({ page }) => {
  const savePath = path.join(__dirname, '.auth/org-admin.json');
  await loginOrgUser(page, env().orgAdmin.email, env().orgAdmin.password, savePath);
  console.log(`  ✓ org-admin session saved → ${savePath}`);
});

setup('authenticate: coach', async ({ page }) => {
  const savePath = path.join(__dirname, '.auth/coach.json');
  await loginOrgUser(page, env().coach.email, env().coach.password, savePath);
  console.log(`  ✓ coach session saved → ${savePath}`);
});
