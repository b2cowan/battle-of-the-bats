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
 *   · the page never scrolls sideways at 361px
 *   · the list it opens on (stage 7): block rows 56, station rows 44, every row a door, no clock
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
 * Open the run screen — the LIST (stage 7, W1: Run practice opens on the plan as a list, any day,
 * nothing remembered) — and resolve its rows.
 */
async function openList(page: Page) {
  await page.goto(runUrl(), { waitUntil: 'domcontentloaded' });
  // The screen resolves its world in one fetch; the practice's name is the last thing to land.
  await expect(page.locator('h1')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-testid="run-outline"] [data-face="block"]').first()).toBeVisible();
}

/**
 * Open the run screen AND land on the first block.
 *
 * ⚠ The list is what makes these probes deterministic (it used to be a rewind through Back): the
 * screen opens on the same list whatever the wall clock says, and the first row is the warm-up —
 * a plain stop with the Next block button the probes measure, without the spec writing anything.
 */
async function openRun(page: Page) {
  await openList(page);
  await page.locator('[data-testid="run-outline"] [data-face="block"]').first().click();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  await expect(page.locator('h1')).toHaveText(/warm-up/i);
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

    /* ⚰ "the clock uses tabular numerals" is DELETED (stage 7, on the way past): the field has no
       clock since P10 (2026-09-17) and no "Planned for" face either, so the probe had been failing
       against a screen that was right. The no-clock rule is held by practice-vocabulary-guard. */
    test(`nothing on the screen reads as a clock at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openRun(page);
      const clocks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="ppRunPage"] p'))
          .map(p => p.textContent?.trim() ?? '')
          .filter(t => /^\+?\d+:\d{2}(:\d{2})?$/.test(t)));
      expect(clocks, 'a counter is back on the field').toEqual([]);
    });
  }

  /**
   * Stage 5 (P7): a rotating stop is ONE list keyed by station — each row the door — and the rows
   * hold the screen's own floor: 56px for the rotation's rows (the letter column at arm's length),
   * 44px for a station list's. Read the DECLARED minimum and the resolved box, so a padding change
   * cannot quietly shrink a row below what the field needs.
   */
  test('the rotation\'s station rows clear 56px — one row per station, the row is the door', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRun(page);
    // The fixture's first block is the warm-up (a plain stop); the circuit is next.
    await page.getByRole('button', { name: 'Next block' }).click();
    await expect(page.locator('h1')).toHaveText(/circuit/i);

    const rows = page.locator('[class*="ppRunRow"][data-face="rotation"]');
    await expect(rows).toHaveCount(3, { timeout: 10_000 });
    for (let i = 0; i < 3; i++) {
      const row = rows.nth(i);
      const declared = await row.evaluate(el => parseFloat(getComputedStyle(el).minHeight));
      expect(declared, `row ${i} declares a floor below 56px`).toBeGreaterThanOrEqual(56);
      const box = await row.boundingBox();
      expect(box!.height, `row ${i} rendered below 56px`).toBeGreaterThanOrEqual(56);
      await expect(row).toHaveAttribute('data-face', 'rotation');
    }
    // No second list saying the same names again (the old Stations list) — on a rotating stop the
    // station-face rows do not render at all.
    await expect(page.locator('[class*="ppRunRow"][data-face="station"]')).toHaveCount(0);
    await expect(page.getByText('Stations', { exact: true })).toHaveCount(0);
    // The row is the door: tapping it opens that station.
    await rows.nth(1).click();
    await expect(page.getByRole('button', { name: 'All stations' })).toBeVisible();
  });

  /**
   * Stage 7 (W1–W4): Run practice opens on the plan as a LIST — one row per block with the plan's
   * length, the block's stations as rows beneath it, every row a door, the reader's own rows
   * marked — and the block screen's Back goes to the list, not the plan.
   */
  test('the list is the first screen — block rows at 56, station rows at 44, every row a door', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openList(page);

    // The fixture's three blocks, in order, with the plan's length on the right — never a clock.
    const blockRows = page.locator('[data-testid="run-outline"] [data-face="block"]');
    await expect(blockRows).toHaveCount(3);
    await expect(blockRows.nth(0)).toContainText(/warm-up/i);
    await expect(blockRows.nth(0)).toContainText('15 min');
    await expect(blockRows.nth(1)).toContainText('3 rounds');
    await expect(blockRows.nth(2)).toContainText('Rest of practice');
    await expect(page.locator('[data-testid="run-outline"]')).not.toContainText(/\d{1,2}:\d{2}/);
    for (let i = 0; i < 3; i++) {
      const box = await blockRows.nth(i).boundingBox();
      expect(box!.height, `block row ${i} rendered below 56px`).toBeGreaterThanOrEqual(56);
    }
    // The circuit's stations, as rows under it — 44 each, a door each.
    const stationRows = page.locator('[data-testid="run-outline"] [data-face="station"]');
    await expect(stationRows).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const box = await stationRows.nth(i).boundingBox();
      expect(box!.height, `station row ${i} rendered below 44px`).toBeGreaterThanOrEqual(44);
    }
    // "that's you" rides IDENTITY (mig 303): the fixture seeds free-text names, which mark nothing
    // (decision E) until the coach links them — so the mark is asserted where it appears: a
    // marked row, block or station, always says so.
    const marked = page.locator('[data-testid="run-outline"] [data-mine="mine"]');
    for (let i = 0; i < await marked.count(); i++) await expect(marked.nth(i)).toContainText('that’s you');

    // A station row opens the block WITH that station open — one tap to the station screen.
    await stationRows.nth(0).click();
    await expect(page.getByRole('button', { name: 'All stations' })).toBeVisible();
    // …and its block's Back goes to the list (W4), not the plan.
    await page.getByRole('button', { name: 'All stations' }).click();
    await expect(page.locator('h1')).toHaveText(/circuit/i);
    await page.getByRole('button', { name: 'Blocks' }).click();
    await expect(page.locator('[data-testid="run-outline"]')).toBeVisible();

    // A block row opens that block; Back from the first stop returns to the list.
    await blockRows.nth(0).click();
    await expect(page.locator('h1')).toHaveText(/warm-up/i);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('[data-testid="run-outline"]')).toBeVisible();
  });

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
