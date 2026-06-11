/**
 * Journey-audit screenshot driver (User Journey Audit — Phase 0 harness).
 *
 * Drives a real browser over a journey's signature screens at mobile + desktop
 * widths and saves full-page PNGs for the design-lens review pass.
 *
 * Run: node scripts/journey-shots.mjs scripts/journeys/j1-shots.json
 * Spec: { baseUrl, outDir, login: {email, password} | null,
 *         shots: [{ name, url, auth?: true, fullPage?: false }] }
 * Output: <outDir>/<name>--mobile.png + <name>--desktop.png (outDir must be gitignored)
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const specPath = process.argv[2];
if (!specPath) { console.error('usage: node scripts/journey-shots.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
fs.mkdirSync(spec.outDir, { recursive: true });

const VIEWPORTS = {
  mobile:  { width: 390,  height: 844,  deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900,  deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
const SETTLE_MS = 2600; // let client fetches, count-ups and entrance animations finish

const browser = await chromium.launch();

// One login → storageState reused by both authed contexts
let authState = null;
if (spec.login) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${spec.baseUrl}/auth/login`, { waitUntil: 'load' });
  await page.locator('#login-email').fill(spec.login.email);
  await page.locator('#login-password').fill(spec.login.password);
  await page.locator('#login-submit').click();
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && new URL(page.url()).pathname.startsWith('/auth/login')) {
    await page.waitForTimeout(500);
  }
  if (new URL(page.url()).pathname.startsWith('/auth/login')) {
    console.error('login did not navigate away — check credentials'); process.exit(1);
  }
  authState = await ctx.storageState();
  await ctx.close();
  console.log(`✓ logged in as ${spec.login.email}`);
}

let failures = 0;
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const anonCtx  = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const authCtx  = authState
    ? await browser.newContext({ viewport: vp, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch, storageState: authState })
    : null;

  for (const shot of spec.shots) {
    const ctx = shot.auth ? authCtx : anonCtx;
    if (!ctx) { console.error(`✗ ${shot.name}: auth shot but no login in spec`); failures++; continue; }
    const page = await ctx.newPage();
    const file = path.join(spec.outDir, `${shot.name}--${vpName}.png`);
    try {
      await page.goto(`${spec.baseUrl}${shot.url}`, { waitUntil: 'load', timeout: 60_000 });
      await page.waitForTimeout(SETTLE_MS);
      await page.screenshot({ path: file, fullPage: shot.fullPage !== false });
      console.log(`✓ ${path.basename(file)}`);
    } catch (e) {
      console.error(`✗ ${shot.name} (${vpName}): ${e.message.split('\n')[0]}`);
      failures++;
    } finally {
      await page.close();
    }
  }
  await anonCtx.close();
  if (authCtx) await authCtx.close();
}

await browser.close();
console.log(failures ? `done with ${failures} failure(s)` : 'done — all shots captured');
process.exit(failures ? 1 : 0);
