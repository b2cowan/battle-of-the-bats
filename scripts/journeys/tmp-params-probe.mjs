// One-off: prove the Next-16 sync-params breakage — log the API URLs the
// program-year page actually requests when loaded in a real browser.
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/auth/login`, { waitUntil: 'load' });
await page.locator('#login-email').fill('club-owner@dev.local');
await page.locator('#login-password').fill('devpass123');
await page.locator('#login-submit').click();
const deadline = Date.now() + 45_000;
while (Date.now() < deadline && new URL(page.url()).pathname.startsWith('/auth/login')) {
  await page.waitForTimeout(500);
}

const apiCalls = [];
page.on('request', (r) => { if (r.url().includes('/api/admin/rep-teams/')) apiCalls.push(r.url()); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));

await page.goto(`${BASE}/dev-club-org/admin/rep-teams/teams/e1520a86-f6ea-4b74-8aa9-c4525d38bada/program-years/75fc5490-a175-4c1c-8ed8-29cfee3a3eed`, { waitUntil: 'load' });
await page.waitForTimeout(4000);

console.log('API calls made by the page:');
for (const u of apiCalls) console.log(' ', u.replace(BASE, ''));
console.log('page errors:', errors.length ? errors.slice(0, 5) : '(none)');
console.log('body text head:', (await page.locator('main, body').first().innerText()).slice(0, 200).replace(/\n+/g, ' | '));

await browser.close();
