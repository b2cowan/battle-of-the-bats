/**
 * Journey-audit staging helper (Phase 3): logs in to /platform-admin as the UAT
 * platform admin, then calls the dev-seed APIs to stage J3/J4/J7:
 *   - dev-league-org (plan league) + dev-club-org (plan club), owner@dev.local
 *   - house-league season into dev-league-org
 *   - rep team into dev-club-org
 *
 * Run: node --env-file=.env.local scripts/journeys/run-dev-seeds.mjs
 */
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:3000';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const email = process.env.UAT_PLATFORM_ADMIN_EMAIL;
const password = process.env.UAT_PLATFORM_ADMIN_PASSWORD;
if (!email || !password) { console.error('UAT platform admin creds missing from env'); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/platform-admin/login?next=%2Fplatform-admin`, { waitUntil: 'load' });
await page.locator('#pl-email').fill(email);
await page.locator('#pl-password').fill(password);
await page.locator('button[type="submit"]').click();

const deadline = Date.now() + 45_000;
while (Date.now() < deadline && new URL(page.url()).pathname.startsWith('/platform-admin/login')) {
  await page.waitForTimeout(500);
}
if (new URL(page.url()).pathname.startsWith('/platform-admin/login')) {
  console.error('platform-admin login did not navigate away — check UAT creds');
  await browser.close();
  process.exit(1);
}
console.log(`✓ platform-admin login as ${email}`);

async function post(url, body) {
  const r = await ctx.request.post(`${BASE}${url}`, { data: body ?? {} });
  const j = await r.json().catch(() => ({}));
  console.log(`${r.status()} POST ${url}\n  ${JSON.stringify(j.log ?? j)}`);
  return { status: r.status(), json: j };
}

await post('/api/dev/seed/org', { plan: 'league' });
await post('/api/dev/seed/org', { plan: 'club' });

const { data: leagueOrg } = await db.from('organizations').select('id').eq('slug', 'dev-league-org').maybeSingle();
const { data: clubOrg } = await db.from('organizations').select('id').eq('slug', 'dev-club-org').maybeSingle();
if (!leagueOrg || !clubOrg) { console.error('org lookup failed after seeding'); await browser.close(); process.exit(1); }

await post('/api/dev/seed/house-league', { orgId: leagueOrg.id });
await post('/api/dev/seed/rep-team', { orgId: clubOrg.id });

await browser.close();
console.log('done');
