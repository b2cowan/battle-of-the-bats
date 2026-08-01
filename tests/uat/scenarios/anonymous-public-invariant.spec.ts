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
 * ⚠ WHAT THE RULE DOES *NOT* FORBID (D1, owner ruling 2026-08-01): org public pages now carry the
 * app's bottom bar on PHONE widths. That is new anonymous DOM, and it is deliberate — the rule
 * bans identity-DERIVED chrome and new identity round-trips, not owner-approved public navigation.
 * The bar is state-based exactly like the tournament bar: signed-out renders Home/Scores/Sign In,
 * never Account or an operator door. The assertions below are written to hold either way, so they
 * still catch a real leak; the D1 additions are pinned separately at the bottom of the file.
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
/** A tournament-tier public org: no public-site module, so no Stage F tab row — the surface where
 *  the Stage E crumb is still the wayfinding device. */
const TOURNAMENT_TIER_ORG = '/free-test-org';

/** Requests that resolve WHO the visitor is. None may fire for a signed-out visitor. */
const IDENTITY_PATTERNS = [
  '/api/me/',
  '/api/consumer/home',
  '/role-summary',
  '/tournament-viewer',
  '/hats',
  '/workspaces',
  // Reachable from the D1 bottom bar's badges. Both are signed-in-gated today; listing them is what
  // makes this guard able to NOTICE if that gate is ever dropped on the surface D1 just widened.
  '/api/chat/unread',
  '/api/consumer/invites/count',
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
    // Deliberately a TOURNAMENT-tier org: Stage F gave League/Club a section tab row, and where
    // that row renders the crumb retires (one wayfinding device per page). The crumb is now the
    // answer for exactly these tier-less pages — so this is where its behaviour is pinned.
    await page.goto(`${TOURNAMENT_TIER_ORG}/archives`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
    // Present without sign-in is the point: the crumb is public wayfinding, not operator chrome.
    await expect(page.locator('nav').getByText('Archives', { exact: true }).first()).toBeVisible();
  });

  test('the org name at depth is a real link back to the org root', async ({ page }) => {
    await page.goto(`${TOURNAMENT_TIER_ORG}/archives`, { waitUntil: 'networkidle' });
    const home = page.locator(`nav a[href="${TOURNAMENT_TIER_ORG}"]`).first();
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

test.describe('D1 — the phone frame on org public pages (owner ruling 2026-08-01)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a PHONE gets the app bottom bar, state-based for a signed-out visitor', async ({ page }) => {
    await page.goto(ORG, { waitUntil: 'networkidle' });
    const bar = page.getByRole('navigation', { name: 'Primary' });
    await expect(bar).toBeVisible();
    // Browsable tabs only — Chat and Account are sign-in walls, collapsed into one door.
    await expect(bar.getByRole('link', { name: /Home/i })).toBeVisible();
    await expect(bar.getByRole('link', { name: /Scores/i })).toBeVisible();
    await expect(bar.getByRole('link', { name: /Sign In/i })).toBeVisible();
    await expect(bar.getByRole('link', { name: /^Account$/i })).toHaveCount(0);
    await expect(bar.getByRole('link', { name: /^Chat$/i })).toHaveCount(0);
  });

  test('the bar reaches the org\'s deeper public sections too', async ({ page }) => {
    await page.goto(`${ORG}/league`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });

  test('it stays OFF operator shells — those own their own chrome', async ({ page }) => {
    // Signed out, an admin route redirects to login; assert on wherever we land, which must
    // never be an org public page wearing the bar.
    await page.goto(`${ORG}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain(`${ORG}/admin`);
  });

  test('adding the bar did NOT add an identity round-trip', async ({ page }) => {
    const requests = await recordRequests(page, ORG);
    expect(requests.filter(isIdentityRequest), 'identity requests on a phone org page').toEqual([]);
  });
});

test.describe('D1 — desktop is deliberately untouched (no platform strip on a club page)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('no FieldLogicHQ wordmark above the club\'s own identity row', async ({ page }) => {
    await page.goto(ORG, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    // The parity option would have sandwiched the club between two platform bars. It was ruled
    // out; a second wordmark appearing here is that ruling silently reversing.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
  });
});

test.describe('Stage F — the org section tabs', () => {
  test('a club with sections gets a tab row, and the crumb steps aside', async ({ page }) => {
    await page.goto(ORG, { waitUntil: 'networkidle' });
    const tabs = page.getByRole('navigation', { name: 'Sections' });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Home' })).toBeVisible();
    // One wayfinding device per page: where the row renders, the Stage E crumb is hidden.
    await expect(page.locator('nav').getByText('›', { exact: true })).toBeHidden();
  });

  test('the active tab follows the section, at any depth', async ({ page }) => {
    await page.goto(`${ORG}/league`, { waitUntil: 'networkidle' });
    const tabs = page.getByRole('navigation', { name: 'Sections' });
    await expect(tabs.getByRole('link', { name: 'League' })).toHaveAttribute('aria-current', 'page');
    await expect(tabs.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current', 'page');
  });

  test('tournament-tier orgs get NO tab row (they keep the crumb instead)', async ({ page }) => {
    // free-test-org is a tournament-plan org — no public-site module, so no section row.
    await page.goto('/free-test-org', { waitUntil: 'networkidle' });
    await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
  });

  test('the row carries no identity — it is safe in SW-cached anonymous HTML', async ({ request }) => {
    const html = await (await request.get(ORG)).text();
    expect(html).toContain('Sections');            // server-rendered, so no post-hydration jump
    for (const marker of ['Admin Area', 'Workspaces', '⇄']) {
      expect(html, `${marker} must not ride the section row`).not.toContain(marker);
    }
  });
});
