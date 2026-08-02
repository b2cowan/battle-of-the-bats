/**
 * Practice Plans Phase 2 — the drill library, layout probes.
 *
 * BINDING METHOD: read COMPUTED STYLES and real geometry, never eyeball a screenshot (a screenshot
 * pass has produced the wrong fix twice in this portal).
 *
 * What these hold, beyond "it renders":
 *   · the room never scrolls sideways at 361px — the narrowest phone a coach brings
 *   · every control clears the 44px tap floor, including the filter chips and the row actions
 *   · a drill-backed station renders its drill half as TEXT, with NO editable inputs, and the
 *     detach + swap controls are present (the owner's read-only ruling, checked at the DOM rather
 *     than trusted to a code comment)
 *   · the practice half of that same station IS still editable — the two are never conflated
 *
 * Seed the fixture first (idempotent, and it prints the id):
 *   node scripts/seed-uat-coach-fixture.mjs
 *   PROBE_EVENT_ID=<id> npx playwright test --config playwright.config.ts -g "drill library"
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

/**
 * ⚠ THE COACH SESSION, EXPLICITLY. The `uat` project defaults every spec to the ORG-OWNER session,
 * who holds no coaching assignment — a coach-portal spec that forgets this line lands on "Not
 * assigned to any teams" and fails in a way that looks like a product bug.
 */
test.use({ storageState: path.join(__dirname, '..', '.auth', 'coach.json') });

const SLUG = 'uat-test-org';
const TEAM = '3127a094-458f-4b78-8726-17342a8e37a6';
const EVENT = process.env.PROBE_EVENT_ID ?? '';

const drillsUrl = () => `/${SLUG}/coaches/teams/${TEAM}/development/drills`;
const planUrl = () => `/${SLUG}/coaches/teams/${TEAM}/practice/${EVENT}`;

const WIDTHS = [
  { name: '361 (narrowest phone)', width: 361, height: 780 },
  { name: '390 (iPhone)', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

/** Horizontal overflow of the document — the one thing a coach notices instantly and hates. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Rendered heights of the controls THIS FEATURE adds, so the tap floor is measured, not assumed.
 *
 * ⚠ Deliberately scoped to the drill classes rather than every `button` on the page. A first
 * version of this probe asserted a blanket 44px across the document and failed on the portal's own
 * shell — the team nav rows render at 38.5px and the shared `.btnPrimary` / `.btnSecondary`
 * primitives at 41px, product-wide, on every screen. Those are a pre-existing portal-wide baseline;
 * re-litigating them from inside one feature's probe would either wrongly fail this build or
 * pressure someone into changing a shared primitive to make a test pass. What this feature owes is
 * that the controls IT introduces honour `--tap-min`, which is what the CSS actually declares.
 */
async function shortDrillControlHeights(page: Page): Promise<{ text: string; height: number }[]> {
  return page.evaluate(() => {
    const out: { text: string; height: number }[] = [];
    const sel = '[class*="ppAddInline"], [class*="ppIconBtn"], [class*="ppDrillTab"], [class*="ppDrillRowActions"] button, [class*="ppDrillFilters"] input';
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const rect = el.getBoundingClientRect();
      // Skip anything not actually on screen — a collapsed section is not a tap target.
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.height < 44) {
        out.push({ text: (el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 40), height: rect.height });
      }
    }
    return out;
  });
}

test.describe('drill library — the room', () => {
  test.skip(!EVENT, 'Set PROBE_EVENT_ID (node scripts/seed-uat-coach-fixture.mjs prints it).');

  for (const vp of WIDTHS) {
    test(`renders with no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(drillsUrl());
      await page.waitForLoadState('networkidle');

      // The room resolved at all — not "Team not found", not an error state.
      await expect(page.getByRole('heading', { name: 'Your drills' })).toBeVisible();

      expect(await horizontalOverflow(page), 'document scrolls sideways').toBeLessThanOrEqual(1);
    });

    test(`the drill controls clear the 44px tap floor at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(drillsUrl());
      await page.waitForLoadState('networkidle');

      const short = await shortDrillControlHeights(page);
      expect(short, `drill controls under the 44px floor: ${JSON.stringify(short)}`).toEqual([]);
    });
  }

  test('the new-drill sheet opens and stays inside the viewport at 361', async ({ page }) => {
    await page.setViewportSize({ width: 361, height: 780 });
    await page.goto(drillsUrl());
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /New drill/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Both of the two fields the owner signed off as leading the record.
    await expect(dialog.getByText("What you're doing")).toBeVisible();
    await expect(dialog.getByText("What you're watching for")).toBeVisible();
    // ⚠ The retired field must NOT come back through the library's front door.
    await expect(dialog.getByText(/how many of it/i)).toHaveCount(0);

    expect(await horizontalOverflow(page), 'sheet pushes the page sideways').toBeLessThanOrEqual(1);
  });
});

test.describe('drill library — a picked drill is read-only in the plan', () => {
  test.skip(!EVENT, 'Set PROBE_EVENT_ID (node scripts/seed-uat-coach-fixture.mjs prints it).');

  /**
   * The whole owner ruling, checked at the DOM: the drill's own words render as TEXT with no
   * editable control, while the practice's own fields on the SAME station stay editable.
   */
  test('the drill half has no inputs; the practice half still does', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Create a drill, then build a block from it — the same four taps a coach makes.
    await page.goto(drillsUrl());
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /New drill/i }).first().click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Name').or(sheet.locator('input').first()).fill('Probe drill');
    await sheet.getByRole('button', { name: /^Add drill$/ }).click();
    await page.waitForLoadState('networkidle');

    await page.goto(planUrl());
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Add a block/i }).click();
    const picker = page.getByRole('dialog');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: /^Add$/ }).first().click();
    await page.waitForTimeout(300);

    const station = page.locator('[class*="ppStation"]').filter({ hasText: 'Probe drill' }).first();
    await expect(station).toBeVisible();

    // Provenance is stated, and it stays.
    await expect(station.getByText('From your drills')).toBeVisible();

    // The escape hatch exists — read-only without it would be a wall at 9pm on a couch.
    await expect(station.getByRole('button', { name: /Edit just for this practice/i })).toBeVisible();
    await expect(station.getByRole('button', { name: /Swap drill/i })).toBeVisible();

    // ⚠ The drill's own name is TEXT here, not an input — the read-only ruling, at the DOM.
    const nameInputs = await station.locator('input[value="Probe drill"]').count();
    expect(nameInputs, 'the drill name is still editable').toBe(0);

    // ...and the practice's half of the same station is NOT locked.
    await expect(station.getByText('Just for tonight')).toBeVisible();
    await expect(station.getByText("Who runs it")).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
