/**
 * Prelim-walk rig — what the `/prewalk` agent drives (owner, 2026-11-14; `.claude/commands/prewalk.md` is the method).
 *
 * A prelim walk is a script that does an owner QA walk's steps before the owner does: it signs in as the people the walk
 * names, does each step, checks what the step says you should see, and keeps a screenshot. A step the script fully
 * checked counts as ticked (owner ruling 2026-11-14); a step it could not judge stays the owner's.
 *
 *   import { openWalk, go, openMoreSheet } from '../../../scripts/lib/prewalk-rig.mjs';
 *   const walk = await openWalk('.probe/prewalk/524');             // reads steps.json there, writes results.json + shots/
 *   const owner = await walk.signIn('someone@fixture.local', process.env.SOME_PASSWORD);            // 1440 x 900
 *   const thumb = await walk.signIn('someone@fixture.local', process.env.SOME_PASSWORD, { phone: true });   // 390 x 844
 *   await walk.step('C1.1', async (t) => {
 *     await go(owner.page, 'localhost:3000/uat-rep-club/admin');   // a walk's localhost:3000 address is sent to this rig's server
 *     await t.sees(owner.page, 'UAT Rep Club', { within: 'aside' });
 *     await t.absent(owner.page, 'Admin Area');
 *     t.check('the sidebar lists places in the walk order', got === want, `saw: ${got}`);
 *   });
 *   walk.yours('C1.4', 'a colour call: olive or red');             // never attempted; stays on the owner's list
 *   await walk.finish();
 *
 * Run a walk script from the repo root:  node --env-file=.env.local .probe/prewalk/<id>/run.mjs
 *
 * What makes a step "checked": it made at least one check, every check held, nothing threw, no page answered 5xx or
 * raised a page error, and the script did not hand the rest to the owner with t.leave(). Anything else is "failed" or
 * "yours" — the rig decides, never the script. A step whose kind is "call" (an owner's call) can never be checked.
 *
 * DEV ONLY, and never the owner's dev server: it refuses a Supabase project that is not dev, and refuses port 3000.
 * Sign-in is a plain password sign-in written into cookies by @supabase/ssr itself: a new session, no other session
 * ended, no password touched (a seed that re-asserts a password signs that person out everywhere — never run one here).
 */
import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { preflight, createWatchdog } from '../memory-guard.mjs';

// The dev project's ref, as DEV_REF in scripts/lib/billing-walk-fixture.mjs (not imported: that module pulls in Stripe).
const DEV_REF = 'npgnrxaitgbtbtvvykto';
export const BASE = (process.env.PREWALK_BASE ?? 'http://localhost:3100').replace(/\/$/, '');
export const DESKTOP = { width: 1440, height: 900 };
export const PHONE = { width: 390, height: 844 };
const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function refuse(message) {
  console.error(`\n✗ prewalk rig: ${message}`);
  process.exit(1);
}

/** Go to a path or address and wait for the page to settle. A walk's `localhost:3000/...` address is sent to BASE. */
export async function go(page, target, { settle = 500 } = {}) {
  const pathPart = String(target).replace(/^(https?:\/\/)?localhost:3000/, '');
  const url = /^https?:\/\//.test(pathPart) ? pathPart : `${BASE}${pathPart.startsWith('/') ? '' : '/'}${pathPart}`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(settle);
  return page.url();
}

/** Phone: open the admin kit's More sheet and leave it open. False when the screen has no More button. */
export async function openMoreSheet(page) {
  const more = page.locator('#admin-mob-more');
  try { await more.waitFor({ state: 'visible', timeout: 4000 }); } catch { return false; }
  if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
  await page.locator('[role="menu"]').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);
  return true;
}

/** Phone: dismiss the "install the app" banner when it is showing (it covers the foot of the first screen). */
export async function dismissInstallPrompt(page) {
  const b = page.locator('button[aria-label="Dismiss install prompt"]').first();
  if (!(await b.isVisible().catch(() => false))) return false;
  await b.click();
  await page.waitForTimeout(300);
  return true;
}

const show = (what) => (what instanceof RegExp ? String(what) : `“${what}”`);

/**
 * Open a walk's working folder (it must hold steps.json — see the command file for its shape) and return the walk.
 * Refuses unless the project is dev, the server is not the owner's, the server answers, and the machine has room.
 */
export async function openWalk(dir) {
  const root = path.resolve(dir);
  const stepsFile = path.join(root, 'steps.json');
  if (!fs.existsSync(stepsFile)) refuse(`no steps.json in ${root}`);
  const walkDef = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
  const stepDefs = new Map();
  for (const part of walkDef.parts ?? []) for (const s of part.steps ?? []) stepDefs.set(s.id, s);
  if (!stepDefs.size) refuse('steps.json holds no steps');

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !anon) refuse('run with --env-file=.env.local');
  let host = '';
  try { host = new URL(supaUrl).hostname; } catch { /* not a URL */ }
  if (host !== `${DEV_REF}.supabase.co`) refuse('NEXT_PUBLIC_SUPABASE_URL is not the dev project. A prelim walk never touches production.');
  if (new URL(BASE).port === '3000') refuse('port 3000 is the owner’s dev server. A prelim walk runs on its own server (default :3100; see scripts/prewalk-server.mjs).');
  try {
    const r = await fetch(`${BASE}/auth/login`, { redirect: 'manual' });
    if (r.status >= 500) refuse(`${BASE} answered ${r.status}. Fix or rebuild the server before walking (scripts/prewalk-server.mjs).`);
  } catch {
    refuse(`${BASE} is not answering. Start it first: node scripts/prewalk-server.mjs start`);
  }
  preflight(`prelim walk ${walkDef.walk ?? ''}`);
  const watchdog = createWatchdog(`prelim walk ${walkDef.walk ?? ''}`);

  const shotsDir = path.join(root, 'shots');
  fs.rmSync(shotsDir, { recursive: true, force: true });
  fs.mkdirSync(shotsDir, { recursive: true });
  const resultsFile = path.join(root, 'results.json');

  const git = (args) => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
  let build = null;
  try { build = JSON.parse(fs.readFileSync(path.resolve('.probe/prewalk/build-stamp.json'), 'utf8')); } catch { /* a server this rig did not build */ }
  const results = {
    walk: walkDef.walk ?? null,
    title: walkDef.title ?? null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    complete: false,
    base: BASE,
    head: git(['rev-parse', '--short', 'HEAD']),
    build,
    steps: {},
    writes: [],
    fixtureNote: null,
  };
  const save = () => fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  save();

  let browser = null;
  const jars = new Map(); // email -> Playwright cookies, so desktop and phone share one sign-in
  const events = []; // what the pages logged since the current step began

  async function cookiesFor(email, password) {
    if (jars.has(email)) return jars.get(email);
    if (!password) refuse(`no password given for ${email} (read it from .env.local or the walk’s own sign-in card)`);
    const jar = new Map();
    const supa = createServerClient(supaUrl, anon, {
      cookies: {
        getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => { for (const c of cookies) jar.set(c.name, c.value); },
      },
    });
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`sign-in ${email}: ${error.message}`);
    if (!jar.size) throw new Error(`sign-in ${email}: no session cookie was written`);
    const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, url: BASE }));
    jars.set(email, cookies);
    return cookies;
  }

  /** A browser signed in as `email` (or signed out when email is null). `phone: true` is 390 x 844 with touch. */
  async function signIn(email, password, { phone = false } = {}) {
    browser ??= await chromium.launch();
    const context = await browser.newContext({
      viewport: phone ? PHONE : DESKTOP,
      deviceScaleFactor: 1,
      ...(phone ? { isMobile: true, hasTouch: true, userAgent: PHONE_UA } : {}),
    });
    if (email) await context.addCookies(await cookiesFor(email, password));
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') events.push({ kind: 'console', text: m.text().slice(0, 300) }); });
    page.on('pageerror', (e) => events.push({ kind: 'pageerror', text: String(e.message).slice(0, 300) }));
    page.on('response', (r) => { if (r.status() >= 500) events.push({ kind: 'http', text: `HTTP ${r.status()} ${r.url().slice(0, 160)}` }); });
    return { context, page, email, phone, close: () => context.close() };
  }

  async function capture(page, stepId, rec, { suffix = '', full = false } = {}) {
    const vp = page.viewportSize() ?? DESKTOP;
    const device = vp.width <= 600 ? 'phone' : 'desktop';
    const n = rec.shots.length + 1;
    const file = `${stepId.replace(/[^A-Za-z0-9_.-]/g, '_')}-${n}${suffix ? `-${suffix}` : ''}.${device}.jpg`;
    await page.screenshot({ path: path.join(shotsDir, file), type: 'jpeg', quality: 72, fullPage: full });
    rec.shots.push({ file, device, url: page.url().replace(BASE, '') });
    rec.device ??= device;
  }

  /** Do one step of the walk. The rig decides its status from what happened inside `fn`. */
  async function step(id, fn) {
    const def = stepDefs.get(id);
    if (!def) throw new Error(`step “${id}” is not in steps.json — a prelim walk checks the walk as written, never its own steps`);
    const trip = watchdog.check(`step ${id}`);
    if (trip) {
      watchdog.report(trip);
      save(); // complete stays false: an aborted run is a failure, never a result
      await browser?.close();
      process.exit(1);
    }
    const rec = { status: null, reason: null, checks: [], shots: [], errors: [], left: null, device: null };
    events.length = 0;
    let lastPage = null;
    const note = (label, ok, detail, kind) => { rec.checks.push({ label, ok: !!ok, ...(detail ? { detail: String(detail).slice(0, 400) } : {}), ...(kind ? { kind } : {}) }); return !!ok; };
    const t = {
      /** Visible text is on the screen (a string matches as a substring; pass a RegExp for more). */
      async sees(page, what, { within, timeout = 5000, label } = {}) {
        lastPage = page;
        const scope = within ? page.locator(within) : page;
        let ok = true;
        try { await scope.getByText(what).filter({ visible: true }).first().waitFor({ state: 'visible', timeout }); } catch { ok = false; }
        return note(label ?? `shows ${show(what)}${within ? ` in ${within}` : ''}`, ok, ok ? '' : 'not on the screen');
      },
      /** Visible text is NOT on the screen. */
      async absent(page, what, { within, label } = {}) {
        lastPage = page;
        const scope = within ? page.locator(within) : page;
        const n = await scope.getByText(what).filter({ visible: true }).count();
        return note(label ?? `does not show ${show(what)}${within ? ` in ${within}` : ''}`, n === 0, n ? `on the screen ${n} time(s)` : '');
      },
      /** Any other check the script worked out itself. Say what was seen in `detail` when it fails. */
      check(label, ok, detail) { return note(label, ok, ok ? '' : detail); },
      /** A check read back from the saved record, not the screen (a writing step needs one). */
      readBack(label, ok, detail) { return note(label, ok, ok ? '' : detail, 'readback'); },
      /** Say what this step changed on the fixture, so the results page can tell the owner what was left behind. */
      wrote(what) { results.writes.push({ step: id, what }); },
      /** Hand the rest of this step to the owner; the checks made so far are kept as "what the machine did check". */
      leave(reason) { rec.left = reason; },
      /** Keep a screenshot (viewport by default; `full: true` for the whole page). One is taken at the end regardless. */
      async shot(page, opts) { lastPage = page; await capture(page, id, rec, opts); },
      use(page) { lastPage = page; return page; },
    };
    let thrown = null;
    try { await fn(t); } catch (e) { thrown = e; }
    if (lastPage && !rec.shots.length) await capture(lastPage, id, rec).catch(() => {});
    rec.errors = events.splice(0).slice(0, 12);
    const serverTrouble = rec.errors.filter((e) => e.kind !== 'console');
    const failedCheck = rec.checks.find((c) => !c.ok);
    if (thrown) { rec.status = 'failed'; rec.reason = `the script could not finish this step: ${String(thrown.message).split('\n')[0].slice(0, 300)}`; }
    else if (failedCheck) { rec.status = 'failed'; rec.reason = `${failedCheck.label}${failedCheck.detail ? ` — ${failedCheck.detail}` : ''}`; }
    else if (serverTrouble.length) { rec.status = 'failed'; rec.reason = `the page reported an error: ${serverTrouble[0].text}`; }
    else if (def.kind === 'call') { rec.status = 'yours'; rec.reason = 'your call — a machine never answers one'; }
    else if (rec.left) { rec.status = 'yours'; rec.reason = rec.left; }
    else if (!rec.checks.length) { rec.status = 'yours'; rec.reason = 'the script made no check on this step'; }
    else rec.status = 'checked';
    results.steps[id] = rec;
    save();
    console.log(`${rec.status === 'checked' ? '✓' : rec.status === 'failed' ? '✗' : '·'} ${id} ${rec.status}${rec.reason ? ` — ${rec.reason}` : ''}`);
    return rec.status;
  }

  /** Leave a step to the owner without attempting it, with the reason in plain words. */
  function yours(id, reason) {
    if (!stepDefs.has(id)) throw new Error(`step “${id}” is not in steps.json`);
    results.steps[id] = { status: 'yours', reason, checks: [], shots: [], errors: [], left: reason, device: null };
    save();
    console.log(`· ${id} yours — ${reason}`);
  }

  /** Close the run. Every step the script never reached stays the owner's. `fixtureNote` says what state was left. */
  async function finish({ fixtureNote = null } = {}) {
    for (const id of stepDefs.keys()) {
      if (!results.steps[id]) results.steps[id] = { status: 'yours', reason: 'the script did not reach this step', checks: [], shots: [], errors: [], left: null, device: null };
    }
    results.fixtureNote = fixtureNote;
    results.finishedAt = new Date().toISOString();
    results.complete = true;
    save();
    await browser?.close();
    browser = null;
    watchdog.summarise();
    const tally = { checked: 0, failed: 0, yours: 0 };
    for (const r of Object.values(results.steps)) tally[r.status] += 1;
    console.log(`\nPrelim walk ${results.walk ?? ''}: ${tally.checked} checked · ${tally.failed} failed · ${tally.yours} left for the owner (of ${stepDefs.size}).`);
    console.log(`Results: ${resultsFile}\nNext: node scripts/prewalk-report.mjs ${path.relative(process.cwd(), root).replace(/\\/g, '/')}`);
    return tally;
  }

  return { def: walkDef, signIn, step, yours, finish, dir: root };
}
