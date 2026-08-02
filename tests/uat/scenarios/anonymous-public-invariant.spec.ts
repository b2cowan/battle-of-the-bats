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
 * ⚠ WHERE THE CHUNK D SURFACES ARE COVERED: the two new anonymous public surfaces — the shared
 * rep-team game page and the standing public team schedule — are asserted for this same
 * invariant in `family-access-boundary.spec.ts`, not here. They are deliberately NOT added to
 * the fixed-URL lists below because both only EXIST once a coach has shared a game / set the
 * team to Public link, so they need provisioned fixtures rather than a static dev URL. That
 * file checks the same two things this one does — no identity in the SSR HTML, no PII — plus
 * the share and visibility gates that make the pages exist at all.
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

test.describe('R1 — no navigation door may land on a 404 org home (top-nav audit D1)', () => {
  // dev-test-org has its "public page" toggle OFF, so /dev-test-org 404s. Its event pages used to
  // link there anyway from the desktop rail crumb and the phone eyebrow, because the shared
  // predicate checked entitlements but not the toggle. Both halves now live in the predicate.
  const PRIVATE_ORG = '/dev-test-org';

  test('the org home really is a 404 — the fixture still reproduces the condition', async ({ request }) => {
    expect((await request.get(PRIVATE_ORG)).status()).toBe(404);
  });

  test('the SERVER HTML of its event page carries no anchor to the org home', async ({ request }) => {
    const html = await (await request.get(TOURNAMENT)).text();
    // Match the href attribute exactly so a longer path under the org (an event link) never
    // counts as a hit.
    expect(html, 'SSR anchor to a 404 org home').not.toMatch(/href="\/dev-test-org\/?"/);
  });

  for (const [label, width] of [['desktop', 1440], ['phone', 390]] as const) {
    test(`the HYDRATED event page renders no door to it (${label})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(TOURNAMENT, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const doors = await page.locator(`a[href="${PRIVATE_ORG}"], a[href="${PRIVATE_ORG}/"]`).count();
      expect(doors, `${label}: doors to a 404 org home`).toBe(0);
    });
  }

  test('an org whose home IS real keeps its door — the fix hides dead links, not live ones', async ({ page }) => {
    // ORG is a League-tier org with the public-site module, so its home renders. Its own event
    // chrome must still offer the way up; a blanket removal would have been the other bug.
    await page.goto(ORG, { waitUntil: 'networkidle' });
    expect(page.url()).toContain(ORG);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('R3 + R5 — the marketing bar joins the system (top-nav audit D3/D11)', () => {
  test('at 820px exactly ONE nav set renders — the 768-900 double-nav band is closed', async ({ page }) => {
    // iPad portrait is 768. Between Tailwind's default `md:` (768) and the platform breakpoint
    // (900) the desktop cluster AND the mobile bottom link bar both rendered: the same five links
    // twice, the wordmark colliding with "TOURNAMENTS", and "SIGN IN" wrapped over two lines.
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const pricingLinks = page.locator('nav a[href="/pricing"]:visible');
    expect(await pricingLinks.count(), 'visible Pricing links in the chrome at 820px').toBe(1);
  });

  test('the desktop cluster returns above the platform breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    // Desktop shows the top cluster; the bottom link bar is hidden by the same 900px rule.
    expect(await page.locator('nav a[href="/pricing"]:visible').count()).toBe(1);
  });

  test('the bar is the ratified height and shares its own pages\' column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => {
      const inner = document.querySelector('nav .container') as HTMLElement | null;
      const pageCol = document.querySelector('main .container') as HTMLElement | null;
      const root = getComputedStyle(document.documentElement);
      return {
        token: root.getPropertyValue('--marketing-bar-h').trim(),
        barHeight: inner ? Math.round(inner.getBoundingClientRect().height) : null,
        barLeft: inner ? Math.round(inner.getBoundingClientRect().left) : null,
        pageLeft: pageCol ? Math.round(pageCol.getBoundingClientRect().left) : null,
      };
    });
    expect(m.token, 'the marketing bar height has ONE home').toBe('64px');
    expect(m.barHeight).toBe(64);
    // D11's measured 24px stagger: the bar used a 1152px column while its own pages use 1200px.
    expect(m.barLeft, 'bar column left edge').toBe(m.pageLeft);
  });
});

test.describe('R6 — League pages share the column their own tab row aligns to (audit D5)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // The Stage F tab row wears the shared 1200px `.container` SPECIFICALLY to match the identity
  // row above it. These pages centred their own 560-800px columns on the raw viewport instead —
  // measured 244-304px of left-edge stagger between the navigation and the content it navigates.
  for (const [label, path] of [
    ['League index', `${ORG}/league`],
  ] as const) {
    test(`${label}: the tab row and the first heading share a left edge`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const tabs = document.querySelector('nav[aria-label="Sections"] a');
        const heading = document.querySelector('main h1, h1');
        return {
          tabLeft: tabs ? Math.round(tabs.getBoundingClientRect().left) : null,
          headingLeft: heading ? Math.round(heading.getBoundingClientRect().left) : null,
        };
      });
      expect(m.tabLeft, 'tab row left edge').not.toBeNull();
      expect(m.headingLeft, 'content heading left edge').not.toBeNull();
      expect(
        Math.abs((m.headingLeft ?? 0) - (m.tabLeft ?? 0)),
        `stagger between the section row and the page it navigates (tab ${m.tabLeft} vs heading ${m.headingLeft})`,
      ).toBeLessThanOrEqual(8);
    });
  }
});

test.describe('T1 — one nav-label spec and one pill height across the bars', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the tokens exist and carry the ratified values', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const t = await page.evaluate(() => {
      const r = getComputedStyle(document.documentElement);
      return {
        size: r.getPropertyValue('--nav-label-size').trim(),
        weight: r.getPropertyValue('--nav-label-weight').trim(),
        tracking: r.getPropertyValue('--nav-label-tracking').trim(),
        pill: r.getPropertyValue('--nav-pill-h').trim(),
        iconDoor: r.getPropertyValue('--icon-door-size').trim(),
      };
    });
    // The CSS parser strips a leading zero, so `0.78rem` reads back as `.78rem`.
    const norm = (v: string) => (v.startsWith('.') ? `0${v}` : v);
    expect(norm(t.size)).toBe('0.78rem');
    expect(t.weight).toBe('600');
    expect(norm(t.tracking)).toBe('0.03em');
    // A pill and an icon door share a row, so they share one silhouette.
    expect(t.pill).toBe(t.iconDoor);
  });

  test('marketing and the org identity row now render the SAME nav label', async ({ page }) => {
    const specOf = async (selector: string) => {
      const el = page.locator(selector).first();
      return el.evaluate(n => {
        const cs = getComputedStyle(n);
        return `${cs.fontSize}/${cs.fontWeight}/${cs.letterSpacing}`;
      });
    };
    await page.goto('/', { waitUntil: 'networkidle' });
    const marketing = await specOf('nav a[href="/pricing"]');
    await page.goto(ORG, { waitUntil: 'networkidle' });
    const orgRow = await specOf('nav a[href="/pricing"]');
    expect(marketing, 'marketing nav label').toBe('12.48px/600/0.3744px');
    expect(orgRow, 'org identity row nav label').toBe(marketing);
  });
});
