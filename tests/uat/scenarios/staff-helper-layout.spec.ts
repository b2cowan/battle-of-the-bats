/**
 * Staff access pass 2 — the Staff LIST and the one SHEET, layout probes (rewritten 2026-09-11; the
 * Phase 4 version probed the radio pair and the "what a helper gets" card, both retired with the
 * list-and-sheet rebuild — owner-approved 2026-09-10, mockup `c8982bc5` round 3).
 *
 * BINDING METHOD: read COMPUTED STYLES and real geometry, never eyeball a screenshot (a screenshot
 * pass has produced the wrong fix twice in this portal).
 *
 * What this screen is now, and what these probes hold:
 *   · the page is a LIST of people — the head coach's own row first, one "Edit access" door per
 *     other person — with nothing under the page title and one "Invite someone" in the header
 *   · "Invite someone" opens a SHEET: an email field, the sub-lined Role dropdown opening on
 *     "Choose who they are" with NOTHING preselected, and a quiet note where the grid will be
 *   · the dropdown's four options each clear the 44px tap floor and keep their sentence at 361px
 *   · choosing a role reveals the grid, prefilled from that role
 *   · the page never scrolls sideways at 361px, with or without the sheet open
 *
 * ⚠ WHAT THIS FILE DOES **NOT** COVER, deliberately: any other person's sign-in (a helper's, a
 * treasurer's) — the UAT harness has one coach fixture who is a HEAD coach. Those frames rest on
 * owner QA §169.
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

/** The portal's standing tap floor. */
const TAP_MIN = 44;

async function openStaff(page: Page) {
  await page.goto(staffUrl());
  // The head coach's own row is the first thing the list renders, so it is the honest ready signal.
  await expect(page.getByText('(you)')).toBeVisible({ timeout: 30_000 });
}

async function openInviteSheet(page: Page) {
  await page.getByRole('button', { name: /Invite someone/ }).first().click();
  await expect(page.getByRole('dialog', { name: /Invite someone to/ })).toBeVisible({ timeout: 10_000 });
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth };
  });
  // 1px of tolerance for sub-pixel rounding; anything more is a real horizontal scrollbar.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

for (const vp of WIDTHS) {
  test.describe(`Staff page · the list and the sheet · ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openStaff(page);
    });

    test('the list is the page: your row first, a door on every other row, one invite button, no lede', async ({ page }) => {
      // The head coach's own row: "(you)" and no "Edit access" door, but the hand-over link.
      await expect(page.getByRole('button', { name: /Hand over to someone else/ })).toBeVisible();
      // Every other person has a door.
      const doors = page.getByRole('button', { name: /^Edit access for / });
      expect(await doors.count()).toBeGreaterThanOrEqual(1);
      // Inviting is the page-level action, and it is the only one.
      await expect(page.getByRole('button', { name: /Invite someone/ }).first()).toBeVisible();
      // The retired lede must not have come back under the title (page-header rule).
      await expect(page.getByText('Invite assistants and choose exactly what each one can do.')).toHaveCount(0);
    });

    test('the invite sheet opens with nothing preselected and the grid held back', async ({ page }) => {
      await openInviteSheet(page);
      const dialog = page.getByRole('dialog', { name: /Invite someone to/ });
      await expect(dialog.getByLabel('Their email')).toBeVisible();
      // The Role field opens on its placeholder — nothing is chosen for the head coach.
      const role = dialog.getByRole('button', { name: 'Who are they?' });
      await expect(role).toBeVisible();
      await expect(role).toHaveText(/Choose who they are/);
      // And the access section is a quiet note until a role is picked.
      await expect(dialog.getByText('Choose who they are, and their starting access appears here for you to adjust.')).toBeVisible();
      await expect(dialog.getByText('Sensitive — asks before granting')).toHaveCount(0);
      await noSidewaysScroll(page);
    });

    test('the four role options clear the tap floor and keep their sentences', async ({ page }) => {
      await openInviteSheet(page);
      const dialog = page.getByRole('dialog', { name: /Invite someone to/ });
      await dialog.getByRole('button', { name: 'Who are they?' }).click();
      const list = page.getByRole('listbox', { name: 'Who are they?' });
      await expect(list).toBeVisible();
      const options = list.getByRole('option');
      await expect(options).toHaveCount(4);
      for (const name of ['Assistant coach', 'Team manager', 'Team treasurer', 'Helper']) {
        await expect(list.getByText(name, { exact: true })).toBeVisible();
      }
      // The sentence is the whole reason this is the sub-lined dropdown and not a <select>.
      const sentence = list.getByText('Runs a station at practice. Sees the plan and the players in front of them.');
      await expect(sentence).toBeVisible();
      expect((await sentence.boundingBox())!.height).toBeGreaterThan(0);
      for (let i = 0; i < 4; i++) {
        const box = await options.nth(i).boundingBox();
        expect(box, `option ${i} has no box`).not.toBeNull();
        expect(box!.height, `option ${i} is under the ${TAP_MIN}px tap floor`).toBeGreaterThanOrEqual(TAP_MIN);
      }
      // The list sits over the sheet — it must not have pushed the page sideways.
      await noSidewaysScroll(page);
    });

    test('choosing a role reveals the grid, prefilled from that role', async ({ page }) => {
      await openInviteSheet(page);
      const dialog = page.getByRole('dialog', { name: /Invite someone to/ });
      await dialog.getByRole('button', { name: 'Who are they?' }).click();
      await page.getByRole('listbox', { name: 'Who are they?' }).getByRole('option', { name: /Team treasurer/ }).click();
      // The role's sentence sits under the field; the grid appears with the treasurer's shape.
      await expect(dialog.getByText('Keeps the books — budget, dues, expenses and payments. Nothing else.')).toBeVisible();
      await expect(dialog.getByText('Sensitive — asks before granting')).toBeVisible();
      // Schedule is one three-way control, on "View" for a treasurer; Team money on "View + edit".
      const schedule = dialog.getByRole('group', { name: 'Schedule' });
      await expect(schedule.getByRole('button', { name: 'View', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const money = dialog.getByRole('group', { name: /Team money/ });
      await expect(money.getByRole('button', { name: 'View + edit' })).toHaveAttribute('aria-pressed', 'true');
      // The footer counts the sensitive grants the send will confirm.
      await expect(dialog.getByText(/1 sensitive grant — you’ll confirm it next\./)).toBeVisible();
      await noSidewaysScroll(page);
    });

    test('never scrolls sideways', async ({ page }) => {
      await noSidewaysScroll(page);
    });
  });
}
