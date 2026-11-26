/**
 * ⚠ NO PAGE SHOWS THESE PICTURES ANY MORE (owner re-ruling 2026-11-21): /for-clubs and /for-leagues carry drawings
 * (`components/marketing/OnSaleDrawing.tsx`), the eight PNGs are deleted and the quarterly re-shoot is retired. The script
 * and Kestrel Bay are kept, unruled, as a way to photograph the house league and club screens for a walk or a deck; the
 * pictures now land in `.probe/on-sale-pictures/` (ignored), not in public/.
 *
 * CAPTURE THE ON-SALE PAGES' PICTURES — the product's own screens for /for-leagues' four steps and /for-clubs' four
 * modules (plan docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md S3b, copy W67), shot from KESTREL BAY, an invented club on
 * the DEV database built for the purpose. Never a production row.
 *
 *   node --env-file=.env.local scripts/capture-on-sale-pictures.mjs             take every picture
 *   node --env-file=.env.local scripts/capture-on-sale-pictures.mjs --only=a,b  just these ids
 *   node --env-file=.env.local scripts/capture-on-sale-pictures.mjs --survey    whole screens at desk and phone width into
 *                                                                               .probe/on-sale-survey/ (to choose crops)
 *   node --env-file=.env.local scripts/capture-on-sale-pictures.mjs --list      print the shots and exit
 *
 * ORDER (each re-shoot):
 *   1. node --env-file=.env.local scripts/seed-prospect-demo.mjs --club=kestrel   the house league (a rebuild)
 *   2. node --env-file=.env.local scripts/seed-on-sale-pictures-extras.mjs        the tournament, a rep team, the books
 *   3. this script, within about an hour of step 2: "Live now" on the event page is judged by the clock.
 * Needs the dev server up (`npm run dev`).
 *
 * ⚖ WHY ITS OWN SCRIPT: scripts/lib/shot-capture.mjs was the demo-world capture (retired with the demos) and signed in only
 * through the demo doors. It carries its own guard instead, the same shape:
 *   - the base URL must be this machine's dev server, and the Supabase project must be dev's;
 *   - every shot path must be inside /kestrel-bay/, checked before the browser opens, after navigating, after the prepare
 *     steps and immediately before the shutter (a redirect, e.g. to a sign-in page, refuses the shot);
 *   - the organization must carry the [ON_SALE_PICTURES] marker the fixture seed writes.
 * Sign-in is a one-time link minted with dev's service key for a fixture account (no password is stored or typed), turned
 * into the same session cookie the app sets.
 *
 * ⚖ /legal (W67): no birth date, medical field, real-looking email or phone, real logo or photo in a shot. The fixture
 * carries none of the last four; each shot's crop (and `hide`) keeps birth dates and contact columns out of frame.
 *
 * Pictures are 16:10 (the slot the drawings give each step and module), at 2× pixels, no browser chrome. Light scheme.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_REF = 'npgnrxaitgbtbtvvykto';
const SLUG = 'kestrel-bay';
const MARKER = '[ON_SALE_PICTURES]';
const BASE = process.env.ON_SALE_PICTURES_BASE_URL || 'http://localhost:3000';
// Not under public/ any more (2026-11-21): no page shows these, and a picture written there would be published with the
// next build for nobody. `.probe/` is this repo's ignored scratch folder.
const OUT = '.probe/on-sale-pictures';
const SURVEY_OUT = '.probe/on-sale-survey';
const RATIO = 10 / 16;

// ── arguments ───────────────────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const SURVEY = argv.includes('--survey');
const LIST = argv.includes('--list');
const only = (argv.find(a => a.startsWith('--only=')) ?? '').slice('--only='.length).split(',').filter(Boolean);
for (const a of argv) if (!['--survey', '--list'].includes(a) && !a.startsWith('--only=')) { console.error(`✗ Unknown argument: ${a}`); process.exit(1); }

// ── safety 1: dev only ──────────────────────────────────────────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) { console.error('✗ Missing Supabase env. Run with node --env-file=.env.local.'); process.exit(1); }
if (new URL(url).host !== `${DEV_REF}.supabase.co`) { console.error('✗ Refusing: the Supabase project is not dev.'); process.exit(1); }
const baseHost = new URL(BASE).hostname;
if (!['localhost', '127.0.0.1'].includes(baseHost)) { console.error(`✗ Refusing: ${BASE} is not this machine's dev server.`); process.exit(1); }

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const inside = (p) => p === `/${SLUG}` || p.startsWith(`/${SLUG}/`);

// ── the world's ids (dev; ids and slugs only) ───────────────────────────────────────────────────────────────────
async function one(label, q) { const { data, error } = await q; if (error) { console.error(`✗ ${label}: ${error.message}`); process.exit(1); } return data; }
const org = await one('org', db.from('organizations').select('id, internal_notes').eq('slug', SLUG).maybeSingle());
if (!org || !String(org.internal_notes ?? '').includes(MARKER)) {
  console.error(`✗ ${SLUG} is missing or was not made by the fixture seed. Run: node --env-file=.env.local scripts/seed-prospect-demo.mjs --club=kestrel`);
  process.exit(1);
}
const season = await one('season', db.from('league_seasons').select('id, slug').eq('org_id', org.id).eq('status', 'registration_open').order('created_at', { ascending: false }).limit(1).maybeSingle());
const divisions = season ? await one('divisions', db.from('league_divisions').select('id, name').eq('season_id', season.id)) : [];
const DIV = Object.fromEntries(divisions.map(d => [d.name, d.id]));
const tournament = await one('tournament', db.from('tournaments').select('id, slug').eq('org_id', org.id).order('created_at', { ascending: false }).limit(1).maybeSingle());
const repTeam = await one('rep team', db.from('rep_teams').select('id, name').eq('org_id', org.id).order('created_at', { ascending: false }).limit(1).maybeSingle());

const ACCOUNTS = { owner: `president@${SLUG}.example.test`, coach: `rep.coach@${SLUG}.example.test` };

// ── the shots ───────────────────────────────────────────────────────────────────────────────────────────────────
// `crop`: the picture's rectangle in DOCUMENT coordinates, from the top-left of `anchor` moved by dx/dy, `w` CSS pixels
// wide and 16:10 tall. `prepare`: clicks before the shutter. `hide`: CSS selectors removed from the page first.
const seasonAdmin = season ? `/${SLUG}/admin/house-league/seasons/${season.id}` : null;
export const SHOTS = [
  // The To review view: the step's words ("You review applications, accept players").
  { id: 'leagues-01-registrations', page: 'for-leagues', who: 'owner', path: seasonAdmin && `${seasonAdmin}/registrations?tab=review`, width: 1280,
    crop: { x: 262, y: 100, w: 990 },
    alt: 'The registrations list for a house league season' },
  { id: 'leagues-02-draft', page: 'for-leagues', who: 'owner', path: seasonAdmin && DIV.U11 && `${seasonAdmin}/teams?d=${DIV.U11}`, width: 1280,
    crop: { x: 280, y: 222, w: 960 },
    alt: 'The draft board for a house league division' },
  // The product has no single screen with the schedule beside the standings (the drawing's words); the standings page is the
  // one families open, and it is the step's claim ("standings update the moment scores are entered").
  { id: 'leagues-03-standings', page: 'for-leagues', who: 'public', path: season && `/${SLUG}/league/${season.slug}/standings`, width: 1280,
    prepare: ['a:text-is("U11")'], crop: { x: 44, y: 88, w: 1000 },
    alt: 'A house league division’s standings, as families see them' },
  { id: 'leagues-04-email', page: 'for-leagues', who: 'owner', path: seasonAdmin && `${seasonAdmin}/notifications`, width: 1280,
    // The page's own action button (at phone width it shows only its icon, so it is found by place, not by its words).
    // Typed, never sent: the shot is taken with the window open and nothing pressed after it.
    prepare: ['[class*="tabActions"] button',
      { fill: '[role="dialog"] input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"])', text: 'Picture day is Saturday' },
      { fill: '[role="dialog"] textarea', text: 'Team pictures are this Saturday before the 9:00 a.m. games. Please arrive in full uniform 20 minutes early. If it rains, pictures move to the following Saturday.' }],
    readyAfterPrepare: '[role="dialog"]', crop: { x: 245, y: 12, w: 850 },
    alt: 'The Email families window for a house league season' },
  { id: 'clubs-01-event', page: 'for-clubs', who: 'public', path: tournament && `/${SLUG}/${tournament.slug}`, width: 1280,
    crop: { x: 262, y: 95, w: 995 },
    alt: 'A public tournament page with live scores' },
  // The same list as /for-leagues 01, on its Accepted view: who has paid and who owes. Wider window, so names do not wrap.
  { id: 'clubs-02-registrations', page: 'for-clubs', who: 'owner', path: seasonAdmin && `${seasonAdmin}/registrations?tab=active`, width: 1440,
    crop: { x: 262, y: 100, w: 1150 },
    alt: 'The accepted registrations in a house league season, with each family’s fee' },
  { id: 'clubs-03-roster', page: 'for-clubs', who: 'coach', path: repTeam && `/${SLUG}/coaches/teams/${repTeam.id}/roster`, width: 1280,
    crop: { x: 262, y: 0, w: 990 },
    alt: 'A rep team’s roster in the Coaches Portal' },
  { id: 'clubs-04-budget', page: 'for-clubs', who: 'owner', path: `/${SLUG}/admin/accounting/budget-vs-actual`, width: 1280,
    crop: { x: 262, y: 105, w: 990 },
    alt: 'Budget vs. Actual for the club’s fiscal year' },
];

if (LIST) { for (const s of SHOTS) console.log(`${s.id.padEnd(26)} ${s.who.padEnd(7)} ${s.width}  ${s.path ?? '(world piece missing)'}`); process.exit(0); }

const selected = SHOTS.filter(s => !only.length || only.includes(s.id));
const missing = selected.filter(s => !s.path);
if (missing.length) {
  console.error(`✗ The fixture lacks what these shots need: ${missing.map(s => s.id).join(', ')}. Run the two seeds (see the header).`);
  process.exit(1);
}
const outside = selected.filter(s => !inside(s.path));
if (outside.length) { console.error(`✗ Refusing: paths outside /${SLUG}/: ${outside.map(s => s.path).join(', ')}`); process.exit(1); }

// ── sign-in: a one-time link for a fixture account, as the session cookie the app sets ──────────────────────────────
async function sessionCookies(email) {
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`sign-in link for ${email}: ${error.message}`);
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token });
  if (e2 || !v.session) throw new Error(`sign-in for ${email}: ${e2?.message ?? 'no session'}`);
  const name = `sb-${DEV_REF}-auth-token`;
  const value = 'base64-' + Buffer.from(JSON.stringify(v.session)).toString('base64url');
  const parts = value.length <= 3180 ? [[name, value]] : value.match(/.{1,3180}/g).map((c, i) => [`${name}.${i}`, c]);
  return parts.map(([n, val]) => ({ name: n, value: val, domain: baseHost, path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }));
}

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const contexts = new Map();
async function contextFor(who) {
  if (contexts.has(who)) return contexts.get(who);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', timezoneId: 'America/Toronto', locale: 'en-CA' });
  if (who !== 'public') await context.addCookies(await sessionCookies(ACCOUNTS[who]));
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  contexts.set(who, page);
  return page;
}

async function settle(page, shot) {
  const assertInside = (when) => {
    const u = new URL(page.url());
    if (u.origin !== new URL(BASE).origin || !inside(u.pathname)) throw new Error(`landed outside /${SLUG}/ at ${u.href} ${when} (signed out, or a redirect): refusing to photograph it`);
  };
  assertInside('after navigating');
  if (shot.hide?.length) await page.addStyleTag({ content: `${shot.hide.join(', ')} { display: none !important; }` });
  // A step is a selector to click, or { select, label } for a native <select>. Every screen opens on the club's first age
  // group, so most shots begin by choosing the one that is in season.
  for (const step of shot.prepare ?? []) {
    if (typeof step === 'string') await page.locator(`${step} >> visible=true`).first().click({ timeout: 10_000 });
    else if (step.fill) await page.locator(`${step.fill} >> visible=true`).first().fill(step.text, { timeout: 10_000 });
    else await page.locator(`${step.select} >> visible=true`).first().selectOption({ label: step.label }, { timeout: 10_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);
  }
  if (shot.prepare?.length) assertInside('after the prepare steps');
  if (shot.readyAfterPrepare) await page.locator(`${shot.readyAfterPrepare} >> visible=true`).first().waitFor({ timeout: 20_000 });
  // The dev-tools badge only, from inside the overlay's shadow root; Next's error overlay stays visible on purpose (a broken
  // screen must look broken in the picture, never quietly pass).
  await page.evaluate(() => {
    const host = document.querySelector('nextjs-portal');
    if (!host?.shadowRoot) return;
    const style = document.createElement('style');
    style.textContent = '#devtools-indicator, [data-nextjs-toast] { display: none !important; }';
    host.shadowRoot.appendChild(style);
  });
  // Most of these screens fetch after they mount and say "Loading…" until they have: a picture of that is never shipped.
  await page.waitForFunction(() => !/\bLoading\b/i.test(document.body.innerText), null, { timeout: 30_000 });
  // The pointer is parked in a corner: one left over a link from the last shot's click draws a hover underline in the picture.
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  assertInside('immediately before the screenshot');
}

const results = [];
for (const shot of selected) {
  try {
    const page = await contextFor(shot.who);
    if (SURVEY) {
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(BASE + shot.path, { waitUntil: 'networkidle', timeout: 60_000 });
        await settle(page, { ...shot, prepare: shot.prepare, crop: null });
        const dir = path.join(ROOT, SURVEY_OUT); mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${shot.id}-${width}.png`), fullPage: true });
      }
      results.push([shot.id, 'surveyed']);
      continue;
    }
    await page.setViewportSize({ width: shot.width, height: shot.width === 390 ? 844 : 900 });
    await page.goto(BASE + shot.path, { waitUntil: 'networkidle', timeout: 60_000 });
    await settle(page, shot);
    // The crop is a fixed rectangle of the page at the shot's width (document coordinates): the screens lay out the same at
    // a given width, and every re-shoot is looked at before it ships, so a layout change shows up as a bad crop, not silently.
    // The bottom edge never cuts through a line of text: it moves up to just above the first line it would cut, and the
    // width follows so the picture stays 16:10 (a half row makes the product look worse than it is; /design 2026-11-20).
    const c = shot.crop;
    const bottom = await page.evaluate(({ x, y, w, h }) => {
      const rects = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          const top = r.top + window.scrollY, bot = r.bottom + window.scrollY, left = r.left + window.scrollX;
          if (r.width > 0 && left < x + w && left + r.width > x && bot > y) rects.push([top, bot]);
        }
      }
      let b = y + h;
      for (let moved = true; moved;) {
        moved = false;
        for (const [top, bot] of rects) if (top < b && bot > b) { b = top - 6; moved = true; }
      }
      return b;
    }, { x: c.x, y: c.y, w: c.w, h: Math.round(c.w * RATIO) });
    const height = Math.round(bottom - c.y);
    const clip = { x: c.x, y: c.y, width: Math.round(height / RATIO), height };
    const dir = path.join(ROOT, OUT); mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${shot.id}.png`), fullPage: true, clip });
    results.push([shot.id, `${clip.width}×${clip.height} css px`]);
  } catch (err) {
    results.push([shot.id, `FAILED: ${err instanceof Error ? err.message : err}`]);
  }
}
await browser.close();
for (const [id, r] of results) console.log(`  ${r.startsWith('FAILED') ? '✗' : '✓'} ${id.padEnd(26)} ${r}`);
mkdirSync(path.join(ROOT, SURVEY ? SURVEY_OUT : OUT), { recursive: true });
writeFileSync(path.join(ROOT, SURVEY ? SURVEY_OUT : OUT, '.last-run.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
if (results.some(([, r]) => r.startsWith('FAILED'))) process.exit(1);
