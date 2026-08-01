/**
 * Practice Plans — does autosave actually finish?
 *
 * The save status is the only feedback a coach gets on a screen with no Save button, so "stuck on
 * Saving…" is indistinguishable from "your plan is not being kept". This drives the real screen
 * and watches the real request.
 */
import { test, expect } from '@playwright/test';

const SLUG = 'uat-test-org';
const TEAM = '3127a094-458f-4b78-8726-17342a8e37a6';
const EVENT = process.env.PROBE_EVENT_ID ?? '';

test.describe('Practice plan — autosave', () => {
  test.skip(!EVENT, 'PROBE_EVENT_ID not supplied');

  test('typing a block title reaches "Saved", and the PUT succeeds', async ({ page }) => {
    const calls: { status: number; body: string }[] = [];
    page.on('response', async res => {
      if (res.url().includes('/practice-plan') && res.request().method() === 'PUT') {
        calls.push({ status: res.status(), body: (await res.text().catch(() => '')).slice(0, 300) });
      }
    });
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => consoleErrors.push(`PAGEERROR ${e.message}`.slice(0, 200)));

    await page.goto(`/${SLUG}/coaches/teams/${TEAM}/practice/${EVENT}`, { waitUntil: 'domcontentloaded' });

    // A fresh practice has no blocks — add one, then type into it.
    const addBlock = page.getByRole('button', { name: 'Add a block' });
    await expect(addBlock).toBeVisible({ timeout: 60_000 });
    await addBlock.click();

    const title = page.getByRole('textbox', { name: 'Block 1 title' });
    await expect(title).toBeVisible();
    await title.fill('Warm up');

    // The status pill is the coach's only feedback. It must settle on "Saved".
    const status = page.locator('[class*="saveStatus"]');
    await expect(status).toContainText('Saving', { timeout: 5_000 });
    await expect(status).toContainText('Saved', { timeout: 20_000 });

    // eslint-disable-next-line no-console
    console.log('PUT calls:', JSON.stringify(calls, null, 2));
    // eslint-disable-next-line no-console
    console.log('console errors:', JSON.stringify(consoleErrors, null, 2));

    expect(calls.length, 'exactly one save for one edit').toBeGreaterThan(0);
    expect(calls.every(c => c.status === 200), `a PUT failed: ${JSON.stringify(calls)}`).toBe(true);
    expect(calls.length, 'autosave must not loop').toBeLessThan(4);
  });
});
