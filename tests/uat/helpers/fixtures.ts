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

/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures receive a `use` continuation
   (`await use(value)`), and eslint-plugin-react-hooks 7 (arrived with eslint-config-next 16.3.0)
   treats every bare `use()` call as React's hook. This file is Playwright harness code — there is
   no React runtime anywhere near it. Scoped here rather than config-wide so the rule stays live
   for real components. */
import { test as base, expect, type Page } from '@playwright/test';
import fs from 'fs';
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
  // The Club Tier Readiness fixture (`uat-rep-club`) — written by auth.setup only when its env block is set.
  repClubOwner:     path.join(AUTH_DIR, 'rep-club-owner.json'),
  repClubAdmin:     path.join(AUTH_DIR, 'rep-club-admin.json'),
  repClubTreasurer: path.join(AUTH_DIR, 'rep-club-treasurer.json'),
  repClubRegistrar: path.join(AUTH_DIR, 'rep-club-registrar.json'),
  repClubCoach:     path.join(AUTH_DIR, 'rep-club-coach.json'),
} as const;

// ── Fixture types ─────────────────────────────────────────────────────────────

type UATFixtures = {
  /** Convenience: the org slug from env */
  orgSlug: string;
  /** The coach fixture's org (UAT_COACH_ORG_SLUG, else UAT_ORG_SLUG) — for coaches-portal URLs. */
  coachOrgSlug: string;
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
  /** The Club Tier Readiness fixture's org slug (`uat-rep-club`), or null when its env block is absent. */
  repClubOrgSlug: string | null;
  /** Pages signed in as the fixture club's board and its 15U AAA head coach. Each one SKIPS the
   *  test by itself when the club's env block or session file is missing, so a machine without
   *  the fixture stays green with no guard in the spec. ⚠ A `test.skip(...)` in the test BODY
   *  cannot do this job: every fixture a test destructures is set up before its body runs, so the
   *  missing session file would throw first and the test would FAIL (review finding 2026-09-25). */
  repClubOwnerPage: Page;
  repClubAdminPage: Page;
  repClubTreasurerPage: Page;
  repClubRegistrarPage: Page;
  repClubCoachPage: Page;
};

/** One fixture per club session file — the four above's shape, plus a skip when the optional
 *  club fixture is not set up on this machine (see the note on the fixture types). */
function sessionPage(storageState: string) {
  return async (
    { browser }: { browser: import('@playwright/test').Browser },
    use: (p: Page) => Promise<void>,
    testInfo: import('@playwright/test').TestInfo,
  ) => {
    testInfo.skip(
      !getEnv().repClub || !fs.existsSync(storageState),
      'Club fixture not set up here — set UAT_REP_CLUB_* in .env.local, run scripts/seed-club-fixture.mjs, then auth-setup',
    );
    const ctx  = await browser.newContext({ storageState });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  };
}

// ── Extended test with role-scoped pages ──────────────────────────────────────

export const test = base.extend<UATFixtures>({
  orgSlug: async ({}, use) => {
    await use(getEnv().orgSlug);
  },

  coachOrgSlug: async ({}, use) => {
    await use(getEnv().coachOrgSlug);
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
    // ⚠ An EXPLICITLY empty session. Inside the test runner `browser.newContext()` inherits the
    // project's `use.storageState` — the org-OWNER session in playwright.config.ts — so a bare
    // newContext() was signed in as the owner, and every "signed-out visitor" test was really an
    // owner test (the login page redirected away; protected routes opened). Found 2026-09-25.
    const ctx  = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  repClubOrgSlug: async ({}, use) => {
    await use(getEnv().repClub?.orgSlug ?? null);
  },
  repClubOwnerPage:     sessionPage(SESSION.repClubOwner),
  repClubAdminPage:     sessionPage(SESSION.repClubAdmin),
  repClubTreasurerPage: sessionPage(SESSION.repClubTreasurer),
  repClubRegistrarPage: sessionPage(SESSION.repClubRegistrar),
  repClubCoachPage:     sessionPage(SESSION.repClubCoach),
});

export { expect };
