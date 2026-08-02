/**
 * The marketing seam knows who is reading it (top-nav repair R4 · audit finding D4, 2026-08-01).
 *
 * WHAT IT GUARDS: the app strip links to /pricing from every consumer surface, so this is the
 * highest-traffic seam crossing in the product. The marketing bar never checked sign-in state,
 * which meant a signed-in owner tapping their own chrome's Pricing link landed on a page offering
 * "Sign In" and "Get Started" — reading as being signed out — with plan cards that funnelled them
 * into `/auth/signup?plan=…` for a tier their org may already be on.
 *
 * THE COMPANION RULE lives in `anonymous-public-invariant.spec.ts`: none of this may cost an
 * anonymous visitor anything. Everything below resolves client-side after hydration.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join(process.cwd(), 'tests/uat/.auth/org-owner.json') });

test.describe('R4 — the marketing bar, signed in', () => {
  for (const marketingPath of ['/', '/pricing']) {
    test(`${marketingPath} offers Account + Open app, never Sign In`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(marketingPath, { waitUntil: 'networkidle' });
      // Post-hydration: the swap is client-resolved, so give it the same window the org nav gets.
      await page.waitForTimeout(1200);
      const bar = page.locator('nav').first();
      await expect(bar.getByRole('link', { name: /^Sign In$/i })).toHaveCount(0);
      await expect(bar.getByRole('link', { name: /^Get Started$/i })).toHaveCount(0);
      await expect(bar.getByRole('link', { name: /^Account$/i })).toBeVisible();
      await expect(bar.getByRole('link', { name: /Open app/i })).toBeVisible();
    });
  }

  test('signed OUT, the bar is exactly what it always was', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/pricing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const bar = page.locator('nav').first();
    await expect(bar.getByRole('link', { name: /^Sign In$/i })).toBeVisible();
    await expect(bar.getByRole('link', { name: /^Get Started$/i })).toBeVisible();
    await ctx.close();
  });
});

test.describe('R4 — the plan cards point at real actions for an operator', () => {
  test('no plan CTA sends a signed-in operator into the sign-up funnel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/pricing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const signupCtas = await page.locator('#org-plans a[href^="/auth/signup"]').count();
    expect(signupCtas, 'sign-up CTAs shown to an account that already operates here').toBe(0);
  });

  test('the CTAs deep-link to the org\'s own billing screen', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // Tier-agnostic on purpose: Tournament and Tournament Plus have no org-admin concept and
    // manage billing under their tournament settings instead. Asserting only the org-billing
    // path would quietly pass or fail on whichever plan the fixture org happens to be on — the
    // per-tier routing itself is pinned by unit tests on the resolver.
    const hrefs = await page
      .locator('#org-plans a[href*="/admin/org/billing"], #org-plans a[href*="/admin/tournaments/settings/subscription"]')
      .count();
    expect(hrefs, 'plan CTAs pointing at a billing screen').toBeGreaterThan(0);
  });

  test('the sign-up CTA is withheld while the operator answer is in flight', async ({ page }) => {
    // /review found the hazard: until the role summary lands we cannot tell an operator from a
    // fan, and the prospect markup's CTA is a LIVE link into the sign-up funnel — the funnel R4
    // exists to keep operators out of, and /auth/signup has no signed-in guard, so a fast clicker
    // genuinely lands there. The fix holds the CTA while that answer is resolving.
    //
    // The role-summary response is delayed deliberately so the window is wide enough to observe.
    // What is asserted is the guarantee the fix actually makes: from the moment we know the
    // visitor is SIGNED IN, no sign-up href is exposed until their real state is known.
    await page.route('**/api/me/role-summary', async route => {
      await new Promise(r => setTimeout(r, 2500));
      await route.continue();
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    // Wait for hydration to have resolved the local session read (the placeholder label appears).
    await expect(page.locator('#org-plans').getByText('…').first()).toBeVisible({ timeout: 10_000 });
    expect(
      await page.locator('#org-plans a[href^="/auth/signup"]').count(),
      'sign-up CTA exposed to a signed-in operator while their state was resolving',
    ).toBe(0);
    // …and it settles into the real operator state rather than staying pending forever.
    await expect(page.locator('#org-plans a[href*="/admin/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('a prospect still gets the sign-up funnel — the pitch is unchanged for them', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/pricing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    expect(await page.locator('#org-plans a[href^="/auth/signup"]').count()).toBeGreaterThan(0);
    expect(await page.locator('#org-plans a[href*="/admin/org/billing"]').count()).toBe(0);
    await ctx.close();
  });

  test('the SSR payload stays role-free — /pricing is still statically cacheable', async ({ request }) => {
    const html = await (await request.get('/pricing')).text();
    expect(html, 'billing deep-link must never be server-rendered').not.toContain('/admin/org/billing');
    expect(html).toContain('Sign In');
  });
});

test.describe('R11 — acquisition chrome leaves an operator\'s everyday bar (audit D6 family)', () => {
  // Owner-directed 2026-08-01, logged in BUSINESS_DECISIONS ("Acquisition chrome is for
  // PROSPECTS"): a permanent sales link in the chrome of someone who already operates here reads
  // as being marketed to inside a tool they've adopted. Prospects keep BOTH doors — Pricing is the
  // research door, the persona menu is the action door, and that pairing was ratified separately.
  test('a workspace-holder sees neither Pricing nor "Run a tournament" on the consumer strip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/discover', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const strip = page.locator('#consumer-topbar');
    await expect(strip).toBeVisible();
    await expect(strip.getByRole('link', { name: /^Pricing$/i })).toHaveCount(0);
    await expect(strip.getByRole('button', { name: /run a tournament/i })).toHaveCount(0);
    // …but their own operator door is still there. Removing the sales links must not leave the
    // utility cluster empty — that would be a regression, not a simplification.
    await expect(strip.locator('a, button').filter({ hasText: /workspaces|admin area|coaches portal/i }).first()).toBeVisible();
  });

  test('an anonymous prospect keeps both doors — ratified chrome, unchanged', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/discover', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const strip = page.locator('#consumer-topbar');
    await expect(strip.getByRole('link', { name: /^Pricing$/i })).toBeVisible();
    await expect(strip.getByRole('button', { name: /run a tournament/i })).toBeVisible();
    await ctx.close();
  });
});
