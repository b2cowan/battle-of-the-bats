/**
 * The premium Coaches Portal's "not assigned" wall keeps its chrome and its doors
 * (top-nav repair R2 · audit finding D2, 2026-08-01).
 *
 * WHAT IT GUARDS: the wall used to return BEFORE any chrome mounted — a black screen with one
 * link and a mailto. No wordmark, no account door, no sign-out. Who lands there: a coach whose
 * assignment was hard-revoked, anyone following a wrong-org link, an org admin who isn't a coach,
 * a team-workspace owner whose entitlement lapsed. It is the product's "is this place still real?"
 * question rendered at its worst, so the answer needs to be a real triad — where am I, who am I,
 * and a way out — not a dead end.
 *
 * THE SECOND HALF is the D1 family: the wall's only link was a hardcoded `/{orgSlug}` that could
 * itself 404. It now renders only when the shared `isOrgHomeRealDestination` predicate says the
 * org's public page is a real place, so the wall can never hand a revoked coach a second dead end.
 *
 * Fixture: the uat-test-org OWNER is an org admin with no coaching assignment, which is exactly
 * one of the named cases. That org's public page is deliberately NOT public (`/uat-test-org`
 * 404s), so it also exercises the "hide the door" branch.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join(process.cwd(), 'tests/uat/.auth/org-owner.json') });

const ORG = '/uat-test-org';
const WALL = `${ORG}/coaches`;

test.describe('R2 — the coach wall renders inside the portal frame', () => {
  test('the fixture still reproduces the wall (an org member with no coaching assignment)', async ({ page }) => {
    await page.goto(WALL, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /not assigned to any teams/i })).toBeVisible();
  });

  test('the operator strip mounts above it — the wall is not chrome-less any more', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(WALL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    // Zone 1: the wordmark is a real door out, as on every other operator surface.
    await expect(page.locator('header a[href="/discover"]').first()).toBeVisible();
    // Zone 3: the personal door — a MENU since 2026-09-01 (COACH_ACCOUNT_MENU_PLAN.md):
    // the account door opens in place; the wall keeps identity + exits inside it (the
    // /account row and Sign out), minus Send feedback (portal function stays off a wall).
    // (The Workspaces pill self-gates at 2+ places, so it is deliberately NOT asserted
    // here — its absence for a one-place account is correct.)
    const accountDoor = page.locator('header button[aria-label="Account"]').first();
    await expect(accountDoor).toBeVisible();
    await accountDoor.click();
    await expect(page.getByRole('menuitem', { name: /account settings/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /send feedback/i })).toHaveCount(0);
  });

  test('the card offers Home and a working sign-out at every width', async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(WALL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const main = page.locator('main');
      await expect(main.getByRole('link', { name: /go to home/i }), `Home door @${width}px`).toBeVisible();
      await expect(main.getByRole('button', { name: /sign out/i }), `sign-out @${width}px`).toBeVisible();
    }
  });

  test('it offers NO door to an org home that 404s', async ({ page }) => {
    // Precondition: this org's public page really is unreachable.
    expect((await page.request.get(ORG)).status()).toBe(404);
    await page.goto(WALL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const dead = await page.locator(`a[href="${ORG}"], a[href="${ORG}/"]`).count();
    expect(dead, 'wall links pointing at a 404 org home').toBe(0);
  });

  test('nothing on the wall points at a page the visitor cannot open', async ({ page }) => {
    await page.goto(WALL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const hrefs = await page.locator('main a[href]').evaluateAll(
      els => els.map(e => e.getAttribute('href')!).filter(h => h.startsWith('/')),
    );
    for (const href of hrefs) {
      const status = (await page.request.get(href)).status();
      expect(status, `wall door ${href}`).toBeLessThan(400);
    }
  });
});
