/**
 * The anonymous-public invariant (NAV_UNIFICATION_PLAN §5 · NAVIGATION_MODEL_PLAN §Q5).
 *
 * THE RULE: an anonymous visitor's page must render, fetch and weigh the same after a navigation
 * change as before it — zero new identity round-trips, zero role-tied DOM, and role UI resolved
 * only client-side after hydration so the service worker's cached HTML stays role-free.
 *
 * Every nav stage that touches a public surface has to go green here before it ships, so this is
 * written as a STANDING regression guard rather than a one-off Stage E check: the assertions are
 * about the invariant, not about any one stage's diff.
 *
 * Runs signed-OUT — the file overrides the suite's default org-owner session.
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

/** Dev fixtures. Both org pages are REAL destinations (League/Club tier → public-site module), so
 *  they render rather than redirecting; the tournament page is the SW-cached high-traffic surface. */
const ORG = '/dev-league-org';
const CLUB_ORG = '/dev-club-org';
const TOURNAMENT = '/dev-test-org/live-demo';

/** Requests that resolve WHO the visitor is. None may fire for a signed-out visitor. */
const IDENTITY_PATTERNS = [
  '/api/me/',
  '/api/consumer/home',
  '/role-summary',
  '/tournament-viewer',
  '/hats',
  '/workspaces',
];

function isIdentityRequest(url: string): boolean {
  return IDENTITY_PATTERNS.some(p => url.includes(p));
}

/** Collect every request URL the page makes, from before navigation until settled. */
async function recordRequests(page: Page, path: string): Promise<string[]> {
  const seen: string[] = [];
  page.on('request', r => seen.push(r.url()));
  await page.goto(path, { waitUntil: 'networkidle' });
  // Identity work is deliberately post-hydration, so a networkidle snapshot alone could miss a
  // late round-trip. Give any such call a window to appear before asserting it never came.
  await page.waitForTimeout(1500);
  return seen;
}

test.describe('Q5.1 — network parity: no identity round-trips for anonymous visitors', () => {
  for (const [label, path] of [
    ['marketing', '/'],
    ['consumer app', '/discover'],
    ['org home', ORG],
    ['org league section', `${ORG}/league`],
    ['tournament page', TOURNAMENT],
  ] as const) {
    test(`${label} fires zero identity requests`, async ({ page }) => {
      const requests = await recordRequests(page, path);
      expect(requests.filter(isIdentityRequest), `identity requests on ${path}`).toEqual([]);
    });
  }
});

test.describe('Q5.2 — DOM parity: no role-tied nodes render for anonymous visitors', () => {
  for (const [label, path] of [
    ['org home', ORG],
    ['org league section', `${ORG}/league`],
    ['club org home', CLUB_ORG],
  ] as const) {
    test(`${label} shows no operator door`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // let any post-hydration control mount

      // The flip pill (⇄) and the Workspaces chooser are the two role-tied controls this surface
      // can grow. Neither may exist for a fan.
      await expect(page.getByRole('link', { name: /⇄/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /⇄/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /workspaces/i })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /^Admin Area$/i })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /^Coaches Portal$/i })).toHaveCount(0);

      // The fan-facing corner is unchanged: a signed-out visitor gets Sign In, never Account.
      await expect(page.getByRole('link', { name: /^Sign In$/i }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /^Account$/i })).toHaveCount(0);
    });
  }
});

test.describe('Q5.4 — SW-cache invariant: server HTML carries no role branching', () => {
  for (const [label, path] of [
    ['org home', ORG],
    ['org league section', `${ORG}/league`],
    ['tournament page', TOURNAMENT],
  ] as const) {
    test(`${label} SSR payload is role-free`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      // These strings only exist inside role-resolved chrome. Any of them in the SERVER payload
      // means identity was baked into HTML the service worker caches as the anonymous variant.
      for (const marker of ['Admin Area', 'Workspaces', 'All workspaces', '⇄']) {
        expect(html, `${marker} must not be server-rendered on ${path}`).not.toContain(marker);
      }
    });
  }
});

test.describe('Stage E.1 — the Discover beacon fires on CLICK, never on render', () => {
  test('no beacon request on an anonymous org page load', async ({ page }) => {
    const requests = await recordRequests(page, ORG);
    expect(requests.filter(u => u.includes('/api/client/nav-beacon'))).toEqual([]);
  });

  test('clicking Discover sends exactly one beacon', async ({ page }) => {
    const beacons: string[] = [];
    page.on('request', r => {
      if (r.url().includes('/api/client/nav-beacon')) beacons.push(r.url());
    });
    await page.goto(ORG, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /^Discover$/i }).first().click();
    await page.waitForTimeout(1000);
    expect(beacons.length, 'one beacon per Discover click').toBe(1);
  });
});

test.describe('Stage E.3 — the section crumb is URL-derived, not role-derived', () => {
  test('the org root keeps its plain identity — no crumb', async ({ page }) => {
    await page.goto(ORG, { waitUntil: 'networkidle' });
    await expect(page.locator('nav').getByText('›', { exact: true })).toHaveCount(0);
  });

  test('a section one level in shows its crumb to an ANONYMOUS visitor', async ({ page }) => {
    await page.goto(`${ORG}/league`, { waitUntil: 'networkidle' });
    // Present without sign-in is the point: the crumb is public wayfinding, not operator chrome.
    await expect(page.locator('nav').getByText('League', { exact: true }).first()).toBeVisible();
  });

  test('the org name at depth is a real link back to the org root', async ({ page }) => {
    await page.goto(`${ORG}/league`, { waitUntil: 'networkidle' });
    const home = page.locator(`nav a[href="${ORG}"]`).first();
    await expect(home).toBeVisible();
  });
});

test.describe('Stage E.4 — the sitemap only lists org pages that really render', () => {
  test('real destinations are in; redirecting/placeholder orgs are not', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    const origin = new URL((await request.get('/')).url()).origin;

    // League/Club tier → owns the public-site module → the page always renders.
    expect(xml).toContain(`<loc>${origin}${ORG}</loc>`);
    expect(xml).toContain(`<loc>${origin}${CLUB_ORG}</loc>`);

    // A tournament-tier org with ONE active event redirects into that event — linking a crawler
    // there is a loop, so it must never be emitted.
    expect(xml).not.toContain(`<loc>${origin}/free-test-org</loc>`);
    // A tournament-tier org with NO active events renders the platform placeholder — a dead end.
    expect(xml).not.toContain(`<loc>${origin}/test-minor-softball</loc>`);
  });
});
