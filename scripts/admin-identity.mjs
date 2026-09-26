/**
 * THE IDENTITY CHECK — "with the switch OFF, does every admin screen look exactly as it did?"
 *
 * ⚠ WHY THIS EXISTS (Admin Design Continuity, slice 0, 2026-09-25). Phase 1 moves the whole admin
 * onto the coaches portal's kit behind a dev-only switch, over several sessions, on the one `dev`
 * branch that anyone may promote. Nothing it changes may be visible before its release day, and the
 * layout sweep cannot prove that: it measures RULES (tap floors, overflow, contrast), not pixels, so
 * a border that changed colour with the switch off passes it untouched. This compares PIXELS.
 *
 * It is a machine diff, not an eyeball: the layout sweep's "never eyeball a screenshot" rule stands.
 * The pictures are LOCAL ONLY (`.admin-identity/`, git-ignored) and live for the life of Phase 1.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *   node scripts/admin-identity.mjs before              capture the "before" set (a slice's start)
 *   node scripts/admin-identity.mjs after               capture "after" (a slice's end), then compare
 *   node scripts/admin-identity.mjs compare             compare the two sets already on disk
 *   … --only=tournaments,admin-hub                      just these AREAS and/or screen ids
 *   … --width=phone | desktop                           just one width
 *   … --list                                            the screens and their areas
 *
 * A difference is NOT automatically a leak. Other sessions change admin screens too (Club Stage 1's
 * server half changes what a role is shown; the rep club is reseeded). `compare` prints the commits
 * and working-tree changes between the two captures so every difference can be ATTRIBUTED before it
 * is called one — and a difference another session caused is re-captured and named, never "fixed".
 *
 * ── WHAT KEEPS IT QUIET ON AN UNCHANGED SCREEN ────────────────────────────────
 *   · the page's clock is pinned (`FIXED_NOW`, or the entry's own `clock`) — relative dates and
 *     "today" read the same on every run;
 *   · the Next.js dev overlay is hidden, animations are frozen, the caret is hidden;
 *   · each screen is shot until two consecutive shots agree, so a late image or font cannot land
 *     between them;
 *   · live figures that still move are MASKED (`MASKS` below, or an entry's `identityMask`) — and
 *     each mask names why, because a mask is a hole in the check.
 * ⚠ A noisy check is worse than none: after any change here, run `before` then `after` on an
 * unchanged tree and confirm it reports nothing.
 *
 * Needs the dev server (alone — ask the owner for a quiet window first) and the UAT sessions.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAdminContext } from './uat-fixture-context.mjs';
import { SCREENS, waitForNoLoading } from './layout-screens.mjs';
import { preflight, createWatchdog } from './memory-guard.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = path.join(ROOT, '.admin-identity');
const AUTH = path.join(ROOT, 'tests/uat/.auth');
const BASE = process.env.UAT_BASE_URL ?? 'http://localhost:3000';

/** Same sessions as the layout sweep — one list would be better; two short ones are named alike. */
const SESSION_FILES = {
  orgOwner: 'org-owner.json',
  repClubOwner: 'rep-club-owner.json',
  repClubAdmin: 'rep-club-admin.json',
  repClubTreasurer: 'rep-club-treasurer.json',
  repClubRegistrar: 'rep-club-registrar.json',
  repClubCoach: 'rep-club-coach.json',
  plusOfficial: 'plus-official.json',
};

/**
 * Phone and desktop. 390 is a real phone's width; 1440 is the sweep's desktop. The admin's one
 * breakpoint is 900, so these two see both of its frames.
 */
const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

/**
 * The pinned clock for every screen that does not name its own. A Thursday noon in Toronto.
 * ⚠ It must sit BEFORE any real run: the browser's Supabase client judges its token's expiry by
 * this clock, and a pinned time later than a fresh token's expiry makes the client refresh on every
 * tick. Earlier than real time is safe — the server still judges the token by the real clock.
 */
const FIXED_NOW = '2026-09-24T12:00:00-04:00';

/**
 * Live figures that move on an unchanged screen. Each needs a reason; each is a hole.
 * Learned by running the check twice on an unchanged tree (slice 0) — add to it only from evidence.
 */
const MASKS = [
  // The tournament dashboard's Registration trend line and its "+N this week" chip: the SERVER
  // buckets registrations by day against the real clock, so the line shifts at midnight UTC. Found
  // by the slice-0 quiet run — a capture at 23:54 UTC and one at 00:03 UTC moved the line's peak.
  '[class*="sparkline"]',
  '[class*="velocityChip"]',
];

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const mode = argv.find((a) => !a.startsWith('--')) ?? '';
const val = (f) => argv.find((a) => a.startsWith(`${f}=`))?.split('=')[1];
const only = val('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const widthArg = val('--width');

// The identity check is SWITCH OFF by definition — a `kitOnly` screen (Club Tier Stage 1) has no
// switch-off version to compare.
const ADMIN = SCREENS.filter((s) => s.area && !s.kitOnly);
const screens = only ? ADMIN.filter((s) => only.includes(s.area) || only.includes(s.id)) : ADMIN;
const widths = widthArg ? WIDTHS.filter((w) => w.name === widthArg) : WIDTHS;

if (argv.includes('--list')) {
  for (const s of ADMIN) console.log(`${s.id.padEnd(34)} ${s.area}`);
  console.log(`\n${ADMIN.length} screens × ${WIDTHS.length} widths · areas: ${[...new Set(ADMIN.map((s) => s.area))].join(', ')}`);
  process.exit(0);
}
if (!['before', 'after', 'compare'].includes(mode)) {
  console.error('Usage: node scripts/admin-identity.mjs before | after | compare [--only=area,id] [--width=phone|desktop]');
  process.exit(1);
}
if (!screens.length) { console.error(`✗ No admin screen matched --only=${only?.join(',')}`); process.exit(1); }
if (!widths.length) { console.error(`✗ No width named "${widthArg}" (phone | desktop)`); process.exit(1); }

const fileOf = (set, s, w) => path.join(STORE, set, `${s.id}@${w.name}.png`);
const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };

// ── capture ───────────────────────────────────────────────────────────────────
async function capture(set) {
  const ctx = await resolveAdminContext();
  const dir = path.join(STORE, set);
  mkdirSync(dir, { recursive: true });
  // A --only run replaces just its own pictures; a full run starts the set clean, so a screen that
  // left the list cannot linger as a stale "match".
  if (!only && !widthArg) for (const f of readdirSync(dir)) if (f.endsWith('.png')) rmSync(path.join(dir, f));

  for (const s of new Set(screens.map((x) => x.session))) {
    const f = SESSION_FILES[s];
    if (!f || !existsSync(path.join(AUTH, f))) {
      console.error(`✗ Missing session for "${s}". Repair: npx playwright test --config playwright.config.ts --project=auth-setup`);
      process.exit(1);
    }
  }
  try { const r = await fetch(BASE, { signal: AbortSignal.timeout(5000) }); void r; }
  catch { console.error(`✗ Dev server not reachable at ${BASE}. Repair: npm run dev`); process.exit(1); }

  preflight('Memory');
  const memory = createWatchdog('identity capture');
  const browser = await chromium.launch();
  const failed = [];
  const unsettled = [];
  let shot = 0;
  let aborted = null;
  console.log(`Identity capture "${set}" · ${screens.length} screen(s) × ${widths.length} width(s) · ${BASE}\n`);

  for (const s of screens) {
    if (aborted) break;
    for (const w of widths) {
      const label = `${s.id} @${w.name}`;
      aborted = memory.check(label);
      if (aborted) break;
      // A context per shot: nothing a previous screen left in device memory, and a pinned clock
      // that cannot leak. Slower than sharing one, and the reason the pictures agree run to run.
      const context = await browser.newContext({
        storageState: path.join(AUTH, SESSION_FILES[s.session]),
        viewport: { width: w.width, height: w.height },
        reducedMotion: 'reduce',
      });
      await context.clock.setFixedTime(new Date(s.clock ? s.clock(ctx) : FIXED_NOW));
      // The rail's groups all open — the frame is the thing slice 1 rebuilds, so draw all of it.
      await context.addInitScript(() => {
        try { localStorage.setItem('fl_nav_groups', JSON.stringify(['operations', 'setup', 'admin'])); } catch { /* measured closed */ }
      });
      const page = await context.newPage();
      const url = BASE + s.path(ctx);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 150_000 });
        await page.waitForSelector(s.ready, { timeout: 150_000, state: 'attached' });
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
        await waitForNoLoading(page);
        if (s.interact) await s.interact(page);
        // Same landing rule as the sweep: the admin gates by redirect, so it must end where sent.
        const got = new URL(page.url()).pathname;
        if (got !== new URL(url).pathname) throw new Error(`redirected to ${got}`);
        // A refusal is a real screen that says nothing about the one asked for — a wrong session.
        // VISIBLE text only: the 404 page's markup rides inside every page's inline data.
        const body = (await page.innerText('body').catch(() => '')) || '';
        const refused = ['Access Restricted', 'don\'t have access', 'don’t have access', 'You do not have access', 'You do not have permission', 'ROUTE_NOT_FOUND']
          .find((t) => body.includes(t));
        if (refused) throw new Error(`landed on "${refused}"`);
        await page.evaluate(() => document.fonts.ready);
        const masks = [...MASKS, ...(s.identityMask ?? [])].map((sel) => page.locator(sel));
        const snap = () => page.screenshot({
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          mask: masks,
          maskColor: '#FF00FF',
          // The dev overlay's badge sits over the page and changes with compile state.
          style: 'nextjs-portal { display: none !important; }',
        });
        let prev = await snap();
        let settled = false;
        for (let i = 0; i < 8; i++) {
          await page.waitForTimeout(400);
          const next = await snap();
          if (next.equals(prev)) { settled = true; break; }
          prev = next;
        }
        if (!settled) unsettled.push(label);
        writeFileSync(fileOf(set, s, w), prev);
        shot++;
        console.log(`  ${settled ? '✓' : '~'} ${label}${settled ? '' : ' — never settled (kept the last shot)'}`);
      } catch (e) {
        failed.push({ label, url, why: String(e.message || e).split('\n')[0] });
        console.log(`  ✗ ${label} — ${String(e.message || e).split('\n')[0]}`);
      } finally {
        await context.close();
      }
    }
  }
  await browser.close();
  if (aborted) { memory.report(aborted); process.exit(1); }
  memory.summarise();

  // What the tree looked like, so `compare` can say what changed in between. A set can be built by
  // more than one run (a full capture, then `--only` re-captures), and its pictures then come from
  // different trees — so every run is kept, and a full run starts the list again (review finding,
  // 2026-09-25: one overwritten record named only the LAST run's tree for pictures it never took).
  const manifestPath = path.join(dir, 'manifest.json');
  const prior = existsSync(manifestPath) ? readRuns(JSON.parse(readFileSync(manifestPath, 'utf8'))) : [];
  const run = {
    at: new Date().toISOString(),
    head: git('rev-parse HEAD'),
    dirty: git('status --porcelain').split('\n').filter(Boolean),
    scope: only || widthArg ? { only: only ?? null, width: widthArg ?? null } : 'all',
  };
  writeFileSync(manifestPath, JSON.stringify({ runs: run.scope === 'all' ? [run] : [...prior, run] }, null, 2) + '\n');

  console.log(`\n${shot} picture(s) in ${path.relative(ROOT, dir)}.`);
  if (unsettled.length) console.log(`  ⚠ ${unsettled.length} never settled — a moving figure to MASK, or a page still loading: ${unsettled.join(', ')}`);
  if (failed.length) {
    console.error(`\n✗ ${failed.length} screen(s) could not be captured — a set with holes proves nothing about them:`);
    for (const f of failed) console.error(`    ${f.label} — ${f.why}\n      ${f.url}`);
    process.exit(1);
  }
}

/** A set's capture runs, oldest first. Reads the first-day single-record shape too. */
function readRuns(m) {
  return Array.isArray(m?.runs) ? m.runs : m?.head ? [m] : [];
}

// ── compare ───────────────────────────────────────────────────────────────────
async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function compare() {
  const beforeDir = path.join(STORE, 'before');
  const afterDir = path.join(STORE, 'after');
  const diffDir = path.join(STORE, 'diff');
  if (!existsSync(beforeDir) || !existsSync(afterDir)) {
    console.error('✗ Need both a "before" and an "after" capture. Run: node scripts/admin-identity.mjs before');
    process.exit(1);
  }
  rmSync(diffDir, { recursive: true, force: true });
  mkdirSync(diffDir, { recursive: true });

  const differ = [];
  const missing = [];
  let same = 0;
  for (const s of screens) {
    for (const w of widths) {
      const a = fileOf('before', s, w);
      const b = fileOf('after', s, w);
      const label = `${s.id} @${w.name}`;
      if (!existsSync(a) || !existsSync(b)) { missing.push(`${label} (${existsSync(a) ? 'no after' : 'no before'})`); continue; }
      if (readFileSync(a).equals(readFileSync(b))) { same++; continue; }
      const [A, B] = [await raw(a), await raw(b)];
      if (A.width !== B.width || A.height !== B.height) {
        differ.push({ label, s, what: `size ${A.width}×${A.height} → ${B.width}×${B.height}` });
        continue;
      }
      // Count pixels that moved, and paint them red over a dimmed "after" — the diff image a
      // person opens only once the machine has said WHERE to look.
      const out = Buffer.alloc(B.data.length);
      let moved = 0;
      let top = Infinity;
      let bottom = -1;
      for (let i = 0; i < B.data.length; i += 4) {
        const d = Math.max(
          Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]),
        );
        if (d > 2) {
          moved++;
          const y = Math.floor(i / 4 / B.width);
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          out[i] = 255; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 255;
        } else {
          out[i] = B.data[i] * 0.3; out[i + 1] = B.data[i + 1] * 0.3; out[i + 2] = B.data[i + 2] * 0.3; out[i + 3] = 255;
        }
      }
      if (!moved) { same++; continue; }
      await sharp(out, { raw: { width: B.width, height: B.height, channels: 4 } }).png().toFile(path.join(diffDir, `${s.id}@${w.name}.png`));
      differ.push({ label, s, what: `${moved.toLocaleString('en-CA')} px changed, rows ${top}–${bottom}` });
    }
  }

  // Attribution: what changed in the TREE between the two captures — from the EARLIEST run behind
  // any "before" picture to the LATEST run behind any "after" picture, the widest honest range.
  const runsOf = (d) => existsSync(path.join(d, 'manifest.json')) ? readRuns(JSON.parse(readFileSync(path.join(d, 'manifest.json'), 'utf8'))) : [];
  const [bRuns, aRuns] = [runsOf(beforeDir), runsOf(afterDir)];
  const mB = bRuns[0] ?? null;
  const mA = aRuns[aRuns.length - 1] ?? null;

  console.log(`Identity compare · ${same} unchanged · ${differ.length} changed · ${missing.length} missing\n`);
  if (differ.length) {
    const byArea = {};
    for (const d of differ) (byArea[d.s.area] ??= []).push(d);
    for (const [area, list] of Object.entries(byArea)) {
      console.log(`  ${area}`);
      for (const d of list) console.log(`    ✗ ${d.label} — ${d.what}`);
    }
    console.log(`\n  Diff images: ${path.relative(ROOT, diffDir)}`);
  }
  if (missing.length) console.log(`\n  Missing (not compared): ${missing.join(', ')}`);
  if (mB && mA) {
    const runLine = (label, rs) => `${label} ${rs.map((r) => `${r.at} @ ${r.head.slice(0, 8)}${r.scope === 'all' ? '' : ` (${[r.scope.only?.join(','), r.scope.width].filter(Boolean).join(' · ')})`}`).join(' + ')}`;
    console.log(`\n  Captured: ${runLine('before', bRuns)} · ${runLine('after', aRuns)}`);
    if (mB.head !== mA.head) {
      console.log('  Commits between them (attribute every difference before calling it a leak):');
      for (const l of git(`log --oneline ${mB.head}..${mA.head}`).split('\n').filter(Boolean)) console.log(`    ${l}`);
    }
    const was = new Set(mB.dirty);
    const now = mA.dirty.filter((l) => !was.has(l));
    if (now.length) {
      console.log('  Working-tree changes that appeared between them:');
      for (const l of now) console.log(`    ${l}`);
    }
  }
  if (differ.length || missing.length) {
    console.error(`\n✗ ${differ.length} screen(s) changed${missing.length ? `, ${missing.length} not compared` : ''}. ` +
      'With the switch OFF nothing may change: attribute each one (above) before calling it a leak.');
    process.exit(1);
  }
  console.log('\n✓ Every admin screen is pixel-identical.');
}

if (mode === 'compare') await compare();
else {
  await capture(mode);
  if (mode === 'after') await compare();
}
