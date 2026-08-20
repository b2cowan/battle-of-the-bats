/**
 * THE SHOT-CAPTURE CORE — one implementation of "photograph a screen in the demo world,
 * deterministically, from a manifest". Shared by scripts/capture-help-shots.mjs and
 * scripts/capture-marketing-shots.mjs, which stay thin: they name their manifest, output
 * root, and hints, and everything mechanical happens here ONCE.
 *
 * Extracted 2026-08-20 after the duplication produced its first real divergence: a
 * timezone fix landed in one copy and not its sibling within hours of the second copy
 * existing. The editorial rules stay per-manifest (lib/help-shots.ts vs
 * lib/marketing-shots.ts — deliberately different documents); the MECHANICS live here.
 *
 * ── DEMO WORLD ONLY — ENFORCED, NOT TRUSTED ───────────────────────────────────
 * Every manifest path must resolve to an org in lib/demo-org.ts's hardcoded allow-list
 * (stronger than the old '/riverdale-' prefix check — a typo'd riverdale-ish slug no
 * longer passes). Checked BEFORE the browser opens, and re-checked on every landed URL,
 * because the failure it prevents — publishing a real family's name or a real team's
 * money — is permanent the moment it ships. The demo orgs are also write-blocked at the
 * proxy, so a capture run cannot alter them.
 *
 * ── INCIDENT HISTORY (the reasons this file is shaped the way it is) ──────────
 * 1. ONE DOOR PRESS PER RUN, PER WORLD — `/see-it-live/*` is a PUBLIC door, rate-limited
 *    on purpose (10 presses per 10 minutes per IP, plus a global ceiling). A script that
 *    pressed it per shot throttled itself mid-run and every remaining capture landed on
 *    the marketing page — and it fails confusingly, because the door redirects rather
 *    than erroring. Press once, keep the context, navigate.
 * 2. `visible=true` IS LOAD-BEARING — several screens keep previously-visited panels
 *    MOUNTED BUT HIDDEN (the Money hub does this deliberately). A plain waitForSelector
 *    locks onto the hidden first match and waits forever. Cost 3 runs to find.
 * 3. TIMEZONE — the demo org lives in America/Toronto and at least one screen computes
 *    "today" from the BROWSER's clock; a context in another timezone can photograph an
 *    empty board around midnight. Every context is pinned to the org's timezone.
 * 4. CHROME SUPPRESSION — the sandbox banner/dock/tour are one wrapper element
 *    ([data-sandbox-banner]); hiding it and zeroing --sandbox-chrome-h removes all
 *    demo-only furniture without cropping, which would drift with the dock's height.
 * 5. THE DEV-TOOLS BADGE SHIPS IF YOU LET IT — every capture is taken against `next dev`,
 *    which paints its own floating indicator over the bottom-left of the page. A CLIPPED
 *    shot usually misses it, so this stayed invisible until an UNCLIPPED one was examined:
 *    `public/help/coaches/money-record-payment.png` had shipped with the badge sitting on
 *    top of the portal's nav, obscuring a label. It lives in a shadow root, so the rule
 *    below hides its light-DOM host (`nextjs-portal`) — a stylesheet cannot reach inside.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDemoOrgSlug } from '../../lib/demo-org.ts';
import { SEE_IT_LIVE_PATH, SEE_IT_LIVE_COACHES_PATH } from '../../lib/sandbox-door.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The doors, named once from lib/sandbox-door.ts so a moved door cannot strand this. */
const DOORS = { coach: SEE_IT_LIVE_COACHES_PATH, tournament: SEE_IT_LIVE_PATH };

const insideDemoWorld = pathname => isDemoOrgSlug(pathname.split('/')[1] || '');

/**
 * Run the whole capture CLI (--list / --check / --only=a,b / default: capture all).
 *
 * @param {object} cfg
 * @param {Array}  cfg.shots       the manifest array (HelpShot[] / MarketingShot[])
 * @param {string} cfg.manifestPath repo-relative path of the manifest source file (sizes
 *                                 are written back into it after a capture)
 * @param {string} cfg.outputRoot  repo-relative folder holding the images
 * @param {(s: any) => string} cfg.groupOf  the shot's subfolder (help: module; marketing: persona)
 * @param {string} cfg.baseUrl     dev server base URL
 * @param {string} cfg.seedHint    command to suggest when the demo world isn't seeded
 * @param {string} cfg.retakeCmd   command to suggest when --check finds problems
 * @param {string} cfg.label       human name for messages ("Help screenshots")
 */
export async function runShotCli({ shots, manifestPath, outputRoot, groupOf, baseUrl, seedHint, retakeCmd, label }) {
  const args = process.argv.slice(2);
  const only = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '');
  const wanted = only ? new Set(only.split(',').map(s => s.trim())) : null;
  const selected = shots.filter(s => !wanted || wanted.has(s.id));

  if (args.includes('--list')) {
    for (const s of shots) console.log(`${s.id.padEnd(34)} ${groupOf(s).padEnd(12)} ${s.path}`);
    return;
  }

  /* ── The guard. Runs before anything opens, and refuses the whole run. ────── */
  const trespassers = shots.filter(s => !insideDemoWorld(s.path));
  if (trespassers.length) {
    console.error('✖ REFUSING TO CAPTURE — these manifest entries point outside the demo world:');
    for (const s of trespassers) console.error(`    ${s.id}  →  ${s.path}`);
    console.error('  Every screenshot must come from an org in lib/demo-org.ts’s allow-list.');
    console.error('  Real orgs hold real families, real birthdates and real money.');
    process.exit(1);
  }

  /* ── --check: no browser, just prove every declared picture actually exists. ── */
  if (args.includes('--check')) {
    const problems = [];
    for (const s of shots) {
      const file = path.join(ROOT, outputRoot, groupOf(s), `${s.id}.png`);
      if (!existsSync(file)) problems.push(`${s.id}: no image at ${outputRoot}/${groupOf(s)}/${s.id}.png`);
      else if (!s.size) problems.push(`${s.id}: manifest has no size — re-run the capture so the page can reserve its space`);
      if (!s.alt?.trim()) problems.push(`${s.id}: no alt text`);
      if (!s.caption?.trim()) problems.push(`${s.id}: no caption`);
    }
    if (problems.length) {
      console.error(`✖ ${label}:`);
      for (const p of problems) console.error('    ' + p);
      console.error(`  Re-take with: ${retakeCmd}`);
      process.exit(1);
    }
    console.log(`✓ ${label}: ${shots.length} declared, all present with alt, caption and size.`);
    return;
  }

  /* ── Capture ──────────────────────────────────────────────────────────────── */
  const reachable = await fetch(baseUrl, { method: 'HEAD' }).then(() => true).catch(() => false);
  if (!reachable) {
    console.error(`✖ No dev server at ${baseUrl}. Start it with: npm run dev`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const results = { ok: [], failed: [] };
  const sizes = new Map();

  // One context per door for the run (incident #1). `door: 'public'` is a fresh
  // logged-out visitor — no press, which is exactly what a fan is.
  const contexts = new Map();
  async function contextFor(door) {
    if (contexts.has(door)) return contexts.get(door);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      deviceScaleFactor: 2, // legible when a reader enlarges it
      colorScheme: 'dark',
      timezoneId: 'America/Toronto', // incident #3
    });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' }); // persists across navigations
    if (door !== 'public') {
      await page.goto(baseUrl + DOORS[door], { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const landed = new URL(page.url()).pathname;
      if (!insideDemoWorld(landed)) {
        throw new Error(
          `the ${door} demo door landed on ${landed} instead of the demo world — it is either not `
          + `seeded here (run: ${seedHint}) or rate-limited (wait ~10 minutes)`,
        );
      }
    }
    contexts.set(door, { context, page });
    return contexts.get(door);
  }

  for (const shot of selected) {
    try {
      // The door attaches the demo session — this never handles a credential, and a
      // capture can only ever see what an ordinary visitor (or the demo operator) sees.
      const { page } = await contextFor(shot.door);
      await page.setViewportSize({ width: shot.width, height: 1000 });
      await page.goto(baseUrl + shot.path, { waitUntil: 'networkidle', timeout: 45_000 });

      // Second line of the demo-only defence: the guard checked the MANIFEST, this checks
      // where the browser actually ended up — origin AND path, because a redirect (or a
      // dot-segment path the string guard can't see through) could carry it out.
      const assertInDemoWorld = when => {
        const url = new URL(page.url());
        if (url.origin !== new URL(baseUrl).origin || !insideDemoWorld(url.pathname)) {
          throw new Error(`landed outside the demo world at ${url.href} ${when} — refusing to photograph it`);
        }
      };
      assertInDemoWorld('after navigating');

      // incident #2 — every readiness wait goes through here, so the `visible=true` rule
      // cannot be remembered in one place and forgotten in the other.
      const waitVisible = selector =>
        page.locator(`${selector} >> visible=true`).first().waitFor({ state: 'visible', timeout: 20_000 });

      await waitVisible(shot.ready);
      for (const step of shot.prepare ?? []) {
        await page.click(step, { timeout: 10_000 });
        await page.waitForTimeout(400);
      }
      // A prepare click can navigate (a breadcrumb, a link a selector accidentally matches) —
      // re-assert before anything gets photographed.
      if (shot.prepare?.length) assertInDemoWorld('after prepare clicks');

      // `ready` proved the SCREEN resolved; this proves what the clicks OPENED did too. A panel
      // that fetches when it opens (the coach's settlement sheet) renders "Loading…" first, and
      // the fixed post-click pause is a race against it — photographing a spinner is exactly the
      // half-loaded screen this system exists to prevent. Same visibility discipline as `ready`.
      if (shot.readyAfterPrepare) await waitVisible(shot.readyAfterPrepare);
      await page.addStyleTag({ // incident #4
        content: `[data-sandbox-banner] { display: none !important; }
                  :root { --sandbox-chrome-h: 0px !important; }`,
      });

      // incident #5 — hide the dev-tools BADGE only, from inside the overlay's shadow root,
      // because an outer stylesheet cannot reach in. Hiding the `nextjs-portal` host instead
      // would take Next's ERROR overlay down with it (one React tree, one host), and that
      // overlay is the tripwire that makes a broken capture obvious to whoever reviews the PNG.
      await page.evaluate(() => {
        const host = document.querySelector('nextjs-portal');
        if (!host?.shadowRoot) return;
        const style = document.createElement('style');
        style.textContent = '#devtools-indicator, [data-nextjs-toast] { display: none !important; }';
        host.shadowRoot.appendChild(style);
      });

      // Settle: fonts and any entrance animation (reduced-motion is already emulated,
      // so this is a short fixed wait rather than a race against a transition).
      await page.waitForTimeout(600);

      const dir = path.join(ROOT, outputRoot, groupOf(shot));
      mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${shot.id}.png`);

      // Same visibility rule as the readiness wait — a clip selector must resolve to
      // the element the reader can actually see, not a hidden twin in a stashed panel.
      // LAST word before the shutter. `ready`, the prepare clicks and `readyAfterPrepare` can
      // each sit for up to 20s, and the checks above all happened before them — so the assertion
      // that matters most is the one taken against the page actually being photographed.
      assertInDemoWorld('immediately before the screenshot');

      const clipTarget = shot.clip ? page.locator(`${shot.clip} >> visible=true`).first() : null;
      await (clipTarget ?? page).screenshot({ path: file, ...(shot.clip ? {} : { fullPage: false }) });

      const box = clipTarget ? await clipTarget.boundingBox() : { width: shot.width, height: 1000 };
      sizes.set(shot.id, { w: Math.round(box?.width ?? shot.width), h: Math.round(box?.height ?? 1000) });

      results.ok.push(shot.id);
      console.log(`  ✓ ${shot.id}`);
    } catch (err) {
      results.failed.push({ id: shot.id, why: err.message.split('\n')[0] });
      console.log(`  ✖ ${shot.id} — ${err.message.split('\n')[0]}`);
    }
  }
  for (const { context } of contexts.values()) await context.close();
  await browser.close();

  /* ── Write the rendered sizes back into the manifest ──────────────────────── */
  if (sizes.size) {
    const manifestFile = path.join(ROOT, manifestPath);
    let src = readFileSync(manifestFile, 'utf8');
    for (const [id, s] of sizes) {
      const entry = new RegExp(`(id: '${id}',[\\s\\S]*?)(\\n    size: \\{[^}]*\\},)?(\\n    alt:)`);
      src = src.replace(entry, (_m, head, _old, tail) => `${head}\n    size: { w: ${s.w}, h: ${s.h} },${tail}`);
    }
    writeFileSync(manifestFile, src, 'utf8');
    console.log(`  · wrote ${sizes.size} size(s) back into ${manifestPath}`);
  }

  console.log(`\n${results.ok.length} captured, ${results.failed.length} failed.`);
  if (results.failed.length) {
    console.error('Failures leave the PREVIOUS picture in place — a stale image is never published silently,');
    console.error('but it is still stale: fix the entry or remove the picture and let the text carry it.');
    process.exit(1);
  }
}
