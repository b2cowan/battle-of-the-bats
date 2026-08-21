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
 * 6. A FIXED BAR BLOCKS A PREPARE CLICK — the coach portal pins a navigation bar to the bottom
 *    of the viewport at phone width, so a `prepare` step aimed at anything low on a long phone
 *    screen never becomes actionable. It surfaces as a timeout on an element Playwright has
 *    ALREADY RESOLVED, with a call log about visibility and stability, which sends you hunting
 *    an animation that does not exist; `scrollIntoView({block:'center'})` does not help, because
 *    Playwright re-scrolls the element before every attempt.
 * 7. ⚠⚠ AND THE SAME BAR PHOTOGRAPHS INTO THE MIDDLE OF A `clipAll` CROP. A union crop is
 *    measured in DOCUMENT coordinates and taken `fullPage` (incident #5's fix), but a
 *    `position: fixed` element is painted at its VIEWPORT position — so the phone nav landed
 *    as an opaque band straight across the centre of the dues capture, wiping out a family's
 *    card. On a real phone that bar sits at the foot of the screen and never covers the middle
 *    of a list, so this is a capture artifact rather than the product, and hiding it is the
 *    honest answer rather than a cosmetic one. Found by looking at the PNG; nothing failed.
 *
 *    Both are answered by one manifest field, `hide`, applied before the prepare clicks and left
 *    in place through the shutter. It was briefly two mechanisms (a prepare-only version that
 *    lifted before the screenshot) and that version shipped #7 — the narrower rule was not wrong
 *    so much as answering half the problem.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDemoOrgSlug } from '../../lib/demo-org.ts';
import { shotManifestProblems } from '../../lib/shot-health.ts';
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

  const doubleClipped = shots.filter(s => s.clip && s.clipAll);
  if (doubleClipped.length) {
    console.error('✖ REFUSING TO CAPTURE — these entries set BOTH `clip` and `clipAll`:');
    for (const s of doubleClipped) console.error(`    ${s.id}`);
    console.error('  `clip` frames one element; `clipAll` frames the union of several. Pick one.');
    process.exit(1);
  }

  /* ── --check: no browser, just prove every declared picture actually exists. ──
     ⚠ The four rules themselves live in lib/shot-health.ts, NOT here, because the Pitch Deck
     Studio's library view asks the same four of the same manifest and cannot import this file
     (Playwright is imported at module scope above). Shared rather than copied — and read that
     module's header for the large thing these four questions do NOT prove. */
  if (args.includes('--check')) {
    const problems = [];
    for (const s of shots) {
      const where = `${outputRoot}/${groupOf(s)}/${s.id}.png`;
      const present = existsSync(path.join(ROOT, outputRoot, groupOf(s), `${s.id}.png`));
      for (const p of shotManifestProblems(s, { present, where })) problems.push(`${s.id}: ${p}`);
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

      // incidents #6 and #7 — both are the SAME element (a viewport-pinned bar) and both are
      // answered by `hide`. See the header for what each one looks like when it bites.
      if (shot.hide) await page.addStyleTag({ content: `${shot.hide} { display: none !important; }` });

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

      // `clipAll` is the COMPOSED crop: the union of every visible match, so a manifest can
      // say "the header and the first seven rows" or "the three game cards" and stay
      // re-derivable — the stored PNG is still exactly what the machine took, just framed
      // tighter. (Slide-library rule: a composed crop must be re-derivable from its manifest
      // entry; the callout rings live page-side and never touch the image.)
      const clipTarget = shot.clip ? page.locator(`${shot.clip} >> visible=true`).first() : null;
      let clipRect = null;
      if (shot.clipAll) {
        const parts = page.locator(`${shot.clipAll} >> visible=true`);
        // ⚠ DOCUMENT coordinates, deliberately — NOT `locator.boundingBox()`, which returns
        // VIEWPORT-relative ones. Measured 2026-08-20: `page.screenshot({clip})` without
        // `fullPage` reads the clip in viewport space, refuses a rect that misses the viewport
        // entirely, and — the dangerous half — SILENTLY CLAMPS one that merely overhangs it.
        // A union taller than the capture viewport would then be cut off while the manifest
        // recorded the union's full height, so the page would reserve the wrong aspect and the
        // callout rings would land on the wrong pixels. `fullPage: true` + document coordinates
        // has no viewport ceiling at all, which is also what `locator.screenshot()` gives the
        // single-element `clip` path for free.
        const boxes = (await parts.all().then(ls => Promise.all(ls.map(l => l.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
        })))))
          .filter(b => b && b.width > 0 && b.height > 0);
        if (!boxes.length) throw new Error(`clipAll matched nothing visible: ${shot.clipAll}`);
        const x = Math.min(...boxes.map(b => b.x));
        const y = Math.min(...boxes.map(b => b.y));
        clipRect = {
          x, y,
          width: Math.max(...boxes.map(b => b.x + b.width)) - x,
          height: Math.max(...boxes.map(b => b.y + b.height)) - y,
        };
      }
      await (clipTarget ?? page).screenshot({
        path: file,
        ...(clipRect ? { fullPage: true, clip: clipRect } : {}),
        ...(shot.clip || clipRect ? {} : { fullPage: false }),
      });

      const box = clipRect ?? (clipTarget ? await clipTarget.boundingBox() : { width: shot.width, height: 1000 });
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
      // Strip whatever size the entry already carries and write a fresh one directly above
      // `alt:`. ⚠ The old form matched the previous size only when it sat IMMEDIATELY before
      // `alt:` — put a comment between the two and it appended a SECOND `size:` key instead
      // of replacing the first, which TypeScript rejects as a duplicate property. Found the
      // first time a manifest entry grew a comment there (2026-08-20).
      // The head is bounded by this entry's OWN `alt:` — required on every shot, and the reason
      // it is safe to strip sizes across it. ⚠ If an entry ever lacked one, the head would run
      // into the NEXT entry and strip its size instead, so a miss is reported rather than
      // shrugged off. The id is escaped because it is interpolated into a pattern.
      const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const entry = new RegExp(`(id: '${safeId}',[\\s\\S]*?)(\\n {4}alt:)`);
      if (!entry.test(src)) {
        console.error(`  ✖ could not write the size back for ${id} — no \`alt:\` found in its manifest entry`);
        process.exitCode = 1;
        continue;
      }
      src = src.replace(entry, (_m, head, tail) =>
        `${head.replace(/\n {4}size: \{[^}]*\},/g, '')}\n    size: { w: ${s.w}, h: ${s.h} },${tail}`);
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
