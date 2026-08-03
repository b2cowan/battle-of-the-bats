/**
 * Practice Plans Phase 4 — the Staff page's helper controls, layout probes.
 *
 * BINDING METHOD: read COMPUTED STYLES and real geometry, never eyeball a screenshot (a screenshot
 * pass has produced the wrong fix twice in this portal).
 *
 * What this screen gained, and what these probes hold:
 *   · a preset CHOICE above the email field — two option rows that must stack, clear the 44px tap
 *     floor, and keep their description line intact at 361px
 *   · an access card that states what the chosen preset grants, IN THE PAGE rather than in the rail
 *     (design decision 2026-08-03: a reference rail does not exist below the wide breakpoint, and a
 *     head coach on a phone is the one who most needs to read what a stranger will be able to see)
 *   · the page never scrolls sideways at 361px
 *
 * ⚠ WHAT THIS FILE DOES **NOT** COVER, deliberately: the helper's OWN screens (their landing, the
 * quiet states, and the run screen's "who moves everyone on" line). Those render only for a signed-in
 * HELPER, and the UAT harness has one coach fixture who is a HEAD coach — probing them needs a second
 * seeded account with its own storage state, which would change shared UAT infrastructure while other
 * sessions are using it. Those frames rest on owner QA and are listed as such in the QA ledger.
 *
 * Seed the fixture first (idempotent):
 *   node scripts/seed-uat-coach-fixture.mjs
 *   npx playwright test --config playwright.config.ts tests/uat/scenarios/staff-helper-layout.spec.ts
 *
 * ⚠ Run this by FILE PATH, not `-g` — unrelated specs fail at collection with
 * "Cannot find module 'server-only'" and will drown the run.
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
const staffUrl = () => `/${SLUG}/coaches/teams/${TEAM}/staff`;

const WIDTHS = [
  { name: '361 (narrowest phone)', width: 361, height: 780 },
  { name: '390 (iPhone)', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

/** The portal's standing tap floor. The preset rows are whole-card targets, not their 16px radios. */
const TAP_MIN = 44;

async function openStaff(page: Page) {
  await page.goto(staffUrl());
  // The preset legend is the first thing rendered by the new block, so it is the honest ready
  // signal — waiting on the email field would pass even if the choice above it failed to render.
  await expect(page.getByText('Who are you inviting?')).toBeVisible({ timeout: 30_000 });
}

for (const vp of WIDTHS) {
  test.describe(`Staff page · helper controls · ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openStaff(page);
    });

    test('offers both presets, with Helper preselected as the smaller grant', async ({ page }) => {
      const helper = page.getByRole('radio', { name: /Helper/ });
      const assistant = page.getByRole('radio', { name: /Assistant coach/ });
      await expect(helper).toBeVisible();
      await expect(assistant).toBeVisible();
      // Defaulting to the SMALLER grant is deliberate: a head coach who picks without reading gives
      // away less than they meant to, not more.
      await expect(helper).toBeChecked();
    });

    test('every preset row clears the tap floor and keeps its description', async ({ page }) => {
      const rows = page.locator('label:has(input[type="radio"])');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < count; i++) {
        const box = await rows.nth(i).boundingBox();
        expect(box, `preset row ${i} has no box`).not.toBeNull();
        expect(box!.height, `preset row ${i} is under the ${TAP_MIN}px tap floor`).toBeGreaterThanOrEqual(TAP_MIN);
      }
      // The description line is the whole reason these are cards and not a <select>. If it were
      // clipped to zero height the control would still "work" and would still be a guess.
      const desc = page.getByText('Runs a station. Sees the practice, nothing else.');
      await expect(desc).toBeVisible();
      const descBox = await desc.boundingBox();
      expect(descBox!.height).toBeGreaterThan(0);
    });

    test('the preset rows STACK — never side by side', async ({ page }) => {
      const rows = page.locator('label:has(input[type="radio"])');
      const first = await rows.nth(0).boundingBox();
      const second = await rows.nth(1).boundingBox();
      // Vertical stacking means the second row starts at or below the first row's bottom edge.
      expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height - 2);
    });

    test('states what the preset grants IN THE PAGE, including the chat exclusion', async ({ page }) => {
      await expect(page.getByText('What a helper gets')).toBeVisible();
      // The one exclusion a head coach would otherwise assume wrong, and the loudest line on the
      // card. If a later tidy-up drops it, this fails rather than shipping a quieter promise.
      await expect(page.getByText(/helpers are never in it/i)).toBeVisible();
    });

    test('switching to Assistant coach re-states the access card for that preset', async ({ page }) => {
      /**
       * ⚠ RETRIED ON PURPOSE — this is a hydration race in the PROBE, not in the product.
       *
       * The panel is server-rendered, so the radio is visible and clickable before React has
       * attached to it. A click landing in that window sets the DOM's `checked` and is then thrown
       * away when React hydrates and re-renders from its own state, which still says "helper" — so
       * the card never changes and the assertion times out. Running this spec alone always passed
       * (the page was already compiled and hydration beat the click); running it in sequence failed
       * at two widths out of three. That asymmetry is the tell.
       *
       * Polling the click + assertion together waits for the first click that actually reaches
       * React, which is what the test means by "switching the preset". Asserting the click landed
       * would be testing the browser; asserting the card followed is testing the product.
       */
      await expect(async () => {
        await page.getByRole('radio', { name: /Assistant coach/ }).check();
        await expect(page.getByText('What an assistant gets')).toBeVisible({ timeout: 1_000 });
      }).toPass({ timeout: 15_000 });
      await expect(page.getByText('On from the start')).toBeVisible();
      // The label on the email field follows the choice — the two presets are not the same ask.
      await expect(page.getByText(/Assistant’s email/)).toBeVisible();
    });

    test('never scrolls sideways', async ({ page }) => {
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth };
      });
      // 1px of tolerance for sub-pixel rounding; anything more is a real horizontal scrollbar.
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  });
}
