/**
 * Practice Plans 1a — layout probes.
 *
 * BINDING METHOD: read COMPUTED STYLES and real geometry, never eyeball a screenshot. A
 * screenshot pass has previously produced the wrong fix twice; these assertions read what the
 * browser actually resolved.
 *
 * Widths under test: 361 (the narrowest phone the portal supports), 390 (iPhone), desktop.
 * The portal has TWO breakpoints — 900 (shell) and 640 (content) — and ONE tap floor (44px).
 */
import { test, expect, type Page } from '@playwright/test';

const SLUG = 'uat-test-org';
const TEAM = '3127a094-458f-4b78-8726-17342a8e37a6';
const EVENT = process.env.PROBE_EVENT_ID ?? '';

const planUrl = () => `/${SLUG}/coaches/teams/${TEAM}/practice/${EVENT}`;

const WIDTHS = [
  { name: '361 (narrowest phone)', width: 361, height: 780 },
  { name: '390 (iPhone)', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function openPlan(page: Page) {
  await page.goto(planUrl(), { waitUntil: 'domcontentloaded' });
  // The builder loads its world in one fetch; wait for a block title to exist.
  await expect(page.getByRole('textbox', { name: 'Block 1 title' })).toBeVisible({ timeout: 45_000 });
}

test.describe('Practice plan builder — layout', () => {
  test.skip(!EVENT, 'PROBE_EVENT_ID not supplied');

  for (const vp of WIDTHS) {
    test(`no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openPlan(page);

      // The PAGE must never scroll sideways. Wide content (the rotation grid) is allowed to
      // scroll inside its OWN container — that is what .ppGridScroll exists for.
      const overflow = await page.evaluate(() => ({
        docScrollW: document.documentElement.scrollWidth,
        docClientW: document.documentElement.clientWidth,
      }));
      expect(
        overflow.docScrollW,
        `page scrolls horizontally at ${vp.width}px`,
      ).toBeLessThanOrEqual(overflow.docClientW + 1);
    });

    test(`every control meets the 44px tap floor at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openPlan(page);

      // Icon buttons are the ones most at risk of shrinking below the floor.
      const short = await page.evaluate(() => {
        const bad: { label: string; h: number; w: number }[] = [];
        for (const el of Array.from(document.querySelectorAll('button'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue; // not rendered
          if (r.height < 44 - 0.5) {
            bad.push({
              label: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '?',
              h: Math.round(r.height),
              w: Math.round(r.width),
            });
          }
        }
        return bad;
      });
      expect(short, `controls under the 44px floor: ${JSON.stringify(short)}`).toEqual([]);
    });
  }

  test('the rotation grid scrolls inside its own container, not the page (361)', async ({ page }) => {
    await page.setViewportSize({ width: 361, height: 780 });
    await openPlan(page);

    const grid = page.locator('table').first();
    await expect(grid).toBeVisible();

    const box = await grid.evaluate((table) => {
      const scroller = table.parentElement!;
      const cs = getComputedStyle(scroller);
      return {
        overflowX: cs.overflowX,
        scrollerClientW: scroller.clientWidth,
        tableScrollW: table.scrollWidth,
      };
    });
    // The wide grid is genuinely wider than the phone — that is expected and correct;
    // what matters is that its own container owns the scroll.
    expect(box.overflowX).toBe('auto');
    expect(box.scrollerClientW).toBeLessThanOrEqual(361);
  });

  test('the focus rail sits beside the plan on desktop and stacks under it on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlan(page);
    const desktop = await page.evaluate(() => {
      const rail = document.querySelector('aside[aria-label="Focus areas"]') as HTMLElement | null;
      if (!rail) return null;
      const main = rail.previousElementSibling as HTMLElement;
      return {
        railTop: Math.round(rail.getBoundingClientRect().top),
        mainTop: Math.round(main.getBoundingClientRect().top),
        railLeft: Math.round(rail.getBoundingClientRect().left),
        mainLeft: Math.round(main.getBoundingClientRect().left),
        stickyPos: getComputedStyle(rail.firstElementChild as HTMLElement).position,
      };
    });
    if (desktop) {
      // Beside, not below: same row, rail to the right of the plan.
      expect(desktop.railLeft).toBeGreaterThan(desktop.mainLeft);
      expect(Math.abs(desktop.railTop - desktop.mainTop)).toBeLessThan(40);
      // It must actually be sticky — the Chunk C lesson (a sticky element needs travel).
      expect(desktop.stickyPos).toBe('sticky');
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const phone = await page.evaluate(() => {
      const rail = document.querySelector('aside[aria-label="Focus areas"]') as HTMLElement | null;
      if (!rail) return null;
      const main = rail.previousElementSibling as HTMLElement;
      return {
        railTop: Math.round(rail.getBoundingClientRect().top),
        mainTop: Math.round(main.getBoundingClientRect().top),
        stickyPos: getComputedStyle(rail.firstElementChild as HTMLElement).position,
      };
    });
    if (phone) {
      // Below the plan, and no longer sticky (the page scrolls as one).
      expect(phone.railTop).toBeGreaterThan(phone.mainTop);
      expect(phone.stickyPos).toBe('static');
    }
  });

  test('the block clock renders real times from the practice start (not raw UTC)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlan(page);
    // Practice starts 22:00Z = 6:00 p.m. Toronto. Block 1 runs 15 minutes.
    const clockText = await page.evaluate(() => {
      const el = document.querySelector('[class*="ppBlockClock"]');
      return el?.textContent?.trim() ?? '';
    });
    expect(clockText).toContain('6:00');
    expect(clockText).toContain('6:15');
  });
});
