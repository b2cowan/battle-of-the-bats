/**
 * Playwright test fixtures for FieldLogicHQ UAT.
 *
 * Usage in spec files:
 *
 *   import { test, expect } from '../helpers/fixtures';
 *
 *   test('something as owner', async ({ ownerPage, orgSlug }) => {
 *     await ownerPage.goto(`/${orgSlug}/admin`);
 *     ...
 *   });
 */

import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';
import { loadUATEnv, type UATEnv } from './types';

// Lazy singleton — env is validated at first fixture use, not at module load time
let _env: UATEnv | null = null;
function getEnv(): UATEnv {
  if (!_env) _env = loadUATEnv();
  return _env;
}

// ── Session file paths (mirrored from playwright.config.ts) ──────────────────

const AUTH_DIR = path.join(__dirname, '../.auth');

const SESSION = {
  platformAdmin: path.join(AUTH_DIR, 'platform-admin.json'),
  orgOwner:      path.join(AUTH_DIR, 'org-owner.json'),
  orgAdmin:      path.join(AUTH_DIR, 'org-admin.json'),
  coach:         path.join(AUTH_DIR, 'coach.json'),
} as const;

// ── Fixture types ─────────────────────────────────────────────────────────────

type UATFixtures = {
  /** Convenience: the org slug from env */
  orgSlug: string;
  /** Page authenticated as platform admin */
  platformAdminPage: Page;
  /** Page authenticated as org owner */
  ownerPage: Page;
  /** Page authenticated as org admin */
  adminPage: Page;
  /** Page authenticated as coach */
  coachPage: Page;
  /** Unauthenticated page (no storage state) */
  anonPage: Page;
};

// ── Extended test with role-scoped pages ──────────────────────────────────────

export const test = base.extend<UATFixtures>({
  orgSlug: async ({}, use) => {
    await use(getEnv().orgSlug);
  },

  platformAdminPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: SESSION.platformAdmin });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  ownerPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: SESSION.orgOwner });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  adminPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: SESSION.orgAdmin });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  coachPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: SESSION.coach });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  anonPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect };
