/**
 * The org public page's return flip (NAV_UNIFICATION_PLAN Stage E.2) — signed-in half. Since Club Tier Stage 4b-1 the
 * door lives in the club's own bar (`[data-club-bar]`), outermost, for this club's staff only (Ask S1).
 *
 * The companion to `anonymous-public-invariant.spec.ts`: that file proves a fan sees NOTHING new,
 * this one proves the operator's door actually appears. Both matter — a control gated so tightly
 * that it never renders is a worse outcome than one that leaks, because nothing fails loudly.
 *
 * WHAT IT GUARDS: the flip closes a one-way trip (admin screens flip out to `/{orgSlug}`, nothing
 * flipped back). It must appear on the org's OWN public pages for someone holding a workspace
 * there, and must NOT appear on a different org's public pages.
 *
 * Signs in explicitly rather than reusing a suite session file: the fixture operator here owns two
 * PUBLIC dev orgs, which is exactly the cross-org case the scoping rule has to get right.
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const OPERATOR = { email: 'owner@dev.local', password: 'devpass123' };
/** Two public orgs the fixture operator owns, plus one they hold nothing in. */
const OWNED_ORG = '/dev-league-org';
const ALSO_OWNED_ORG = '/dev-club-org';
/** A club whose own home is a real club page (the club fixture, scripts/seed-club-fixture.mjs) and that the fixture
 *  operator holds nothing in. (Milton, the old pick, forwards its home to its one tournament — a tournament page, whose
 *  own strip is not the club's bar, so the absence checks there proved nothing about the club's bar.) */
const FOREIGN_ORG = '/uat-rep-club';

async function signIn(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(OPERATOR.email);
  await page.getByLabel(/password/i).fill(OPERATOR.password);
  await page.getByRole('button', { name: /sign in|log in/i }).first().click();
  await page.waitForURL(url => !url.pathname.startsWith('/auth/login'), { timeout: 30_000 });
}

test.describe('Stage E.2 — the operator return flip', () => {
  test('appears on an org page the operator holds a workspace in', async ({ page }) => {
    await signIn(page);
    await page.goto(OWNED_ORG, { waitUntil: 'networkidle' });
    // Identity resolves client-side after hydration, so the door arrives late by design.
    // The door is found by its marker: its face is an icon (globe / club office), its words only its accessible name.
    const flip = page.locator('[data-club-bar] [data-flip-door]').first();
    await expect(flip).toBeVisible({ timeout: 15_000 });
  });

  test('the flip points INTO this org, never into the operator\'s other org', async ({ page }) => {
    await signIn(page);
    await page.goto(OWNED_ORG, { waitUntil: 'networkidle' });
    const door = page.locator(`[data-club-bar] a[href^="${OWNED_ORG}/"][data-flip-door]`).first();
    await expect(door).toBeVisible({ timeout: 15_000 });

    // The same operator on their OTHER org gets that org's door — proving the scoping is per-page,
    // not "the first workspace I happen to hold".
    await page.goto(ALSO_OWNED_ORG, { waitUntil: 'networkidle' });
    const otherDoor = page.locator(`[data-club-bar] a[href^="${ALSO_OWNED_ORG}/"][data-flip-door]`).first();
    await expect(otherDoor).toBeVisible({ timeout: 15_000 });
  });

  test('does NOT appear on an org the operator holds nothing in', async ({ page }) => {
    await signIn(page);
    await page.goto(FOREIGN_ORG, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // give any late-resolving control time to wrongly appear
    const bar = page.locator('[data-club-bar]');
    await expect(bar).toBeVisible();
    await expect(bar.locator('[data-flip-door]')).toHaveCount(0);
    // Club Tier Stage 4b-1, Ask S1 (ruled 2026-10-20): a club's bar carries a door for THIS club's staff only — never the
    // everywhere-chooser, which used to draw this operator's own clubs on a club they hold nothing in.
    await expect(bar.getByRole('button', { name: /workspaces/i })).toHaveCount(0);
    await expect(bar.getByRole('link', { name: /^(Admin|Coaches Portal)$/ })).toHaveCount(0);
  });
});
