/**
 * Practice Plans 1b — field run screen layout probes.
 *
 * BINDING METHOD: read COMPUTED STYLES and real geometry, never eyeball a screenshot (a screenshot
 * pass has produced the wrong fix twice in this portal).
 *
 * This screen deliberately departs from the portal's usual density, and the probes exist to hold
 * those departures rather than let a later sweep "tidy" them back:
 *   · the primary control is ≥56px, well ABOVE the 44px `--tap-min` floor
 *   · the block title is the largest type in the product (~28–32px)
 *   · the clock is tabular numerals, so the digits don't dance while it counts
 *   · the page never scrolls sideways at 361px
 *
 * Seed the fixture first (it is idempotent, and it prints the id):
 *   node scripts/seed-uat-coach-fixture.mjs
 *   PROBE_EVENT_ID=<id> npx playwright test --config playwright.config.ts -g "field run screen"
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

/**
 * ⚠ THE COACH SESSION, EXPLICITLY. The `uat` Playwright project defaults every spec to the
 * ORG-OWNER session, who holds no coaching assignment — so a coach-portal spec that forgets this
 * line lands on "Not assigned to any teams" and fails in a way that looks like a product bug.
 * That is half of why the practice-plan probes never ran during slice 1a. (The other half was a
 * missing `organization_members` row; see scripts/seed-uat-coach-fixture.mjs.)
 */
test.use({ storageState: path.join(__dirname, '..', '.auth', 'coach.json') });

const SLUG = 'uat-test-org';
const TEAM = '3127a094-458f-4b78-8726-17342a8e37a6';
const EVENT = process.env.PROBE_EVENT_ID ?? '';

const runUrl = () => `/${SLUG}/coaches/teams/${TEAM}/practice/${EVENT}/run`;

const WIDTHS = [
  { name: '361 (narrowest phone)', width: 361, height: 780 },
  { name: '390 (iPhone)', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

/**
 * Open the run screen AND rewind it to the first block.
 *
 * ⚠ The rewind is what makes these probes deterministic. The screen deliberately opens on whichever
 * block the planned clock says is running NOW, so a fixture seeded an hour ago lands on the last
 * block — where the primary control is a "Back to the plan" link rather than the Next block/Rotate
 * now button the probes measure. Rewinding to step 0 means the assertions read the same screen
 * whatever the wall clock says, without the spec having to write to the database.
 */
async function openRun(page: Page) {
  await page.goto(runUrl(), { waitUntil: 'domcontentloaded' });
  // The screen resolves its world in one fetch; the block title is the last thing to land.
  await expect(page.locator('h1')).toBeVisible({ timeout: 45_000 });

  const back = page.getByRole('button', { name: 'Back', exact: true });
  for (let i = 0; i < 30; i++) {
    if (await back.count() === 0 || await back.isDisabled()) break;
    await back.click();
  }
  await expect(back).toBeDisabled();
}

test.describe('Practice Plans 1b — field run screen', () => {
  test.skip(!EVENT, 'PROBE_EVENT_ID not supplied — run scripts/seed-uat-coach-fixture.mjs first');

  for (const vp of WIDTHS) {
    test(`no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openRun(page);

      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollW, `page scrolls sideways at ${vp.width}px`)
        .toBeLessThanOrEqual(overflow.clientW + 1);
    });

    test(`the primary control clears 56px at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openRun(page);

      // "Next block" / "Rotate now" — whichever the cursor is on. Read the RESOLVED box, not the
      // declared min-height, so a padding or line-height change can't quietly shrink it.
      const primary = page.getByRole('button', { name: /Rotate now|Next block/ });
      await expect(primary).toBeVisible();
      const box = await primary.boundingBox();
      expect(box, 'primary control has no box').not.toBeNull();
      expect(box!.height, 'primary control fell below the 56px field minimum')
        .toBeGreaterThanOrEqual(56);

      // The one filled control must be INK, never lime — lime fails in sunlight and is reserved
      // for conversion (design ruling 2026-07-30).
      const bg = await primary.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(bg, 'primary control is transparent — the ink fill was lost').not.toBe('rgba(0, 0, 0, 0)');
    });

    test(`the block title is the largest type on the screen at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openRun(page);

      const sizes = await page.evaluate(() => {
        const px = (el: Element | null) => (el ? parseFloat(getComputedStyle(el).fontSize) : 0);
        const h1 = document.querySelector('h1');
        // The clock is the only thing allowed to rival it, and it is data, not prose.
        const body = parseFloat(getComputedStyle(document.body).fontSize);
        return { title: px(h1), body };
      });
      // ~28–32px is the spec. Allow the clamp's floor at the narrowest width.
      expect(sizes.title, 'block title is too small to read at arm’s length')
        .toBeGreaterThanOrEqual(27.5);
      expect(sizes.title, 'block title has grown past the intended scale').toBeLessThanOrEqual(34);
      expect(sizes.title).toBeGreaterThan(sizes.body);
    });

    test(`the clock uses tabular numerals at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openRun(page);

      // A proportional clock jitters every second, which is exactly what a coach glancing at it
      // cannot tolerate.
      const variant = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('p'))
          .find(p => /^\+?\d+:\d{2}(:\d{2})?$/.test(p.textContent?.trim() ?? ''));
        return el ? getComputedStyle(el).fontVariantNumeric : null;
      });
      expect(variant, 'no clock found on the run screen').not.toBeNull();
      expect(variant, 'the clock lost tabular numerals').toContain('tabular-nums');
    });
  }

  test('every control still clears the 44px tap floor at 361', async ({ page }) => {
    await page.setViewportSize({ width: 361, height: 780 });
    await openRun(page);

    // ⚠ Scoped to THIS SCREEN's own container. Unscoped, the query also picks up the shell — the
    // global "Skip to content" link and the bottom nav — and fails this feature for chrome it does
    // not own. (Same trap the frozen-season spec documents: scope to the coaches main, not <body>.)
    const short = await page.evaluate(() => {
      const root = document.querySelector('[class*="ppRunPage"]');
      if (!root) return [{ label: 'RUN SCREEN DID NOT RENDER', h: -1 }];
      const bad: { label: string; h: number }[] = [];
      for (const el of Array.from(root.querySelectorAll('button, a[href], summary'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 44) {
          bad.push({ label: (el.textContent ?? el.getAttribute('aria-label') ?? '?').trim().slice(0, 40), h: Math.round(r.height) });
        }
      }
      return bad;
    });
    expect(short, `controls below the 44px floor: ${JSON.stringify(short)}`).toEqual([]);
  });

  test('nothing on this screen writes — the run issues only a GET', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // ⚠ D4 is the rule this feature would be most damaged by breaking, so it is probed at the
    // network layer rather than trusted to a code read: no method other than GET may leave this
    // screen, including while the coach taps through every block and rotation round.
    const writes: string[] = [];
    page.on('request', req => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) writes.push(`${req.method()} ${req.url()}`);
    });

    await openRun(page);
    // Walk the whole practice — every "Rotate now" / "Next block" the fixture offers.
    for (let i = 0; i < 8; i++) {
      const primary = page.getByRole('button', { name: /Rotate now|Next block/ });
      if (await primary.count() === 0) break;
      await primary.first().click();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(600);

    expect(writes, `the field screen issued a write: ${writes.join(', ')}`).toEqual([]);
  });
});
