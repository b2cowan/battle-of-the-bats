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
 * Fixture: the uat-test-org OWNER is an org admin with no coaching assignment. That org's public page
 * is deliberately NOT public (`/uat-test-org` 404s), so it also exercises the "hide the door" branch.
 *
 * ⚖ SINCE CLUB TIER STAGE 1 (B05, 2026-09-25) the portal checks the club's PLAN first. uat-test-org is
 * a tournament org, so its owner now meets the PLAN wall ("The Coaches Portal isn't part of …'s plan"),
 * and every door claim below holds for that wall too — it carries the same exits, which the first cut
 * of it did not (a phone user had no way out). The NOT-ASSIGNED wall is reproduced where it now lives:
 * a CLUB (whose plan carries the portal) opened by its owner, who coaches no team.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join(process.cwd(), 'tests/uat/.auth/org-owner.json') });

const ORG = '/uat-test-org';
const WALL = `${ORG}/coaches`;

test.describe('R2 — the coach wall renders inside the portal frame', () => {
  test('the fixture still reproduces a wall: a tournament org\'s portal is the PLAN wall (B05)', async ({ page }) => {
    await page.goto(WALL, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /the coaches portal isn.t part of .* plan right now/i })).toBeVisible();
    // The owner can act on it — their one door is the plans page for THIS tier.
    await expect(page.locator('main').getByRole('link', { name: 'See plans' }))
      .toHaveAttribute('href', `${ORG}/admin/tournaments/settings/subscription`);
  });

  test('a club member with no coaching assignment meets the NOT-ASSIGNED wall, with its doors', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: path.join(process.cwd(), 'tests/uat/.auth/rep-club-owner.json') });
    const page = await ctx.newPage();
    try {
      await page.goto('/uat-rep-club/coaches', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: /not assigned to any teams/i })).toBeVisible();
      const main = page.locator('main');
      await expect(main.getByRole('link', { name: /go to home/i })).toBeVisible();
      await expect(main.getByRole('button', { name: /sign out/i })).toBeVisible();
    } finally {
      await ctx.close();
    }
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

// Stage 2 supplies the owner's billing door without moving the cancelled or plan walls.
// These read-only cases use an owner-prepared standalone fixture; they never create, revoke,
// cancel or grant anything in the shared database. The ordinary UAT sessions have no standalone
// owner fixture, so a missing fixture is an explicit skipped owner walk, not a passing assertion.
test.describe('Plan & billing — standalone owner wall doors', () => {
  test.use({ storageState: process.env.UAT_COACH_BILLING_OWNER_SESSION
    ?? path.join(process.cwd(), 'tests/uat/.auth/org-owner.json') });

  test('a zero-team owner can follow the wall door into billing at desktop and phone widths', async ({ page }) => {
    const slug = process.env.UAT_COACH_BILLING_ZERO_TEAM_ORG_SLUG;
    test.skip(!slug, 'Owner walk needs UAT_COACH_BILLING_ZERO_TEAM_ORG_SLUG and its owner session; no fixture is mutated by this test.');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${slug}/coaches`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Coaches Portal not ready' })).toBeVisible();
      const tournaments = page.locator('main').getByRole('link', { name: 'Tournaments you run', exact: true });
      await expect(tournaments).toHaveAttribute('href', `/${slug}/admin/org/tournaments`);
      await expect(tournaments).not.toHaveClass(/btn-lime/);
      await tournaments.click();
      await expect(page).toHaveURL(url => url.pathname === `/${slug}/admin/org/tournaments`);
      if (width === 390) await page.getByRole('button', { name: 'More', exact: true }).click();
      const portal = page.getByRole('link', { name: 'Coaches Portal', exact: true }).filter({ visible: true });
      await expect(portal).toHaveAttribute('href', `/${slug}/coaches`);
      await portal.click();
      await expect(page.getByRole('heading', { name: 'Coaches Portal not ready' })).toBeVisible();
      const door = page.locator('main').getByRole('link', { name: 'Plan & billing', exact: true });
      await expect(door).toHaveAttribute('href', `/${slug}/coaches/billing`);
      await door.click();
      await expect(page).toHaveURL(url => url.pathname === `/${slug}/coaches/billing`);
      await expect(page.getByRole('heading', { name: 'Plan & billing', exact: true })).toBeVisible();
      await expect(page.locator('#billing-change')).toBeVisible();
      await expect(page.getByText('Billing access required', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Coaches Portal not ready' })).toHaveCount(0);
    }
  });

  test('a cancelled standalone owner gets the existing Reactivate path, including from the billing address', async ({ page }) => {
    const slug = process.env.UAT_COACH_BILLING_CANCELLED_ORG_SLUG;
    test.skip(!slug, 'Owner walk needs UAT_COACH_BILLING_CANCELLED_ORG_SLUG and its owner session; no fixture is cancelled by this test.');
    for (const suffix of ['', '/billing']) {
      await page.goto(`/${slug}/coaches${suffix}`, { waitUntil: 'networkidle' });
      const door = page.locator('main').getByRole('link', { name: 'Reactivate Premium', exact: true });
      await expect(door).toBeVisible();
      const destination = new URL((await door.getAttribute('href'))!, page.url());
      expect(destination.pathname).toBe('/coaches/start');
      expect(destination.searchParams.get('reactivateOrgSlug')).toBe(slug);
      expect(destination.searchParams.get('teamName')).toBeTruthy();
      await expect(page.getByRole('heading', { name: 'Plan & billing', exact: true })).toHaveCount(0);
    }
  });
});
