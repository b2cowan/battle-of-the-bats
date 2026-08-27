/**
 * LAYOUT INVARIANT SWEEP — the house rules, applied to every listed screen, at every width.
 *
 * ⚠ WHY THIS EXISTS. Everything in `npm run verify:changed` reads SOURCE TEXT or DATABASE STATE.
 * Nothing rendered a page. So the entire class of defect that only exists once a browser has
 * resolved a layout — sideways scroll, controls under the tap floor, a rail that stopped sticking,
 * text on a background it cannot be read against, a row trapped under the bottom bar — had no gate
 * at all, and reached the owner's eyes as the first thing in the pipeline that looked at pixels.
 *
 * The rules below were not invented here. They were already written, correctly, inside
 * practice-plan-layout.spec.ts and its siblings — but filed under one feature each, pinned to one
 * fixture each, so they guarded one screen and every NEW screen started unprotected until a bug
 * taught someone to write another one-off. This promotes them to product-wide and makes adding a
 * screen a one-line edit to `scripts/layout-screens.mjs`.
 *
 * ── BINDING METHOD ────────────────────────────────────────────────────────────
 * Read COMPUTED STYLES and real geometry. Never eyeball a screenshot: a screenshot pass has
 * produced the WRONG FIX twice in this portal.
 *
 * ── THE BASELINE, AND WHY IT IS NOT CHEATING ──────────────────────────────────
 * A blanket 44px floor fails PRODUCT-WIDE on day one: the shared button primitives render at 41px
 * and the team nav rows at 38.5px, on every screen. A gate that is red everywhere is a gate nobody
 * runs. So this ratchets exactly like `check-public-tokens.mjs`: the population that exists today
 * is snapshotted, NEW findings fail the check, and fixing one is meant to shrink the file. An entry
 * carrying a `reason` is a decision; an entry without one is debt that has not been argued yet, and
 * the summary keeps count of those so the number is visible rather than comfortable.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *   node scripts/check-layout-invariants.mjs                 check (fails on NEW findings)
 *   node scripts/check-layout-invariants.mjs --init          snapshot / lower the baseline
 *   node scripts/check-layout-invariants.mjs --report        write the inventory doc
 *   node scripts/check-layout-invariants.mjs --prune         drop baseline entries now fixed
 *   node scripts/check-layout-invariants.mjs --only=a,b      just these screen ids
 *   node scripts/check-layout-invariants.mjs --width=361     just this width
 *   node scripts/check-layout-invariants.mjs --list          print the screen list and exit
 *
 * Needs the dev server running, and the UAT sessions present. Repair commands are printed on
 * failure rather than assumed.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveUatContext } from './uat-fixture-context.mjs';
import { SCREENS, WIDTHS } from './layout-screens.mjs';
import { preflight, createWatchdog } from './memory-guard.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'scripts/.layout-baseline.json');
const REPORT = path.join(ROOT, 'docs/agents/design/LAYOUT_INVARIANTS_REPORT.md');
const AUTH = path.join(ROOT, 'tests/uat/.auth');

const SESSION_FILES = {
  coach: path.join(AUTH, 'coach.json'),
  orgOwner: path.join(AUTH, 'org-owner.json'),
  orgAdmin: path.join(AUTH, 'org-admin.json'),
  platformAdmin: path.join(AUTH, 'platform-admin.json'),
  anon: null,
};

const TAP_FLOOR = 44;

/**
 * THE TAP FLOOR IS A TOUCH RULE, AND ONLY A TOUCH RULE (owner decision 2026-08-19).
 *
 * 44px is a FINGER measurement. Applied at mouse-and-keyboard widths it was not measuring a real
 * defect, and the portal proved it: EVERY row of the coach sidebar failed at 1440 on EVERY coach
 * screen - the home link at 22px, notifications 28px, account 30px, the team switcher 33px, the
 * five group headings 26px, the nav rows themselves 39px. Raising them all adds ~250px to the rail
 * and partly reverses the chrome slimdown that shipped days earlier (`fb8345cf`), so the rule was
 * failing a design that was deliberately correct. A gate that is red where nothing is wrong is a
 * gate that gets baselined into silence - which is exactly what had already happened: 1,173
 * desktop-width entries sat in the baseline as accepted, 871 of them with no reason written down.
 *
 * So the floor now stops at the last touch width. This replaces those 1,173 entries with ONE
 * reviewable decision, in the place the rule is defined rather than 1,173 times in a data file.
 *
 * WHAT THIS DOES NOT SAY. It does not say the desktop rail is beyond criticism - it says 44px is
 * the wrong instrument for judging it. A pointer-width minimum is a real thing to want; it is a
 * DIFFERENT number, argued separately, and it would go here.
 *
 * AND IT CHANGES NOTHING ABOUT TOUCH. The floor still runs at 361/390/768, where the portal is
 * carrying 753 baselined failures (653 unargued, 156 of them under 24px - the smallest is 13px).
 * That debt is REAL, it is now the only thing this rule reports, and it is tracked in
 * `docs/projects/active/COACH_TOUCH_TARGET_DEBT_PLAN.md`. Do not bulk-write reasons onto those to
 * quiet the count: an entry without a reason is debt that has not been argued yet, and the summary
 * line keeps that number visible on purpose.
 */
const TAP_FLOOR_MAX_WIDTH = 768;

/**
 * Chrome the portal owns on EVERY screen, exempted once here instead of once per screen.
 *
 * ⚠ Each entry needs a reason. This list is the honest version of the note buried in
 * drill-library-layout.spec.ts: a first version of that probe asserted a blanket 44px across the
 * document and failed on the portal's own shell, so it was narrowed to the feature's own classes —
 * which quietly meant the shell was never checked by anything. Naming the exemptions here keeps
 * them visible and revisitable, rather than dissolved into a selector.
 *
 * Selectors use [class*=…] substring matching because CSS modules hash the emitted class names —
 * the same technique the existing specs already rely on.
 */
const CHROME_EXEMPT = [
  { sel: '.skip-link', reason: 'Skip-to-content is visually hidden until focused; it has no resting box to measure.' },
  { sel: '[class*="srOnly"]', reason: 'Screen-reader-only content is deliberately 1px.' },
  {
    sel: 'nextjs-portal',
    reason:
      'The Next.js DEV overlay. It does not exist in a production build, and it sits on top of the page — ' +
      'left in, it wins the hit test at arbitrary points and made the covered-by-chrome rule report a ' +
      'different answer on every run. Measuring it would be measuring the toolchain, not the product.',
  },
];

// Text that proves the page did NOT actually land where we asked. Measuring one of these is worse
// than measuring nothing, because it passes.
const LANDING_FAILURES = [
  'Not assigned to any teams',
  'Team not found',
  'Page not found',
  'This page could not be found',
  'Something went wrong',
  'Application error',
  'You do not have access',
];

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => argv.find((a) => a.startsWith(`${f}=`))?.split('=')[1];

const mode = has('--init') ? 'init' : has('--report') ? 'report' : has('--prune') ? 'prune' : 'check';
let onlyIds = val('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const onlyWidth = val('--width');

/**
 * `--changed` — pick the screens the working tree actually touches.
 *
 * This is what makes the sweep usable inside a review. Whole-suite is ~20 minutes; scoped to the
 * screens a diff touches it is seconds (~3.4s per screen-width on a warm dev server), which is the
 * difference between a check that runs and one that doesn't.
 *
 * ⚠ WHEN UNSURE IT WIDENS, NEVER NARROWS. A shared file — the palette, the portal stylesheet, a
 * shell layout, anything under components/coaches — selects EVERY screen, because that is exactly
 * the blast radius that hid the colour defect for months. A check that quietly measures too little
 * is the failure mode this whole tool exists to stop.
 */
// ⚠ An explicit --only WINS over --changed. An earlier version let --changed overwrite it, so
// `--only=a,b --changed` quietly swept all 28 screens instead of the two asked for — a flag that
// silently does more than you asked is as untrustworthy as one that silently does less.
if (has('--changed') && !onlyIds) {
  const { execSync } = await import('node:child_process');
  let files = [];
  try {
    files = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    console.error(`✗ --changed could not read the diff: ${e.message}`);
    process.exit(1);
  }

  // Files whose reach is the whole portal rather than one route.
  const SHARED = /^(app\/globals\.css|app\/\[orgSlug\]\/coaches\/coaches\.module\.css|app\/\[orgSlug\]\/coaches\/layout\.tsx|app\/layout\.tsx|components\/coaches\/|components\/consumer\/warmTheme\.module\.css)/;
  const shared = files.filter((f) => SHARED.test(f));

  if (shared.length) {
    onlyIds = SCREENS.map((s) => s.id);
    console.log(`--changed: ${shared.length} shared file(s) touched (e.g. ${shared[0]}) — sweeping ALL screens.\n`);
  } else {
    // Turn each screen's URL back into the route folder that renders it, then match prefixes.
    // Both event-shaped screens live under a `[eventId]` folder, so one sentinel serves both.
    // `fundraiserId` lands in a QUERY param, not a path segment, so it never reaches the folder
    // mapping below — it is here only so the path builder does not interpolate `undefined`.
    // `finishedTeamId` maps to the same `[teamId]` folder as `teamId` — the between-seasons screens
    // are the SAME routes rendered against a team with no live season, which is the point of them.
    // `finishedPracticeEventId` maps to the same `[eventId]` folder as the two live event screens —
    // it is the SAME route rendered against a practice in a season that has ended.
    // ⚠ The four sentinels added 2026-08-26 are the six new drill-ins' PATH SEGMENTS. Without
    // them `--changed` builds `.../roster/undefined` and the screen silently never matches its own
    // route folder — a screen listed in the sweep but unreachable by the changed-file filter, which
    // is the same "looks covered, is not" shape the entries themselves were added to close.
    const SENTINEL = { orgSlug: '__ORG__', teamId: '__TEAM__', finishedTeamId: '__TEAM__', practiceEventId: '__EVENT__', gameEventId: '__EVENT__', finishedPracticeEventId: '__EVENT__', fundraiserId: '__ID__', finishedYearId: '__ID__', receiptPlayerId: '__PLAYER__', planTemplateId: '__TEMPLATE__', lineupTemplateId: '__TEMPLATE__', evalSessionId: '__SESSION__', opponentKey: '__OPPONENT__', commitmentId: '__ID__' };
    const dirOf = (s) =>
      'app' + s.path(SENTINEL)
        .replace('/__ORG__/', '/[orgSlug]/')
        .replace('__TEAM__', '[teamId]')
        .replace('__EVENT__', '[eventId]')
        .replace('__PLAYER__', '[playerId]')
        .replace('__TEMPLATE__', '[templateId]')
        .replace('__SESSION__', '[sessionId]')
        .replace('__OPPONENT__', '[opponentKey]');
    const hit = SCREENS.filter((s) => files.some((f) => f.startsWith(dirOf(s) + '/') || f.startsWith(dirOf(s) + '.')));
    onlyIds = hit.map((s) => s.id);
    if (!onlyIds.length) {
      console.log('--changed: no listed screen is affected by this diff. Nothing to sweep.');
      process.exit(0);
    }
    console.log(`--changed: ${onlyIds.length} screen(s) affected — ${onlyIds.join(', ')}\n`);
  }
}

if (has('--list')) {
  for (const s of SCREENS) console.log(`${s.id.padEnd(30)} ${s.session}`);
  const universal = WIDTHS.filter((w) => !w.optIn).map((w) => w.name);
  const optIn = WIDTHS.filter((w) => w.optIn).map((w) => w.name);
  console.log(`\n${SCREENS.length} screens × ${universal.length} widths (${universal.join(', ')})` +
    (optIn.length ? ` · opt-in: ${optIn.join(', ')}` : ''));
  process.exit(0);
}

const screens = onlyIds ? SCREENS.filter((s) => onlyIds.includes(s.id)) : SCREENS;

/**
 * `--changed` defaults to a representative PAIR of widths — the narrow phone and the desktop —
 * rather than all four.
 *
 * Measured: ~3.4s per screen-width on a warm dev server. A normal feature diff touches one or two
 * screens, so two widths keeps a review step in the seconds. A palette or shared-chrome diff widens
 * to all 28 screens by design, and there four widths would be ~20 minutes — slow enough that the
 * step gets skipped, which is worse than covering two widths well. 361 and 1440 straddle both of
 * the portal's breakpoints (900 shell, 640 content), so a layout that is right at both is very
 * rarely wrong between them. The deliberate whole-suite run still covers all four.
 */
const CHANGED_DEFAULT_WIDTHS = ['361', '1440'];
const widths = onlyWidth
  ? WIDTHS.filter((w) => w.name === onlyWidth)
  : has('--changed')
    ? WIDTHS.filter((w) => CHANGED_DEFAULT_WIDTHS.includes(w.name))
    : WIDTHS;
/**
 * A screen is swept at a universal width always, and at an `optIn` width only if it asked (§68).
 *
 * ⚠ An opt-in width stays in `widths` rather than being filtered out up front, because the
 * baseline's scope maths (`coversPair`, used by `--init` and `--prune`) has to recognise it as a
 * width this run knows about. Drop it from the list and every 320px entry reads as an orphan —
 * `--prune` would then delete the marketing baseline on its next run.
 */
const runsAt = (screen, w) => !w.optIn || (screen.widths ?? []).includes(w.name);

/** Screen/width pairs this run will actually visit — the honest number for the header line. */
const pairCount = screens.reduce((n, s) => n + widths.filter((w) => runsAt(s, w)).length, 0);

if (screens.length === 0) { console.error(`✗ No screens matched --only=${onlyIds?.join(',')}`); process.exit(1); }
if (widths.length === 0) { console.error(`✗ No width matched --width=${onlyWidth}`); process.exit(1); }
/**
 * ⚠⚠ ZERO PAIRS IS A FAILURE, NOT A PASS — and before this guard existed it printed
 * "✓ No new layout findings" and exited 0 (found by review, 2026-08-21, reproduced live).
 *
 * The two guards above check LIST MEMBERSHIP, which was sufficient for as long as every screen was
 * swept at every selected width. The opt-in width broke that invariant: `--only=coach-roster
 * --width=320` leaves both lists non-empty while `runsAt` rejects the only pair between them, so
 * the run opened no page, measured nothing, and said so in the one voice everything downstream
 * reads as success.
 *
 * That is this repo's oldest layout-testing failure wearing new clothes — two probes once
 * `test.skip`-ed themselves on a missing fixture and reported green, and the sweep's own header
 * records that "an abort is a failure, not a pass". A cross-product can be empty when neither of
 * its sides is; the guard has to ask the cross product.
 */
if (pairCount === 0) {
  console.error(
    `✗ Nothing to sweep: ${screens.length} screen(s) × ${widths.length} width(s) share no pair.\n` +
    `  ${widths.filter((w) => w.optIn).map((w) => w.name).join(', ') || 'A width'} is opt-in — only screens ` +
    `naming it in their own \`widths\` are swept there (see scripts/layout-screens.mjs).\n` +
    `  Repair: drop --width, or pick a screen that opts in.`,
  );
  process.exit(1);
}

// ── the in-page probe ─────────────────────────────────────────────────────────
/**
 * Runs INSIDE the browser. Must be entirely self-contained — it is serialised across the boundary,
 * so it cannot reference anything from this module's scope beyond its single argument.
 *
 * Returns findings: { rule, signature, detail }.
 */
function probeInPage(opts) {
  const { scopeSel, tapFloor, exempt, only } = opts;
  const wanted = (rule) => !only || only.includes(rule);
  const out = [];
  const add = (rule, signature, detail) => out.push({ rule, signature, detail });

  const root = (scopeSel && document.querySelector(scopeSel)) || document.body;

  const nameOf = (el) => {
    const raw =
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('alt') ||
      el.getAttribute('title') ||
      (el.textContent || '').replace(/\s+/g, ' ').trim();
    const t = raw.slice(0, 40);
    return t || `<${el.tagName.toLowerCase()}>`;
  };
  const sigOf = (el) => `${el.tagName.toLowerCase()}·${nameOf(el)}`;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.opacity !== '0';
  };
  const isExempt = (el) => exempt.some((s) => el.closest(s));

  /**
   * WHAT COUNTS AS A CONTROL — one definition, read by every rule that has an opinion about them
   * (the tap floor and the off-screen rule today).
   *
   * ⚠ It was written out twice for about an hour, which is long enough to make the point: two rules
   * that each carry their own idea of "a control" drift the moment one of them learns about a new
   * role, and the drift is invisible because both rules keep passing. This file already records the
   * same lesson about `openModal` — see the block above it.
   */
  const CONTROL_SEL =
    'button, a[href], summary, select, textarea, input:not([type="hidden"]), ' +
    '[role="button"], [role="tab"], [role="switch"], [role="checkbox"]';

  /**
   * The open modal, if any — computed ONCE for the whole probe.
   *
   * ⚠ Two rules need this and each grew its own copy, which is how their definitions of "the open
   * modal" start to drift (and how a third rule inherits a fourth). R4 and R6 both narrow to the
   * dialog when one is open, for the same reason: while an `aria-modal` dialog is up the page
   * beneath it is inert BY DECLARATION — the user cannot reach it and is not meant to — so
   * measuring it produces findings that are true and meaningless. `.modalOverlay` is
   * `position: fixed; inset: 0`, which without this reads to R6 as a full-screen chrome bar
   * covering every readable thing on the page (122 findings on the first screen swept with a
   * modal open, ~110 of them phantom) and to R4 as a scroll-locked body trapping every sticky
   * header behind it.
   */
  const openModal = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'))
    .find((d) => visible(d)) ?? null;

  // ── colour maths (WCAG 2.1) ────────────────────────────────────────────────
  const parseColor = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  /**
   * Source-over compositing. ⚠ THE RESULT IS NOT AUTOMATICALLY OPAQUE.
   *
   * The first version hard-coded `a: 1`, which is only correct when the BACKING layer is already
   * opaque. Composite a translucent foreground over a translucent backing — a 12% badge wash on a
   * 10% tinted table row, the commonest badge pattern in the portal — and it declared the result
   * fully opaque at the backing's own colour. The roster's "Active" badge therefore reported as
   * green-on-solid-olive at 1.05:1, an alarming and completely fictional finding: the row tint is
   * 10% olive over cream, so the true ground is a pale sage and the badge is fine.
   *
   * The walk above relies on this alpha to decide when it has found opaque ground, so getting it
   * wrong also stopped the walk early — the error compounded rather than merely mis-shading.
   */
  const over = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };
  const lum = (c) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

  /** Walk up compositing backgrounds. Returns null when something unmeasurable intervenes. */
  const effectiveBg = (el) => {
    let acc = null;
    let node = el;
    while (node && node !== document.documentElement.parentElement) {
      const cs = getComputedStyle(node);
      const c = parseColor(cs.backgroundColor);
      const img = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : null;

      if (img) {
        // ⚠ THE BACKTEST'S SHARPEST FINDING (2026-08-03). A blanket "image behind the text → give
        // up" made this rule STRUCTURALLY BLIND to the coach portal's own paper: `.coachesMain`
        // paints the blueprint grid on every org-scoped screen in both themes, so 19–53% of the
        // text on a screen — the muted labels, helper copy and empty states that live on the page
        // ground rather than inside a card — was silently declined. It found the --home-dim defect
        // only because that token is used INSIDE cards, which paint an opaque surface and
        // short-circuit this walk before it ever reached main. Verified by restoring a real
        // white-on-cream defect (7b6e5e23) and watching the rule stay green on it.
        //
        // A GRADIENT painted over an opaque colour on the SAME element is measurable: the colour
        // is the ground everywhere the gradient is transparent, which for a hairline grid or a
        // tint wash is almost everywhere. So composite against it rather than declining.
        //
        // Deliberately NOT extended to url() images. A photo has no single ground, and guessing
        // one would trade a blind spot for a wrong answer — which is worse, because a wrong
        // answer looks like a real finding. Same reasoning as the original decline.
        //
        // The approximation is honest but not free: where the gradient is DARKER than the colour
        // beneath it, the true ratio is slightly worse than this reports. It under-reports rather
        // than inventing findings, which is the right direction for a gate meant to be believed.
        const gradientOnly = !/url\(/i.test(img);
        if (gradientOnly && c && c.a >= 0.999) return acc ? over(acc, c) : c;
        return null;
      }

      if (c && c.a > 0) acc = acc ? over(acc, c) : c;
      if (acc && acc.a >= 0.999) return acc;
      node = node.parentElement;
    }
    // Nothing opaque all the way up: the canvas shows through.
    const canvas = parseColor(getComputedStyle(document.documentElement).backgroundColor);
    const base = canvas && canvas.a > 0 ? canvas : { r: 255, g: 255, b: 255, a: 1 };
    return acc ? over(acc, base) : base;
  };

  // ── R1 · the page must never scroll sideways ───────────────────────────────
  if (wanted('page-overflow')) {
    const de = document.documentElement;
    const over_ = de.scrollWidth - de.clientWidth;
    if (over_ > 1) {
      const culprits = [];
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > de.clientWidth + 1) culprits.push(`${sigOf(el)} (right ${Math.round(r.right)}px)`);
        if (culprits.length >= 5) break;
      }
      add('page-overflow', 'document', `page scrolls sideways by ${Math.round(over_)}px · widest: ${culprits.join(' | ') || 'none identified'}`);
    }
  }

  // ── R2 · every control clears the tap floor ────────────────────────────────
  // tapFloor arrives as 0 at pointer widths - the caller decides, so the reasoning lives in one
  // place next to TAP_FLOOR_MAX_WIDTH rather than being re-derived inside the browser.
  if (wanted('tap-floor') && tapFloor > 0) {
    for (const el of Array.from(root.querySelectorAll(CONTROL_SEL))) {
      if (!visible(el) || isExempt(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < tapFloor - 0.5) add('tap-floor', sigOf(el), `${Math.round(r.height)}px tall (floor ${tapFloor})`);
    }
  }

  // ── R2b · a control must be INSIDE the screen it is painted on ─────────────
  //
  // ⚠⚠ THIS RULE EXISTS BECAUSE R1 CANNOT SEE THE DEFECT IT LOOKS LIKE IT WOULD CATCH.
  //
  // Owner QA §68: the marketing header's "Get Started" button hung 66px past the right edge of a
  // 320px screen on every public page, and had done since launch. R1 asks the DOCUMENT whether it
  // scrolls sideways — and the answer was no, at every width, truthfully. The bar is
  // `position: fixed`, and a fixed element's overflow never reaches `documentElement.scrollWidth`.
  // So the page did not scroll, which is not the absence of the bug; it IS the bug. The button was
  // off the screen with no way to bring it back.
  //
  // Measured before the fix, homepage, R1's own numbers: 320px → scrollWidth 320, clientWidth 320,
  // rule silent; button's right edge 386px at every one of 320/360/361/375. Listing the marketing
  // pages under the existing six rules would have swept them GREEN.
  //
  // The rule is deliberately about CONTROLS, not boxes — CONTROL_SEL, the same definition the tap
  // floor reads. A decorative element off-canvas is a style; a button off-canvas is a dead end. It
  // also runs at EVERY width, unlike the tap floor: fingers are a phone concern, but a control you
  // cannot click is nobody's idea of working, and this bar's own defect reached 390px within four
  // pixels.
  //
  // ⚠ WHAT THIS RULE DOES NOT ASK, DELIBERATELY (reviewed and scoped 2026-08-21). It compares a
  // control against the SCREEN, not against a nearer box that might be clipping it. A button laid
  // out past the edge of an `overflow: hidden` card is equally unreachable and equally invisible,
  // and this rule stays silent about it. That is a real gap and it is left open on purpose: the
  // coach styles alone carry ~98 `overflow: hidden` rules — rounded corners, collapse animations,
  // carousels — and a rule that flagged every control inside one would be a rule that arrives red
  // everywhere and gets baselined into silence on day one. "A control clipped by its own
  // container" is a DIFFERENT rule with a different exemption set, and it deserves to be designed
  // and measured rather than bolted onto this one. Do not quietly widen the check below; write
  // that rule.
  //
  // ⚠ THE EXEMPTION THAT MATTERS: a control inside something that scrolls sideways is REACHABLE —
  // the portal's tournament tab strip and its wide tables are built exactly that way, and flagging
  // them would be flagging a working design. So the walk up the ancestors asks whether any of them
  // can be scrolled to reveal the control, and stays quiet when one can. Off-canvas drawers are
  // skipped by `visible()` (they are hidden or transparent when closed); one that is neither is a
  // control a user can't reach, which is the finding.
  if (wanted('control-offscreen')) {
    const vw = document.documentElement.clientWidth;
    // ⚠ The walk INCLUDES <body>. Stopping before it (the first version did) means a page that
    // legitimately puts `overflow-x: auto` on the body would have every control inside it reported
    // as unreachable, when scrolling that body is exactly how you reach them. No page does that
    // today — this is a trap disarmed before it is stepped in, not a bug being fixed.
    const inSideScroller = (el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth - n.clientWidth > 1) return true;
        if (n === document.body) break;
      }
      return false;
    };
    for (const el of Array.from(root.querySelectorAll(CONTROL_SEL))) {
      if (!visible(el) || isExempt(el)) continue;
      if (el.closest('[aria-hidden="true"], [inert]')) continue;
      const r = el.getBoundingClientRect();
      const past = Math.round(r.right - vw);
      const before = Math.round(-r.left);
      if (past <= 1 && before <= 1) continue;
      if (inSideScroller(el)) continue; // reachable by scrolling its own box
      add(
        'control-offscreen',
        sigOf(el),
        past > 1
          ? `${past}px past the right edge (screen ${vw}px) with no scroller to reveal it`
          : `${before}px past the left edge with no scroller to reveal it`,
      );
    }
  }

  // ── R3 · wide content scrolls in its OWN box, never the page ───────────────
  if (wanted('content-overflow')) {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (el === document.body || el === document.documentElement) continue;
      if (!visible(el) || isExempt(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible') continue; // it owns its scroll, or deliberately clips
      const spill = el.scrollWidth - el.clientWidth;
      if (spill > 1) add('content-overflow', sigOf(el), `content spills ${Math.round(spill)}px with overflow-x:visible — no scroller owns it`);
    }
  }

  // ── R4 · a sticky element must actually be able to stick ───────────────────
  //
  // ⚠ PER AXIS. A first version checked VERTICAL travel for every sticky element and duly reported
  // the depth chart's frozen player column and the rotation grid's header row as "inert" — they
  // stick HORIZONTALLY (`left: 0`) inside a container that scrolls sideways and, correctly, not
  // down. Sticking is directional; the check has to ask about the same direction the CSS does.
  //
  // ⚠ AND NOT WHILE A MODAL IS OPEN, for the page beneath it. An `aria-modal` dialog locks the
  // body's scroll, so every sticky header on the inert page behind it reports "trapped in a body
  // with no vertical travel" — true, and meaningless: nobody is scrolling that page. Same reading
  // as the modal exemption in R6 below (`openModal`, resolved once above). Sticky elements INSIDE
  // the dialog are still checked.
  if (wanted('sticky-no-travel')) {
    for (const el of Array.from((openModal ?? root).querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'sticky') continue;
      if (!visible(el) || isExempt(el)) continue;

      const axes = [];
      if (cs.top !== 'auto' || cs.bottom !== 'auto') axes.push('y');
      if (cs.left !== 'auto' || cs.right !== 'auto') axes.push('x');
      if (!axes.length) {
        add('sticky-no-travel', sigOf(el), 'position:sticky with every offset auto — it can never engage');
        continue;
      }

      for (const axis of axes) {
        const overflowProp = axis === 'y' ? 'overflowY' : 'overflowX';
        let a = el.parentElement, scroller = null;
        while (a) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a)[overflowProp])) { scroller = a; break; }
          a = a.parentElement;
        }
        // No clipping ancestor means the document scrolls it, and the document has travel
        // whenever the page is longer/wider than the viewport.
        const target = scroller || document.documentElement;
        const scrollSize = axis === 'y' ? target.scrollHeight : target.scrollWidth;
        const clientSize = axis === 'y' ? target.clientHeight : target.clientWidth;
        if (scrollSize > clientSize + 1) continue; // it can travel — nothing to say

        // ⚠ INERT IS NOT THE SAME AS BROKEN. A frozen table column whose table currently fits on
        // screen is inert, and correct — there is nothing to scroll past, so nothing to stick to.
        // Reporting that would bury the real defect in noise from every table that happens to fit.
        // The bug worth catching is a sticky element TRAPPED in a non-scrolling ancestor that
        // itself runs past the viewport, so the user scrolls the page and the "sticky" thing
        // sails away — which is exactly what re-adding overflow to the coaches main would cause.
        const box = target.getBoundingClientRect();
        const extent = axis === 'y' ? box.height : box.width;
        const viewport = axis === 'y' ? window.innerHeight : window.innerWidth;
        if (extent <= viewport + 1) continue; // stickiness is moot here

        add(
          'sticky-no-travel',
          `${sigOf(el)}·${axis}`,
          `sticks on ${axis === 'y' ? 'top/bottom' : 'left/right'} but is trapped in <${target.tagName.toLowerCase()}>, which runs ${Math.round(extent)}px past a ${viewport}px viewport yet has no ${axis === 'y' ? 'vertical' : 'horizontal'} travel (${scrollSize}≤${clientSize}) — it will scroll away instead of sticking`,
        );
      }
    }
  }

  // ── R5 · text must be readable against what is actually painted behind it ──
  if (wanted('contrast')) {
    const seen = new Set();
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (!visible(el) || isExempt(el)) continue;
      // Only elements with their own text — otherwise every wrapper reports its child's text.
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();
      if (!ownText) continue;

      const cs = getComputedStyle(el);
      const fg = parseColor(cs.color);
      if (!fg || fg.a === 0) continue;
      const bg = effectiveBg(el);
      if (!bg) continue; // image or gradient behind — a human judges this one

      const composed = fg.a < 1 ? over(fg, bg) : fg;
      const cr = ratio(composed, bg);
      const size = parseFloat(cs.fontSize);
      const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const floor = large ? 3 : 4.5;
      if (cr < floor) {
        const sig = `${sigOf(el)}·${cs.color}on${bg.r | 0},${bg.g | 0},${bg.b | 0}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        add('contrast', sig, `${cr.toFixed(2)}:1 (needs ${floor}:1) — ${cs.color} on rgb(${bg.r | 0}, ${bg.g | 0}, ${bg.b | 0}) at ${Math.round(size)}px`);
      }
    }
  }

  // ── R6 · nothing usable may hide under fixed chrome ────────────────────────
  //
  // ⚠ THIS RULE IS DELIBERATELY CONSERVATIVE, and the reason is worth keeping. A first version
  // asked `elementFromPoint` alone whether something else was on top. It reported two cards as
  // buried under the bottom nav; measured directly, their centres sat at y=669 and the nav began
  // at y=772 — they were not covered at all, and a re-run produced a different answer again. Two
  // causes: the dev overlay was winning the hit test (now exempt), and an element scrolled up
  // under the masthead reads as "covered" when it is merely scrolled, which is what scrolling IS.
  //
  // So a finding now needs THREE things to agree: the element is fully in view, a fixed bar's box
  // really does contain its centre, and the hit test independently confirms something else is on
  // top. A gate that cries wolf gets switched off, so it errs toward silence.
  //
  // ⚠ AND IT IS ANCHOR-AWARE, which is the third correction this rule needed. Being under a fixed
  // bar only TRAPS something when the page cannot be scrolled the way that would reveal it:
  //   · a bar pinned to the TOP hides content only at scroll 0 — anywhere else, scroll up;
  //   · a bar pinned to the BOTTOM hides content only at the very end — anywhere else, scroll down.
  // Checking both bars at both positions is what produced 46 phantom findings: at scroll 0 every
  // control that happened to lie in the bottom bar's band was reported, though scrolling reveals
  // it, and at the end everything that had passed under the masthead was reported likewise.
  // Independently measured, the roster had ZERO trapped controls at 361/390/768 — `main` reserves
  // exactly the nav's 72px — while the sweep claimed six.
  //
  // Chrome anchored to neither edge (a floating toast) is out of scope: it is transient, and
  // judging it needs a human.
  if (wanted('hidden-behind-chrome')) {
    // ⚠ AN OPEN MODAL IS NOT CHROME (2026-08-14) — see `openModal` above, resolved once for the
    // whole probe. The rule exists to catch a fixed NAV or ACTION BAR sitting on content the user
    // is supposed to be able to read or press; a dialog covering the page is the dialog working.
    // So the dialog becomes the root, and the question narrows to the one that still means
    // something — is anything INSIDE it covered by chrome (its own sticky footer, the portal's
    // bars on a phone)?
    const modal = openModal;
    const scope = modal ?? root;

    const atTop = window.scrollY <= 2;
    const atEnd = Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 2;
    const bars = Array.from(document.querySelectorAll('*')).filter((b) => {
      // The overlay that carries the dialog, and the dialog panel itself, are the modal — not
      // chrome laid over it.
      if (modal && (b.contains(modal) || modal.contains(b) || b === modal)) return false;
      if (getComputedStyle(b).position !== 'fixed' || !visible(b) || isExempt(b)) return false;
      const r = b.getBoundingClientRect();
      if (r.width * r.height < 1000) return false; // a real bar, not a stray positioned dot
      const topAnchored = r.top <= 2;
      const bottomAnchored = r.bottom >= window.innerHeight - 2;
      return (topAnchored && atTop) || (bottomAnchored && atEnd);
    });

    if (bars.length) {
      // ⚠ NOT JUST CONTROLS (widened 2026-08-03 by the backtest). The first version asked only
      // about interactive elements, and was verified SILENT on the real defect that motivates this
      // rule: restoring the /coaches/join overlap (537689e3) put the card's heading at y=16 under
      // a 64px fixed nav — precisely what was reported — while the nearest BUTTON sat at y=150 and
      // the rule reported nothing. "The header is covering the page" is nearly always about text.
      //
      // Prose containers only — never a bare div. A wrapper's centre can sit anywhere relative to
      // its children, so a covered div says nothing about whether anything readable is covered,
      // and the three-way agreement below (fully in view · the bar's box really contains the
      // centre · the hit test names something else) is the only thing keeping this rule believable.
      const sel =
        'button, a[href], summary, select, textarea, input:not([type="hidden"]), [role="button"], ' +
        'h1, h2, h3, h4, p, li, dt, dd, figcaption, blockquote';
      for (const el of Array.from(scope.querySelectorAll(sel))) {
        if (!visible(el) || isExempt(el)) continue;
        const r = el.getBoundingClientRect();
        // Fully in view. Anything hanging off an edge is scrolled, not trapped.
        if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) continue;

        const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
        const bar = bars.find((b) => {
          if (b === el || b.contains(el) || el.contains(b)) return false;
          const br = b.getBoundingClientRect();
          return cx >= br.left && cx <= br.right && cy >= br.top && cy <= br.bottom;
        });
        if (!bar) continue;

        // Independent confirmation: whatever is painted at that point is not this element.
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || el.contains(hit) || hit.contains(el)) continue;
        if (hit.closest('nextjs-portal')) continue;

        // ⚠ AND THE ELEMENT MUST ACTUALLY BE PAINTED THERE. Widening this rule to prose (§10.2)
        // immediately produced a plausible false positive: the practice-run screen's attendance
        // accordion keeps its children MOUNTED while closed, so they carry real boxes — non-zero
        // size, visibility:visible, opacity:1 — that land in the bottom nav's band. Every check
        // above agreed, and the finding read exactly like a trapped row on the one screen a coach
        // uses one-handed outdoors. It was not: discounting the bar showed <main> at that point,
        // never the paragraph. Layout geometry is not proof of paint.
        //
        // elementsFromPoint returns the full z-ordered stack, so an element that is genuinely
        // UNDERNEATH the bar appears in it below the bar, while one that is merely laid out there
        // does not appear at all. Non-mutating, unlike hiding the bar to look behind it.
        //
        // ⚠ THE ELEMENT OR ONE OF ITS DESCENDANTS — never an ancestor. <main> contains the
        // unpainted paragraph and sits in the stack at that point, so accepting ancestors would
        // wave the false positive straight through.
        const stack = document.elementsFromPoint(cx, cy);
        const painted = stack.some((s) => s === el || el.contains(s));
        if (!painted) continue;

        add('hidden-behind-chrome', sigOf(el), `centre (${cx},${cy}) sits under fixed ${sigOf(bar)}; hit test returns ${sigOf(hit)}`);
      }
    }
  }

  return out;
}

// ── baseline ──────────────────────────────────────────────────────────────────
const keyOf = (f) => `${f.screen}|${f.width}|${f.rule}|${f.signature}`;

/**
 * Was this screen/width pair actually SWEPT by this run? Used by `--init` and `--prune` to decide
 * which baseline entries are theirs to touch.
 *
 * ⚠ It must ask `runsAt`, not just "is the width in the list". 320 is in the width list for the
 * whole run but is only swept on the screens that opted in (§68), so a plain membership test would
 * declare every coach screen "covered at 320", find no findings there, and prune is a delete.
 */
const coversPair = (screenId, widthName) => {
  const s = screens.find((x) => x.id === screenId);
  const w = widths.find((x) => x.name === widthName);
  return !!s && !!w && runsAt(s, w);
};

function readBaseline() {
  if (!existsSync(BASELINE)) return { entries: {} };
  try { return JSON.parse(readFileSync(BASELINE, 'utf8')); }
  catch { console.error(`✗ ${path.relative(ROOT, BASELINE)} is not valid JSON.`); process.exit(1); }
}

// ── run ───────────────────────────────────────────────────────────────────────
async function reachable(url) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    await fetch(url, { signal: c.signal });
    clearTimeout(t);
    return true;
  } catch { return false; }
}

let ctx;
try {
  ctx = await resolveUatContext();
} catch (e) {
  console.error(`✗ UAT fixture unavailable.\n  ${e.message}`);
  process.exit(1);
}

if (!(await reachable(ctx.baseUrl))) {
  console.error(`✗ Dev server not reachable at ${ctx.baseUrl}\n  Repair: npm run dev`);
  process.exit(1);
}

const neededSessions = [...new Set(screens.map((s) => s.session))];
for (const s of neededSessions) {
  const f = SESSION_FILES[s];
  if (f && !existsSync(f)) {
    console.error(`✗ Missing session for "${s}": ${path.relative(ROOT, f)}\n  Repair: npx playwright test --config playwright.config.ts --project=auth-setup`);
    process.exit(1);
  }
}

const exemptSelectors = CHROME_EXEMPT.map((e) => e.sel);
const findings = [];
const landingFailures = [];
const navFailures = [];

// ⚠ A sweep is the heaviest thing this repo asks of a dev server: every screen it has not seen
// yet is compiled on demand and then held forever. Refuse to start with no headroom, and watch
// it as we go — see scripts/memory-guard.mjs for what happened the two times nothing was watching.
preflight('Memory');
const memory = createWatchdog('layout sweep');
let aborted = null;

const browser = await chromium.launch();
console.log(`Layout sweep · ${screens.length} screen(s) · ${pairCount} screen-width pair(s) · ${ctx.baseUrl}\n`);

for (const session of neededSessions) {
  if (aborted) break;
  const list = screens.filter((s) => s.session === session);
  if (!list.length) continue;
  const file = SESSION_FILES[session];
  // ⚠ reducedMotion is not a nicety. `app/globals.css` sets `html { scroll-behavior: smooth }`, so
  // a programmatic scroll ANIMATES — and the covered-by-chrome rule, which measures after scrolling
  // to the end, was reading a mid-flight position. The app already honours prefers-reduced-motion
  // with `scroll-behavior: auto !important`, so asking for it here uses the product's own code path
  // to make the measurement deterministic.
  const context = await browser.newContext({
    ...(file ? { storageState: file } : {}),
    reducedMotion: 'reduce',
  });

  // ⚠⚠ A CLOSED NAV GROUP IS AN UNMEASURED NAV GROUP. The coach rail's groups collapse and "Team"
  // starts CLOSED (Phase 5b, 2026-08-18), which would quietly take Roster, Tryouts, Staff,
  // Documents and Settings out of every layout invariant on every coach screen — the sweep would
  // stay green while measuring five fewer doors than it reports. Seeding the rail's own storage key
  // with all five groups open uses the product's own preference path rather than a test-only hook,
  // so what the sweep measures is a real state a coach can be in. Pinned from the other end by
  // tests/unit/coach-nav-groups.test.ts, because this failure is invisible.
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        'flhq-coach-nav-groups',
        JSON.stringify(['Season', 'Progress', 'Money', 'Communication', 'Team']),
      );
    } catch { /* private-mode browsers throw; the sweep then measures the defaults */ }
  });

  for (const w of widths) {
    if (aborted) break;
    const page = await context.newPage();
    await page.setViewportSize({ width: w.width, height: w.height });

    for (const screen of list) {
      if (!runsAt(screen, w)) continue; // an opt-in width this screen didn't ask for
      const url = ctx.baseUrl + screen.path(ctx);
      const label = `${screen.id} @${w.name}`;
      // Checked before the page is opened, not after: the goal is to not take the next bite.
      aborted = memory.check(label);
      if (aborted) break;
      try {
        // ⚠ Generous on purpose. The dev server compiles each route on first visit, and the help
        // hub — which renders the whole guide catalogue — exceeded a 60s ceiling on a cold cache
        // and was reported as "did not render" when it was merely still building.
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 150_000 });
        await page.waitForSelector(screen.ready, { timeout: 150_000, state: 'attached' });
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      } catch (e) {
        navFailures.push({ label, url, why: String(e.message || e).split('\n')[0] });
        console.log(`  ✗ ${label} — did not render`);
        continue;
      }

      // ⚠ Did we actually LAND? A screen that renders "Not assigned to any teams" measures
      // perfectly and means nothing. This is the trap the existing coach specs document.
      const body = (await page.textContent('body').catch(() => '')) || '';
      const landed = LANDING_FAILURES.find((t) => body.includes(t));
      if (landed) {
        landingFailures.push({ label, url, saw: landed });
        console.log(`  ✗ ${label} — landed on "${landed}"`);
        continue;
      }

      // The tap floor is a touch rule (see TAP_FLOOR_MAX_WIDTH). Above that width it is not
      // relaxed to a smaller number - it is not asked, because 44px answers a question about
      // fingers that a mouse never posed.
      const tapFloorHere = w.width <= TAP_FLOOR_MAX_WIDTH ? TAP_FLOOR : 0;
      const opts = { scopeSel: screen.scope ?? null, tapFloor: tapFloorHere, exempt: exemptSelectors, only: null };
      let found = await page.evaluate(probeInPage, opts);

      // The classic defect — the last row trapped under the bottom bar — only exists once the
      // page is scrolled to its end, so that rule is asked a second time down there.
      //
      // ⚠ The scroll is driven to a FIXED POINT and confirmed, not fired once and hoped for.
      // Smooth scrolling plus content that settles after paint meant a single scrollTo left the
      // page short of the end (measured: 1496 of 1567), so the second pass was reading an
      // arbitrary mid-page position.
      const reachedBottom = await page.evaluate(async () => {
        const de = document.documentElement;
        const prev = de.style.scrollBehavior;
        de.style.scrollBehavior = 'auto';
        let settled = false;
        for (let i = 0; i < 30; i++) {
          de.scrollTop = de.scrollHeight;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          if (Math.abs(de.scrollTop + de.clientHeight - de.scrollHeight) <= 2) { settled = true; break; }
        }
        de.style.scrollBehavior = prev;
        return settled;
      });
      if (!reachedBottom) console.log(`      ! ${label}: page would not settle at its end — covered-by-chrome skipped`);
      const atBottom = reachedBottom
        ? await page.evaluate(probeInPage, { ...opts, only: ['hidden-behind-chrome'] })
        : [];

      const bySig = new Map();
      for (const f of [...found, ...atBottom]) {
        const k = `${f.rule}|${f.signature}`;
        if (!bySig.has(k)) bySig.set(k, f);
      }
      const skip = new Set(screen.skip ?? []);
      const kept = [...bySig.values()].filter((f) => !skip.has(f.rule));
      for (const f of kept) findings.push({ ...f, screen: screen.id, width: w.name });

      console.log(`  ${kept.length ? '·' : '✓'} ${label}${kept.length ? ` — ${kept.length} finding(s)` : ''}`);
    }
    await page.close();
  }
  await context.close();
}
await browser.close();

// ⚠ Must come BEFORE anything that writes the baseline. An aborted sweep left screens
// unmeasured, and unmeasured screens contribute no findings — so a baseline written from one
// records the product as cleaner than it is. Same reasoning as the partial-run guard below,
// except an abort produces no nav failures for that guard to catch, so it needs its own exit.
// ⚠ And unlike that guard, this one has NO --allow-partial escape hatch, deliberately: a nav
// failure is a countable, inspectable set of screens you might knowingly accept, whereas an
// abort stopped at an arbitrary point with an unknown remainder. There is no case where
// snapshotting that is the right thing to do, so the override is not offered.
if (aborted) {
  memory.report(aborted);
  process.exit(1);
}
memory.summarise();

// ── hard failures first: a screen we could not measure is not a pass ──────────
if (navFailures.length || landingFailures.length) {
  console.error('\n✗ Screens that could not be measured — these are failures, not skips:');
  for (const f of navFailures) console.error(`    ${f.label} — ${f.why}\n      ${f.url}`);
  for (const f of landingFailures) console.error(`    ${f.label} — landed on "${f.saw}"\n      ${f.url}`);
  console.error(`\n  Usual causes: the fixture is incomplete (node scripts/seed-uat-coach-fixture.mjs),`);
  console.error(`  the session is stale (npx playwright test --config playwright.config.ts --project=auth-setup),`);
  console.error(`  or the dev server died mid-run — a full sweep has exhausted its heap before now,`);
  console.error(`  which kills every remaining screen. Restart it and re-run the missing width.`);
  if (mode === 'check') process.exit(1);

  // ⚠ NEVER snapshot a partial run. An unmeasured screen contributes no findings, so a baseline
  // written from a crashed sweep silently records the product as cleaner than it is — and the
  // headline "look how much this improved" is then partly just screens nobody looked at. This
  // exact thing happened on 2026-08-02: the server ran out of memory during the 1440 pass and 26
  // of 112 combinations went unmeasured, which would have overstated a colour fix by a wide margin.
  if ((mode === 'init' || mode === 'prune') && !has('--allow-partial')) {
    console.error(`\n✗ Refusing to write the baseline from an incomplete run (${navFailures.length + landingFailures.length} unmeasured).`);
    console.error(`  Fix the cause and re-run, or narrow the run: --width=<w> / --only=<ids>.`);
    console.error(`  To override deliberately: --allow-partial`);
    process.exit(1);
  }
}

// ── modes ─────────────────────────────────────────────────────────────────────
const baseline = readBaseline();

if (mode === 'init') {
  const entries = {};
  for (const f of findings) {
    const k = keyOf(f);
    entries[k] = { reason: baseline.entries?.[k]?.reason ?? null, detail: f.detail };
  }
  // Keep entries outside this run's scope (a --only run must not erase the rest of the file).
  const covered = new Set(findings.map(keyOf));
  const inScope = (k) => {
    const [screen, width] = k.split('|');
    return coversPair(screen, width);
  };
  for (const [k, v] of Object.entries(baseline.entries ?? {})) {
    if (!inScope(k) && !covered.has(k)) entries[k] = v;
  }
  writeFileSync(BASELINE, JSON.stringify({ generated: new Date().toISOString(), entries }, null, 2) + '\n');
  const unexplained = Object.values(entries).filter((e) => !e.reason).length;
  console.log(`\nBaseline written: ${Object.keys(entries).length} entr(ies), ${unexplained} without a reason.`);
  console.log(`  ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

const known = baseline.entries ?? {};
const seen = new Set(findings.map(keyOf));
const fresh = findings.filter((f) => !(keyOf(f) in known));
const stale = Object.keys(known).filter((k) => {
  const [screen, width] = k.split('|');
  return coversPair(screen, width) && !seen.has(k);
});

if (mode === 'prune') {
  const entries = { ...known };
  for (const k of stale) delete entries[k];
  writeFileSync(BASELINE, JSON.stringify({ generated: new Date().toISOString(), entries }, null, 2) + '\n');
  console.log(`\nPruned ${stale.length} fixed entr(ies). ${Object.keys(entries).length} remain.`);
  process.exit(0);
}

if (mode === 'report') {
  mkdirSync(path.dirname(REPORT), { recursive: true });
  const byRule = {};
  for (const f of findings) (byRule[f.rule] ??= []).push(f);
  let md = `# Layout invariants — inventory\n\n`;
  md += `> Auto-generated: \`node scripts/check-layout-invariants.mjs --report\`. Read-only analysis.\n\n`;
  md += `${screens.length} screens · ${pairCount} screen-width pairs · **${findings.length}** open finding(s).\n\n`;
  md += `## The house rules\n\n`;
  md += `| Rule | What it holds |\n|---|---|\n`;
  md += `| \`page-overflow\` | The page never scrolls sideways. |\n`;
  md += `| \`tap-floor\` | Every control clears ${TAP_FLOOR}px — at touch widths (≤${TAP_FLOOR_MAX_WIDTH}px) only. |\n`;
  md += `| \`control-offscreen\` | Every control sits inside the screen, or inside something that scrolls to reveal it. |\n`;
  md += `| \`content-overflow\` | Wide content scrolls inside its own box. |\n`;
  md += `| \`sticky-no-travel\` | Anything sticky can actually stick. |\n`;
  md += `| \`contrast\` | Text is readable against what is painted behind it. |\n`;
  md += `| \`hidden-behind-chrome\` | Nothing usable hides under a fixed bar. |\n\n`;
  for (const [rule, list] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
    md += `## \`${rule}\` — ${list.length}\n\n`;
    for (const f of list) md += `- **${f.screen}** @${f.width} · ${f.signature}\n  - ${f.detail}\n`;
    md += `\n`;
  }
  writeFileSync(REPORT, md);
  console.log(`\nReport written: ${path.relative(ROOT, REPORT)} (${findings.length} finding(s))`);
  process.exit(0);
}

// ── check ─────────────────────────────────────────────────────────────────────
console.log('');
if (fresh.length) {
  console.error(`✗ ${fresh.length} NEW layout finding(s):\n`);
  const byScreen = {};
  for (const f of fresh) (byScreen[f.screen] ??= []).push(f);
  for (const [screen, list] of Object.entries(byScreen)) {
    console.error(`  ${screen}`);
    for (const f of list) console.error(`    @${f.width} [${f.rule}] ${f.signature}\n        ${f.detail}`);
  }
  console.error(`\n  Fix them, or — if one is a deliberate decision — record it with a reason:`);
  console.error(`    node scripts/check-layout-invariants.mjs --init   (then write the reason into the entry)`);
  process.exit(1);
}

const unexplained = Object.values(known).filter((e) => !e.reason).length;
console.log(`✓ No new layout findings. Baseline: ${Object.keys(known).length} known (${unexplained} without a reason).`);
if (stale.length) {
  console.log(`\n  ${stale.length} baseline entr(ies) no longer reproduce — the ratchet can tighten:`);
  for (const k of stale.slice(0, 15)) console.log(`    ${k}`);
  if (stale.length > 15) console.log(`    …and ${stale.length - 15} more`);
  console.log(`  Drop them: node scripts/check-layout-invariants.mjs --prune`);
}
