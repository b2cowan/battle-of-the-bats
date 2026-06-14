// One-off: verify the program-year API as club-owner (J4 lens saw "Program year not found").
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
console.log('post-login url:', page.url());

const r = await ctx.request.get(`${BASE}/api/admin/rep-teams/teams/e1520a86-f6ea-4b74-8aa9-c4525d38bada/program-years/75fc5490-a175-4c1c-8ed8-29cfee3a3eed`);
const body = await r.text();
console.log('API status:', r.status());
console.log(body.slice(0, 600));

await browser.close();
