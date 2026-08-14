/**
 * CAPTURE THE HELP SCREENSHOTS — re-take every picture in the help guides from the
 * seeded demo world, deterministically, in one command.
 *
 * ── WHY A SCRIPT AND NOT A PERSON WITH A CROPPING TOOL ────────────────────────
 * A hand-taken screenshot is a promise nobody can keep. It carries whatever data the
 * person happened to have on screen, at whatever width their laptop happened to be,
 * and when the product moves there is no way to find which pictures went stale or to
 * re-take them without doing the whole ritual again. Everything here exists so that
 * "the screen changed" has a one-command answer.
 *
 * ── DEMO WORLD ONLY — ENFORCED, NOT TRUSTED ───────────────────────────────────
 * Every manifest path is asserted to sit inside a `riverdale-*` demo organization
 * BEFORE the browser opens. This is a mechanism rather than a rule in a document
 * because the failure it prevents is publishing a real family's name, a real child's
 * birthdate or a real team's money into the product's own documentation — the kind of
 * mistake that is permanent the moment it ships. The demo orgs are additionally
 * write-blocked at the proxy, so a capture run cannot alter them either.
 *
 * ⚠ THESE IMAGES PROVE NOTHING. `check:layout` reads computed styles precisely
 * because eyeballing a screenshot produced the wrong fix twice in this portal. What
 * this script makes is documentation for readers, never evidence about a layout.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *   node scripts/capture-help-shots.mjs              re-take all of them
 *   node scripts/capture-help-shots.mjs --only=a,b   just these manifest ids
 *   node scripts/capture-help-shots.mjs --list       print the manifest and exit
 *   node scripts/capture-help-shots.mjs --check      verify each picture has a file
 *                                                    and the manifest has its size
 *
 * Needs the dev server up (`npm run dev`) and the coach/tournament demo worlds seeded
 * (`npm run seed:demo-coach`). Both are reported rather than assumed.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP_SHOTS } from '../lib/help-shots.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.HELP_SHOTS_BASE_URL || 'http://localhost:3000';
const MANIFEST = path.join(ROOT, 'lib/help-shots.ts');

/** The ONLY organizations a help picture may come from. */
const DEMO_ORG_PREFIX = '/riverdale-';
const DOORS = { coach: '/see-it-live/coaches', tournament: '/see-it-live' };

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '');
const wanted = only ? new Set(only.split(',').map(s => s.trim())) : null;
const shots = HELP_SHOTS.filter(s => !wanted || wanted.has(s.id));

if (args.includes('--list')) {
  for (const s of HELP_SHOTS) console.log(`${s.id.padEnd(34)} ${s.module.padEnd(12)} ${s.path}`);
  process.exit(0);
}

/* ── The guard. Runs before anything opens, and refuses the whole run. ──────── */
const trespassers = HELP_SHOTS.filter(s => !s.path.startsWith(DEMO_ORG_PREFIX));
if (trespassers.length) {
  console.error('✖ REFUSING TO CAPTURE — these manifest entries point outside the demo world:');
  for (const s of trespassers) console.error(`    ${s.id}  →  ${s.path}`);
  console.error(`  Every help screenshot must come from a demo org (a path starting "${DEMO_ORG_PREFIX}").`);
  console.error('  Real orgs hold real families, real birthdates and real money.');
  process.exit(1);
}

/* ── --check: no browser, just prove every declared picture actually exists. ── */
if (args.includes('--check')) {
  const problems = [];
  for (const s of HELP_SHOTS) {
    const file = path.join(ROOT, 'public/help', s.module, `${s.id}.png`);
    if (!existsSync(file)) problems.push(`${s.id}: no image at public/help/${s.module}/${s.id}.png`);
    else if (!s.size) problems.push(`${s.id}: manifest has no size — re-run the capture so the guide can reserve its space`);
    if (!s.alt?.trim()) problems.push(`${s.id}: no alt text`);
    if (!s.caption?.trim()) problems.push(`${s.id}: no caption`);
  }
  if (problems.length) {
    console.error('✖ Help screenshots:');
    for (const p of problems) console.error('    ' + p);
    console.error('  Re-take with: node scripts/capture-help-shots.mjs');
    process.exit(1);
  }
  console.log(`✓ Help screenshots: ${HELP_SHOTS.length} declared, all present with alt, caption and size.`);
  process.exit(0);
}

/* ── Capture ────────────────────────────────────────────────────────────────── */
const reachable = await fetch(BASE, { method: 'HEAD' }).then(() => true).catch(() => false);
if (!reachable) {
  console.error(`✖ No dev server at ${BASE}. Start it with: npm run dev`);
  process.exit(1);
}

const browser = await chromium.launch();
const results = { ok: [], failed: [] };
const sizes = new Map();

/**
 * ⚠ ONE DOOR PRESS PER RUN, PER WORLD — not one per picture.
 * `/see-it-live/*` is a PUBLIC door and is rate-limited on purpose (10 presses per 10
 * minutes per IP, plus a global ceiling) because anyone on the internet can press it.
 * A script that pressed it per shot would throttle itself part-way through a run and
 * every remaining capture would land on the marketing page instead — which is exactly
 * what happened while this was being written, and it fails in a confusing way because
 * the door redirects rather than erroring. So: press once, keep the context, navigate.
 */
const contexts = new Map();
async function contextFor(door) {
  if (contexts.has(door)) return contexts.get(door);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 2, // legible when a reader enlarges it
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.goto(BASE + DOORS[door], { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const landed = new URL(page.url()).pathname;
  if (!landed.startsWith(DEMO_ORG_PREFIX)) {
    throw new Error(
      `the ${door} demo door landed on ${landed} instead of the demo world — it is either not `
      + 'seeded here (run: npm run seed:demo-coach) or rate-limited (wait ~10 minutes)',
    );
  }
  contexts.set(door, { context, page });
  return contexts.get(door);
}

for (const shot of shots) {
  try {
    // The door attaches the demo session — so this script never handles a credential,
    // and a capture can only ever see what an ordinary visitor sees.
    const { page } = await contextFor(shot.door);
    await page.setViewportSize({ width: shot.width, height: 1000 });
    await page.goto(BASE + shot.path, { waitUntil: 'networkidle', timeout: 45_000 });

    // Second line of the demo-only defence: the guard above checked the MANIFEST, this
    // checks where the browser actually ended up (a redirect could still carry it out).
    const landed = new URL(page.url()).pathname;
    if (!landed.startsWith(DEMO_ORG_PREFIX)) {
      throw new Error(`landed outside the demo world at ${landed} — refusing to photograph it`);
    }

    // ⚠ `visible=true` is LOAD-BEARING, not belt-and-braces. Several portal screens keep
    // previously-visited panels MOUNTED BUT HIDDEN (the Money hub does this deliberately, so
    // a half-filled form survives a tab switch). That puts a hidden `table` first in the DOM,
    // and a plain waitForSelector locks onto that first match and waits for it to become
    // visible — forever. Cost 3 runs to find; do not "simplify" this away.
    await page.locator(`${shot.ready} >> visible=true`).first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    for (const step of shot.prepare ?? []) {
      await page.click(step, { timeout: 10_000 });
      await page.waitForTimeout(400);
    }
    // ── Take the demo's own furniture out of the picture ──────────────────────
    // The sandbox banner, phase dock and guided-tour bar are ~200px of chrome a real
    // coach has NEVER seen — in documentation they are worse than clutter, they are
    // misleading. We suppress them here rather than cropping around them, because the
    // dock's height changes with the tour state and a crop would drift with it.
    // `--sandbox-chrome-h` is what pads the document for that banner (app/globals.css),
    // so zeroing it closes the gap the hidden banner leaves behind.
    await page.addStyleTag({
      content: `[data-sandbox-banner] { display: none !important; }
                :root { --sandbox-chrome-h: 0px !important; }`,
    });

    // Settle: fonts and any entrance animation. The portal honours reduced-motion, so
    // this is a short, fixed wait rather than a race against a transition.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(600);

    const dir = path.join(ROOT, 'public/help', shot.module);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${shot.id}.png`);

    // Same visibility rule as the readiness wait — a clip selector must resolve to the
    // element the reader can actually see, not a hidden twin in a stashed panel.
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

/* ── Write the rendered sizes back into the manifest ────────────────────────── */
if (sizes.size) {
  let src = readFileSync(MANIFEST, 'utf8');
  for (const [id, s] of sizes) {
    const entry = new RegExp(`(id: '${id}',[\\s\\S]*?)(\\n    size: \\{[^}]*\\},)?(\\n    alt:)`);
    src = src.replace(entry, (_m, head, _old, tail) => `${head}\n    size: { w: ${s.w}, h: ${s.h} },${tail}`);
  }
  writeFileSync(MANIFEST, src, 'utf8');
  console.log(`  · wrote ${sizes.size} size(s) back into lib/help-shots.ts`);
}

console.log(`\n${results.ok.length} captured, ${results.failed.length} failed.`);
if (results.failed.length) {
  console.error('Failures leave the PREVIOUS picture in place — a stale image is never published silently,');
  console.error('but it is still stale: fix the entry or remove the picture and let the text carry it.');
  process.exit(1);
}
