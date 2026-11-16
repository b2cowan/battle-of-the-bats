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
import { recordLegalAcceptance } from './helpers/legal-acceptance';
import { supabaseAdmin } from '../../lib/supabase-admin';
import { findAuthUserByEmail } from '../../lib/auth-account-lookup';
import { currentVersion } from '../../lib/legal-documents';
import { UAT_TWO_STEP_EMAIL, enrolKnownAuthenticator, ensureTwoStepAccount, freshTotpCode, saveTwoStepKey } from './helpers/two-step';

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
  // GST/HST 6.3 A5: a long-lived UAT role never meets the Terms screen (records nothing while the legal pages are off; the
  // platform admin is staff, exempt, and signs in below without it). No account scan while the pages are off.
  if (currentVersion('terms') !== null) await recordLegalAcceptance(supabaseAdmin, await findAuthUserByEmail(email));
  await page.goto('/auth/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();

  // Multi-org users can land on the workspace picker while the URL transition is
  // still settling, so wait for navigation away from the login path.
  await expect.poll(async () => {
    return !new URL(page.url()).pathname.startsWith('/auth/login');
  }, { timeout: 45_000 }).toBe(true);

  await page.context().storageState({ path: savePath });
}

async function loginPlatformAdmin(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  savePath: string,
) {
  // ⚖ Staff always use two-step sign-in (Board Ready, Part 1): a fresh authenticator for this run, its key kept for the
  // specs that sign the staff account in again, then the real code step.
  const secret = await enrolKnownAuthenticator(email, password);
  saveTwoStepKey(email, { secret });

  await page.goto('/platform-admin/login');
  await page.locator('#pl-email').fill(email);
  await page.locator('#pl-password').fill(password);
  await page.locator('button[type="submit"]').click();

  await page.locator('#two-step-code').waitFor({ timeout: 45_000 });
  await page.locator('#two-step-code').fill(await freshTotpCode(secret));
  await page.locator('#two-step-submit').click();

  // Wait for signIn + platform_users DB check + Next.js redirect to fully resolve.
  // The layout does a Supabase query before redirecting, so this can take several seconds.
  await expect.poll(async () => {
    // ⚠ Wait for the platform home itself, not merely "off the login page". After the code step the page passes through
    // /auth/login for a moment before it lands on /platform-admin; saving the session in that gap saved the password-only
    // copy (aal1), which the server treats as signed out (found 2026-11-16: the layout sweep's sign-in proof 401'd it).
    const path = new URL(page.url()).pathname;
    if (!path.startsWith('/platform-admin') || path.startsWith('/platform-admin/login')) return false;
    // `.first()`: the home shows BOTH headings whenever its Action Queue has something in it, and a
    // strict-mode locator then refuses to answer (found 2026-09-25, when the queue first had work).
    return page.getByRole('heading', { name: /Today|Overview|Action Queue/ }).first().isVisible();
  }, { timeout: 45_000 }).toBe(true);

  await page.context().storageState({ path: savePath });
}

// ── Setup tests (one per role) ────────────────────────────────────────────────

setup('authenticate: platform-admin', async ({ page }) => {
  const savePath = path.join(__dirname, '.auth/platform-admin.json');
  await loginPlatformAdmin(page, env().platformAdmin.email, env().platformAdmin.password, savePath);
  console.log(`  ✓ platform-admin session saved → ${savePath}`);
});

// The dedicated two-step account (tab 9): its spec walks the code step; setup only gives it a password and a known key.
setup('prepare: two-step account', async () => {
  const password = await ensureTwoStepAccount();
  const secret = await enrolKnownAuthenticator(UAT_TWO_STEP_EMAIL, password);
  saveTwoStepKey(UAT_TWO_STEP_EMAIL, { secret, password });
  console.log(`  ✓ two-step account ready → ${UAT_TWO_STEP_EMAIL}`);
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

// ── The tournament VOLUNTEER (an `official` on uat-plus-org) — the scorekeeper and gate screens as a
// volunteer meets them (Admin Design Continuity slice 0: the layout sweep and the identity check).
// Skipped when its env pair is absent, like the Club fixture below.
setup('authenticate: plus-official', async ({ page }) => {
  const official = env().plusScorekeeper;
  setup.skip(!official, 'UAT_PLUS_SCOREKEEPER_* not set in .env.local — the volunteer session is optional');
  const savePath = path.join(__dirname, '.auth/plus-official.json');
  await loginOrgUser(page, official!.email, official!.password, savePath);
  console.log(`  ✓ plus-official session saved → ${savePath}`);
});

// ── The FREE coach (no organization, one free team) — the free portal's screens in the layout sweep (Free
// coach header parity B4). Skipped when its env pair is absent. Build it first: node scripts/seed-free-coach-fixture.mjs
setup('authenticate: free-coach', async ({ page }) => {
  const free = env().freeCoach;
  setup.skip(!free, 'UAT_FREE_COACH_* not set in .env.local — optional for the UAT suite, but the layout sweep needs it');
  const savePath = path.join(__dirname, '.auth/free-coach.json');
  await loginOrgUser(page, free!.email, free!.password, savePath);
  console.log(`  ✓ free-coach session saved → ${savePath}`);
});

// ── The Club Tier Readiness fixture (uat-rep-club) — skipped when its env block is absent ──
// Build it first: node --env-file=.env.local scripts/seed-club-fixture.mjs
for (const [role, file] of [
  ['owner', 'rep-club-owner'], ['admin', 'rep-club-admin'], ['treasurer', 'rep-club-treasurer'],
  ['registrar', 'rep-club-registrar'], ['coach', 'rep-club-coach'],
] as const) {
  setup(`authenticate: rep-club ${role}`, async ({ page }) => {
    const club = env().repClub;
    setup.skip(!club, 'UAT_REP_CLUB_* not set in .env.local — the Club fixture sessions are optional');
    const savePath = path.join(__dirname, `.auth/${file}.json`);
    await loginOrgUser(page, club![role].email, club![role].password, savePath);
    console.log(`  ✓ rep-club ${role} session saved → ${savePath}`);
  });
}
