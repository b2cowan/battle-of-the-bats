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
 *   … --theme=dark | warm      run in that account theme (default: the session's own — warm)
 *                              dark measures CONTRAST ONLY, at 361 + 1440 unless --width says otherwise
 *   … --workers=<n>            measure n pages at once (default 1, or 4 when UAT_BASE_URL is set —
 *                              say --workers=1 if that address is a dev server)
 *   … --dump=<file.json>       also write every finding this run saw, for a before/after diff
 *   … --changed                just the screens the working tree touches (an explicit --only wins)
 *   … --allow-partial          let --init / --prune write from a run with unmeasured screens
 *   … --sidebar=strip          measure with the sidebar collapsed to its icon strip (desktop widths only)
 *   … --width=<px>             a width not in the list (≥901, e.g. 1280): measured and dumped, never baselined
 *   … --resume                 measure only what the last run with the same flags did not finish (its journal)
 *   … --with-dark              also read dark contrast on each warm page at 361 + 1440, in place (the release run)
 *   … --theme=dark --init      record the dark-only findings as accepted (owner's word only; its own file)
 *   node scripts/check-layout-invariants.mjs --help          this list, and nothing else
 *
 * ⚠ AN UNKNOWN FLAG IS REFUSED, and nothing is swept. Until 2026-09-30 one was silently ignored, so a
 * mistyped flag — or `--help`, which did not exist — started a full sweep (~20 minutes of the dev
 * server; Admin Design Continuity Part B lost a quiet window's minutes to it beside a capture).
 *
 * ⚠ THE BASELINE HAS NO THEME. It was recorded in the default (warm — no UAT session stores a
 * theme), so `--prune` refuses `--theme`. A dark run is checked against the same warm
 * entries, matching a contrast finding on its ELEMENT rather than its colours (a signature carries
 * its colours, which differ between the themes by design) — so what it reports as NEW is what is
 * unreadable in dark and not already known in warm.
 *
 * ⚠ DARK HAS ITS OWN ACCEPTED LIST, for what is dark-ONLY (owner, 2026-11-15, Release process hardening ask A3).
 * Before it, every dark-only finding was re-judged by hand on every release. `--theme=dark --init` records the
 * dark-only findings (those the warm baseline does not already hold) in `scripts/.layout-baseline-dark.json`, whole
 * key, colours included, so a changed colour on an accepted element reads as new again. It is written on the owner's
 * word only, exactly as the warm one is; a dark run then reports only what is new since it.
 *
 * ⚠ A DARK RUN MEASURES CONTRAST AND NOTHING ELSE (owner, 2026-10-13). The theme changes colour, not
 * geometry: dark is the base stylesheet and warm overrides it in ~300 rules, and the only override
 * that moves a box is the chat panel's sender label. The release sweep of 2026-10-13 confirmed it —
 * 200 pairs measured in both themes, 33 findings seen only in dark, every one of them contrast. A
 * full dark pass was half of every release sweep's time spent re-measuring identical geometry. It
 * runs at 361 + 1440 rather than one width because the two showed DIFFERENT elements failing (a
 * phone hides some, the desktop others) and between them caught every dark-only finding.
 *
 * ⚠ POINT IT AT A PRODUCTION BUILD FOR A WHOLE SWEEP (owner, 2026-10-13). `UAT_BASE_URL` picks the
 * server: the release sweep runs against staging, a long local run against `next build` + `next
 * start` on another port. The dev server compiles every route on first visit, runs development
 * React, and leaks per request, which is why a full sweep against it took hours and had to be fed
 * in memory-guarded chunks. It stays the target for a `--changed` run of a few screens.
 *
 * ⚠ `--sidebar=strip` MEASURES THE SIDEBAR COLLAPSED (Sidebar Strip & Grid Width, Stage 2). Every portal's
 * sidebar can fold to a 64 strip of icons, by choice, per device; the pages beside it then get 176 more
 * (club, tournament), 156 (Premium coach) or 184 (free coach). The run seeds the product's own setting
 * (`flhq-sidebar`, read pre-paint by the root no-flash script) and measures desktop widths only — at 900
 * and under every portal shows its bottom bar and no sidebar, so a phone width would measure nothing new.
 * It is checked against the SAME baseline: a finding already known with the full sidebar is not new, so
 * what it reports is what the strip itself broke (a screen that assumed exactly 240 of sidebar). A
 * deliberate strip-only finding is recorded under its own key (`<width>@strip`), which only a strip run
 * writes, prunes or reads — a full run never touches them, and a strip run never touches the rest.
 *
 * ⚠ `--width=<px>` for a width NOT in the list (≥901 — the strip's laptop widths, 1280 and 1366) is an
 * ad-hoc measurement: it has no baseline, so every finding reads as new. Use it with `--dump` in both
 * sidebar states and diff the two files; `--init` and `--prune` refuse it.
 *
 * ── HOW A RUN STARTS, FAILS, RESUMES AND REPORTS (Release process hardening, Stage 1A, 2026-11-15) ──────
 * The whole-product sweep had not finished for three releases, and none of it was the measuring: a low-memory stop
 * threw away every finished screen, a dead screen was waited on for 150 s twice, and stale sign-ins or an expired
 * fixture were found an hour in. On 2026-11-14 a run spent 2 h 18 min on 35 dead screens and wrote nothing. WHAT IS
 * MEASURED DID NOT CHANGE; how a run behaves around it did. ⚠ THIS HEADER IS THE SINGLE HOME FOR THE SWEEP'S NUMBERS.
 *
 *   1. THE FIRST MINUTE. Before the first screen: the target answers 200; every fixture the selected screens need
 *      resolves, including the public tournament fixtures that expire with the clock (`FIXTURE_CHECKS` in
 *      layout-screens.mjs); every session in the run is signed in there; and one canary screen per session opens. All
 *      failures print together, each with its repair line, and nothing is swept. A screen marked `onlyWhereServed`
 *      that this server answers 404 for by design (the legal pages while their switch is off) is taken out of the run
 *      by name, and listed on the run's header and last lines and in the dump (`notServed`), never counted as measured.
 *   2. BUDGETS FIT THE TARGET. The dev server compiles on first visit and keeps 150 s per wait. A production build
 *      (`UAT_BASE_URL`) gets REMOTE_BUDGET_MS per wait, set from the healthy p95 the cost line reports (about three
 *      times it, never under 20 s; `budgetFromP95`). `LAYOUT_BUDGET_S=<s>` overrides it for one run. On a production
 *      build a page that has gone network-idle and then SETTLE_MS more without its ready mark is dead, not slow.
 *      The network-idle and no-loading waits are unchanged: they decide what is measured.
 *   3. A DEAD SCREEN COSTS SECONDS, ONCE. A screen that does not render is set aside; its other widths are not opened.
 *      After every unit has finished, it is retried once in a fresh context (no settle shortcut). If it renders, its
 *      other widths are measured then; if not, they are recorded unmeasured under its cause, without being opened.
 *      SESSION_DEAD_AFTER failures in a row inside one unit re-check the target and that session's sign-in; a dead
 *      session's remaining screens are recorded unmeasured under one cause line.
 *   4. PROGRESS IS KEPT. Each measured pair is appended to a journal under `.probe/layout-run/`, keyed by the build
 *      measured (on a production build its own build id, read from its page; on the dev server this checkout's HEAD),
 *      target, theme, sidebar, the measuring code and the pair list (layout-run-journal.mjs). `--resume` measures only
 *      the pairs the journal does not hold; the dump and the NEW comparison read the journal plus this run. A journal
 *      from another commit, target or list is refused by name. An abort still exits non-zero, and `--init`/`--prune`
 *      still refuse anything but a complete set (a resumed set that is complete is complete).
 *   5. LOW MEMORY PAUSES BEFORE IT QUITS. On a trip no new page is opened; the run waits (10 min, polling) for the
 *      floor plus 512 MB, then continues one page at a time, back to `--workers` at once after free memory has stayed
 *      above the floor plus 2 GB for 2 minutes. If the wait runs out it aborts as before, and `--resume`
 *      makes the re-run cheap. (scripts/memory-guard.mjs `waitForHeadroom`; `check()` is unchanged for other callers.)
 *   6. ONE PAGE IS NOT KEPT FOR A WHOLE UNIT. The page is replaced every RECYCLE_EVERY screens, in the same context, so
 *      device memory carries exactly as before.
 *   7. THE RUN REPORTS ITS OWN COST: wall-clock, per-pair p50/p95, the ten slowest pairs, retries, pauses, workers and
 *      the memory low-water mark, in the dump (`timing`) and on the run's last line.
 *
 * MEASURED on staging, 2026-11-15 (Stage 1A; the release records copy each run's own last line):
 *   - Same findings, old tool vs new: 18 screens / 75 pairs, 136 finding keys each, none different.
 *   - Kill test: 40-screen slice killed after 70 of 165 pairs, `--resume` measured the other 95 in 2 min 29 s; 91 finding
 *     keys straight-through, 91 resumed, none different. The straight run paused 3 times (other sessions' work took
 *     free memory to 544 MB) and finished.
 *   - Dead screens: the 35 `pubt-*` pairs of 2026-11-14 (2 h 18 min then) failed and were set aside in 3 min 19 s.
 *   - First minute: a spoiled session stopped the run in 3 s, by name; an expired fixture, a dead canary in 14 s.
 *   - `--with-dark` vs `--theme=dark`: 19 screens / 38 dark pairs, 67 dark finding keys each, none different.
 *   - Per pair: median 1–5 s for every kind of screen EXCEPT ~3/4 of the coach screens, ~31 s, because the coach
 *     Overview's prefetch loop keeps them from going network-idle (RELEASE_PROCESS_HARDENING_PLAN.md §2.5; fix prompt
 *     COACH_PREFETCH_LOOP_FIX_PROMPT.md). Without it a coach pair is ~3.5 s. The whole-product run with the loop was
 *     stopped at 734 of 1,469 pairs; its time after the fix is recorded by the next whole-product run.
 *   - REMOTE_BUDGET_MS stays 30 s: the healthy p95 measured was 5.5–6.5 s (budgetFromP95 → 20 s) once the looping
 *     coach pages are out; revisit from the first whole-product run after the fix.
 *
 * Needs a server running, and the UAT sessions present. Repair commands are printed on
 * failure rather than assumed.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveUatContext, resolveAdminContext, resolveFreeCoachContext } from './uat-fixture-context.mjs';
import { SCREENS, WIDTHS, FIXTURE_CHECKS, waitForNoLoading } from './layout-screens.mjs';
import { preflight, createWatchdog, PAUSE_DEFAULTS, freeMb } from './memory-guard.mjs';
import {
  digest, journalKey, journalFileName, keyMismatch, parseJournal, selectRemaining, pairLabel, pairListHash,
  timingSummary, formatDuration,
} from './layout-run-journal.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'scripts/.layout-baseline.json');
/** Dark's own accepted list: dark-only findings, on the owner's word (ask A3, 2026-11-15). See the header. */
const DARK_BASELINE = path.join(ROOT, 'scripts/.layout-baseline-dark.json');
const JOURNAL_DIR = path.join(ROOT, '.probe/layout-run');
const REPORT = path.join(ROOT, 'docs/agents/design/LAYOUT_INVARIANTS_REPORT.md');
// `LAYOUT_AUTH_DIR` points the run at another folder of saved sessions, the same file names (the first-minute test
// runs against a copy with one session spoiled, rather than spoiling the real ones other sessions are using).
const AUTH = process.env.LAYOUT_AUTH_DIR ? path.resolve(ROOT, process.env.LAYOUT_AUTH_DIR) : path.join(ROOT, 'tests/uat/.auth');

const SESSION_FILES = {
  coach: path.join(AUTH, 'coach.json'),
  orgOwner: path.join(AUTH, 'org-owner.json'),
  orgAdmin: path.join(AUTH, 'org-admin.json'),
  platformAdmin: path.join(AUTH, 'platform-admin.json'),
  // The admin side (Admin Design Continuity slice 0, 2026-09-25): the Club fixture's five roles —
  // the admin's frame differs by role, so a club screen is only measured for the role that opens it
  // (`tests/uat/auth.setup.ts` writes them; `node --env-file=.env.local scripts/seed-club-fixture.mjs`
  // builds the world) — and the tournament's volunteer, an `official` on the Plus org.
  repClubOwner: path.join(AUTH, 'rep-club-owner.json'),
  repClubAdmin: path.join(AUTH, 'rep-club-admin.json'),
  repClubTreasurer: path.join(AUTH, 'rep-club-treasurer.json'),
  repClubRegistrar: path.join(AUTH, 'rep-club-registrar.json'),
  repClubCoach: path.join(AUTH, 'rep-club-coach.json'),
  plusOfficial: path.join(AUTH, 'plus-official.json'),
  // The FREE coach (Free coach header parity B4, 2026-10-19): no organization, one free team — the free portal's
  // own shell and phone bar. `node scripts/seed-free-coach-fixture.mjs` builds it; `authenticate: free-coach` signs in.
  freeCoach: path.join(AUTH, 'free-coach.json'),
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

/**
 * Controls exempt from the CONTRAST rule only — every other rule still measures them. Each needs a reason.
 *
 * ⚠ The contrast probe reads the backgrounds of the element and its ancestors; it cannot see a chip a
 * pseudo-element paints behind the text. A control drawn that way reads as its own ink on the page
 * behind the chip, which is a measurement of nothing.
 */
const CONTRAST_EXEMPT = [
  {
    sel: '[class*="gdEntryBtn"]',
    reason:
      'Game day on the coach schedule: near-black words on a lime chip painted by `::after` behind them. ' +
      'Dark mode read it as 1.06:1 against the dark page. Accepted as a false positive (owner, 2026-10-14).',
  },
];

/**
 * Elements exempt from the CONTENT-OVERFLOW rule only — every other rule still measures them. Each needs a reason.
 * ⚠ Scoped as narrowly as the decision: a row (link or button) or its group's plain wrapper whose spill is a
 * corner mark, in the collapsed sidebar only. Never a scroll box (`nav`, `aside`): `closest` exempts a match's
 * whole subtree, and a sidebar exempted whole would hide a genuine overflow inside it.
 */
const OVERFLOW_EXEMPT = [
  {
    sel: "html[data-sidebar='strip'] :is(a, button):has(> [class*='cornerCount'], > [class*='cornerDot']), " +
      "html[data-sidebar='strip'] div:has(> :is(a, button) > [class*='cornerCount'], > :is(a, button) > [class*='cornerDot'])",
    reason:
      'The sidebar strip draws each count ON its icon\'s corner, overhanging the 40 target by 7 (ratified hub screens 8 ' +
      'and 9, the /design pass\'s item 3: the amber and lime pills keep their own 18). The overhang stays inside the 64 ' +
      'strip, which owns the scroll. A clip that would quiet the rule (overflow-clip-margin) does not reach Safari and ' +
      'would cut the pill there. One decision here, not one baseline entry per admin screen (Sidebar Strip Stage 2).',
  },
];

// Text that proves the page did NOT actually land where we asked. Measuring one of these is worse
// than measuring nothing, because it passes.
const LANDING_FAILURES = [
  'Not assigned to any teams',
  'Team not found',
  // 'Page not found' is NOT here: the product's own 404 eyebrow ("404 · Page not found", the S5 system screens) rides
  // in the inline data of EVERY page, so a textContent match failed the whole sweep (found 2026-10-27, 0 of 1293 pairs
  // measured). The 404 is held by its visible headline in VISIBLE_LANDING_FAILURES below.
  'This page could not be found',
  'Something went wrong',
  'Application error',
  'You do not have access',
];

/**
 * The product's OWN 404 page (`app/not-found.tsx`) — "Page not found" above is Next's default
 * wording, which this app replaced, so a screen that 404ed was measured as a pass (found
 * 2026-09-25). ⚠ Matched against VISIBLE text only: the 404 page is a server component, so its
 * markup rides inside the inline data of EVERY page, and a `textContent` match fails them all
 * (the first admin sweep did exactly that, screen after screen, until it was stopped).
 *
 * "You do not have permission" is here too, for the same reason: it is live copy (the admin's
 * documents refusal, the coach capability default), so it is held to what a person can SEE on
 * every screen rather than to text that may only ride in a page's data.
 */
const VISIBLE_LANDING_FAILURES = ['We can’t find that page', 'You do not have permission',
  // The FREE portal's team 404 (`app/coaches/team/[basicTeamId]/not-found.tsx`, 2026-10-19): a free-coach session that
  // is not the account the context resolved lands here on every team screen — and a free entry has no `area`, so
  // nothing else would hold it to where it was sent.
  'linked to your signed-in coach account'];

/**
 * The admin's own refusal wording (admin slice 0, 2026-09-25) — held against ADMIN entries only.
 * ⚠ Not in the list above because coach panels print "don't have access" as a legitimate state
 * (the awards certificate, the depth chart), and a global entry would fail screens that are right.
 */
const ADMIN_LANDING_FAILURES = ['Access Restricted', 'Access restricted', 'don\'t have access', 'don’t have access'];

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => argv.find((a) => a.startsWith(`${f}=`))?.split('=')[1];

// Every flag this runner reads — anything else is refused before a browser starts (see USAGE).
const SWITCHES = new Set(['--init', '--report', '--prune', '--list', '--changed', '--allow-partial', '--resume', '--with-dark', '--help', '-h']);
const VALUED = ['--only', '--width', '--theme', '--dump', '--workers', '--sidebar'];
if (has('--help') || has('-h')) {
  const usage = readFileSync(fileURLToPath(import.meta.url), 'utf8').match(/── USAGE ─+\n([\s\S]*?)\n \* ⚠ THE BASELINE/)[1];
  console.log(usage.split('\n').map((l) => l.replace(/^ \* ?/, '')).join('\n').trimEnd());
  process.exit(0);
}
const unknownFlags = argv.filter((a) => !SWITCHES.has(a) && !VALUED.some((f) => a.startsWith(`${f}=`)));
if (unknownFlags.length) {
  console.error(`✗ Unknown option ${unknownFlags.join(' ')} — nothing was swept. A value flag takes "=" (--only=a,b). See --help.`);
  process.exit(1);
}

const mode = has('--init') ? 'init' : has('--report') ? 'report' : has('--prune') ? 'prune' : 'check';
let onlyIds = val('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const onlyWidth = val('--width');
const theme = val('--theme');
const dumpFile = val('--dump');
if (theme && theme !== 'dark' && theme !== 'warm') {
  console.error(`✗ --theme must be dark or warm (got "${theme}")`);
  process.exit(1);
}
if (theme && mode === 'prune') {
  console.error('✗ --theme cannot prune: the warm baseline is recorded in the default theme, and dark\'s own list is rewritten by --theme=dark --init.');
  process.exit(1);
}
if (theme === 'warm' && mode === 'init') {
  console.error('✗ --theme=warm --init: warm is the default theme, and its baseline is written without --theme.');
  process.exit(1);
}
if (theme === 'dark' && mode === 'report') {
  console.error('✗ --report cannot take --theme=dark: a dark run measures contrast only, so its inventory would read as the whole product.');
  process.exit(1);
}
// A dark run measures contrast only — see "A DARK RUN MEASURES CONTRAST AND NOTHING ELSE" above.
// null = every rule.
const rulesOnly = theme === 'dark' ? ['contrast'] : null;
/**
 * `--with-dark` — DARK MEASURED ON THE WARM RUN'S OWN PAGE (owner, 2026-11-15, Release process hardening Stage 1A).
 *
 * A dark pass opened every screen a second time (~720 page loads, ~12 min on a healthy run) to read one rule. The
 * theme is ONE attribute on <html> (`data-user-theme`, set by lib/no-flash-script.ts) and is pure stylesheet: no
 * screen reads it in its own code (checked 2026-11-15; the one `getPropertyValue('--…')` reader is the share-score
 * image, drawn on a tap). So at the dark widths, after the warm probe and before the page is scrolled, the run flips
 * that attribute in place by the product's own rule (dark only for a signed-in browser — a signed-out page stays warm,
 * exactly as a real dark visit leaves it), with transitions off so nothing is read mid-fade, reads contrast, and
 * flips back. The findings are the dark run's, keyed and compared exactly as a `--theme=dark` run's are, and dumped
 * beside the warm dump (`<dump>.dark.json`).
 *
 * ⚠ Proven before it replaced the dark pass: a slice measured both ways gave identical finding keys (see the header,
 * MEASURED). `--theme=dark` stays the real thing, and the one that writes dark's accepted list (`--init`).
 */
const withDark = has('--with-dark');
if (withDark && (theme || mode !== 'check')) {
  console.error('✗ --with-dark adds dark contrast to a warm CHECK run: drop --theme, and write a baseline from a single-theme run (--theme=dark --init for dark\'s list).');
  process.exit(1);
}
// `--sidebar=strip` — see "MEASURES THE SIDEBAR COLLAPSED" above. `full` is the default and says so.
const sidebar = val('--sidebar') ?? 'full';
if (sidebar !== 'strip' && sidebar !== 'full') {
  console.error(`✗ --sidebar must be strip or full (got "${sidebar}")`);
  process.exit(1);
}
const stripRun = sidebar === 'strip';
if (stripRun && mode === 'report') {
  console.error('✗ --report cannot take --sidebar=strip: the inventory describes the product as everybody first sees it.');
  process.exit(1);
}
/** A strip run's own key for a finding the full sidebar does not have (`1440@strip`). */
const STRIP_SUFFIX = '@strip';

/**
 * `--workers` — pages measured at once.
 *
 * ⚠ ONE on the dev server, by default, and that is not timidity: a dev server compiles each route on
 * first visit and keeps every request's leak (see AGENTS.md "Memory rule"), so parallel pages there
 * are parallel compiles. A production server has neither cost, and a page's time is almost all
 * waiting on the database, so four at once is close to four times as fast. "The dev server" is read
 * as "no UAT_BASE_URL": the project runs it on the default address, and anything else was chosen.
 */
const workersRaw = val('--workers');
const workers = workersRaw === undefined ? (process.env.UAT_BASE_URL ? 4 : 1) : Number(workersRaw);
if (!Number.isInteger(workers) || workers < 1 || workers > 8) {
  console.error(`✗ --workers must be a whole number from 1 to 8 (got "${workersRaw}")`);
  process.exit(1);
}

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

  /**
   * Files whose reach is more than one route — and WHICH side of the product they reach.
   *
   * ⚠ Split by side when the admin joined the sweep (Admin Design Continuity slice 0, 2026-09-25).
   * One list used to mean "every screen", which was right while every screen was a coach or a
   * marketing page. With ~90 admin screens listed too, a file that reaches only the coach portal
   * (its stylesheet, its layout) should not sweep the admin, and an admin-only file should not
   * sweep the coach portal. WHEN UNSURE IT STILL WIDENS: a file on no list falls through to the
   * per-route match below, exactly as before.
   *
   * ⚠⚠ THE SHARED COMPONENT FOLDERS REACH BOTH SIDES, so they sweep everything. The review of this
   * split found each side importing the other's parts: the coach portal's own shell and its
   * attendance report draw the admin's skeleton block, the admin's shared library uses the coach
   * award-icon picker, and every coach page header carries the help guide's "?" button — and from
   * Admin Design Continuity slice 1 the admin is built on the coach KIT. Filing any of these to one
   * side would sweep that side and report the other, which the same file changed, as covered.
   * The cost is real (a kit change sweeps ~215 screens) and it is the price of the admin standing
   * on the kit; a precise per-file map would be cheaper and would rot the day someone adds an import.
   */
  const WIDEN = [
    { side: 'every', pick: () => true,
      re: /^(app\/globals\.css$|app\/layout\.tsx$|app\/\[orgSlug\]\/layout\.tsx$|components\/coaches\/|components\/admin\/|components\/help\/|app\/coaches\/coaches-portal\.module\.css$)/ },
    // The FREE portal's own shell (2026-10-19): its layout wraps only the org-less `/coaches/…` pages. (Its stylesheet,
    // `coaches-portal.module.css`, is drawn by shared coach components too, so it sweeps everything, above.)
    { side: 'free coach', pick: (s) => s.session === 'freeCoach', re: /^app\/coaches\/layout\.tsx$/ },
    { side: 'coach + marketing', pick: (s) => !s.area,
      re: /^(app\/\[orgSlug\]\/coaches\/coaches\.module\.css|app\/\[orgSlug\]\/coaches\/layout\.tsx|components\/consumer\/warmTheme\.module\.css)/ },
    // A club's own public site (Club Tier Stage 4b-1): its frame, its kits and its colour roles draw every club page
    // and no route folder holds them, so a change to any of them sweeps the club-* screens.
    { side: 'club site', pick: (s) => s.id.startsWith('club-'),
      re: /^(components\/public\/(ClubFrame|ClubBar|ClubFooter|ClubKit|ClubForm|OrgSectionTabs)\.|app\/\[orgSlug\]\/ClubHome\.module\.css$|lib\/club-(colour-roles|site|page-meta)\.ts$)/ },
    { side: 'admin', pick: (s) => !!s.area,
      re: /^(app\/\[orgSlug\]\/admin\/(layout\.tsx|AdminChrome\.tsx|admin\.module\.css|admin-common\.module\.css)|components\/volunteer\/|lib\/tournament-context\.tsx)/ },
  ];
  const widened = WIDEN.filter((w) => files.some((f) => w.re.test(f)));

  // ⚠ The widened set and the per-route hits are UNIONED. Before the split one shared file selected
  // every screen, so nothing else in the diff mattered; now a coach-shared file selects only its
  // side, and a diff that ALSO touches an admin page must still sweep that page.
  {
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
    // ⚠ The admin sentinels (slice 0, 2026-09-25) are the admin's route folders, for the same reason
    // as the four above: a missing one builds `…/families/undefined` and the screen never matches.
    // ⚠ `__ID__` is replaced by NOTHING below — it is only safe for a field used in a QUERY string
    // (stripped) or a `clock`. A field that ever becomes a PATH segment needs its own sentinel and
    // `.replace`, or its screen silently stops matching its own route folder.
    const SENTINEL = { orgSlug: '__ORG__', teamId: '__TEAM__', finishedTeamId: '__TEAM__', practiceEventId: '__EVENT__', recordPracticeEventId: '__EVENT__', gameEventId: '__EVENT__', finishedPracticeEventId: '__EVENT__', fundraiserId: '__ID__', finishedYearId: '__ID__', receiptPlayerId: '__PLAYER__', planTemplateId: '__TEMPLATE__', lineupTemplateId: '__TEMPLATE__', evalSessionId: '__SESSION__', opponentKey: '__OPPONENT__', commitmentId: '__ID__', measurableTypeId: '__ID__',
      clubSlug: '__ORG__', tournOrgSlug: '__ORG__', onboardingOrgSlug: '__ORG__', clubTeamId: '__TEAM__', clubYearId: '__YEAR__', clubPastYearId: '__YEAR__', clubClosedTeamId: '__TEAM__', clubSeasonId: '__SEASON__', clubPersonId: '__PERSON__', clubChildId: '__CHILD__',clubLedgerId: '__LEDGER__', clubSharedPayeeId: '__PAYEE__', clubBudgetLineId: '__LINE__', clubAllocationId: '__ALLOC__', clubScheduleId: '__SCHEDULE__', clubDatesOffScheduleId: '__SCHEDULE__', tournamentSlug: '__TSLUG__', tournamentId: '__ID__', clubTournamentId: '__ID__', tournamentGameDay: '__ID__',
      // The FREE coach's team (2026-10-19): an org-less `/coaches/team/{id}` path, its own `[basicTeamId]` folder.
      freeTeamId: '__BASIC__' };
    // `route` on an entry names its folder outright, for the one shape a path cannot be turned back
    // into: a dynamic segment the entry fills with a literal word (the preview's `[section]`).
    const dirOf = (s) => s.route ??
      'app' + s.path(SENTINEL)
        .replace('/__ORG__/', '/[orgSlug]/')
        .replace('__TEAM__', '[teamId]')
        .replace('__EVENT__', '[eventId]')
        .replace('__PLAYER__', '[playerId]')
        .replace('__TEMPLATE__', '[templateId]')
        .replace('__SESSION__', '[sessionId]')
        .replace('__OPPONENT__', '[opponentKey]')
        .replace('__YEAR__', '[yearId]')
        .replace('__SEASON__', '[seasonId]')
        .replace('__PERSON__', '[personId]')
        .replace('__LEDGER__', '[ledgerId]')
        .replace('__PAYEE__', '[payeeId]')
        .replace('__LINE__', '[lineId]')
        .replace('__ALLOC__', '[allocationId]')
        .replace('__TSLUG__', '[tournamentSlug]')
        .replace('__BASIC__', '[basicTeamId]')
        // A tab screen addresses its page with `?section=…`; the folder is what a changed file can
        // match, so the query is dropped (found 2026-09-16: `coach-history-scouting` computed to
        // `…/history?section=scouting`, matched no file, and the Scouting book's own diff swept
        // the Dashboard tab instead — "looks covered, is not").
        .replace(/\?.*$/, '');
    const hit = SCREENS.filter((s) => files.some((f) => f.startsWith(dirOf(s) + '/') || f.startsWith(dirOf(s) + '.')));
    const picked = new Set([
      ...SCREENS.filter((s) => widened.some((w) => w.pick(s))).map((s) => s.id),
      ...hit.map((s) => s.id),
    ]);
    onlyIds = SCREENS.filter((s) => picked.has(s.id)).map((s) => s.id);
    if (!onlyIds.length) {
      console.log('--changed: no listed screen is affected by this diff. Nothing to sweep.');
      process.exit(0);
    }
    if (widened.length) {
      const e = files.find((f) => widened.some((w) => w.re.test(f)));
      console.log(`--changed: shared file(s) touched (e.g. ${e}) — sweeping ${widened.map((w) => w.side).join(' + ')} screens` +
        `${hit.length ? ' plus the routes the diff touches' : ''} (${onlyIds.length}).\n`);
    } else {
      console.log(`--changed: ${onlyIds.length} screen(s) affected — ${onlyIds.join(', ')}\n`);
    }
  }
}

if (has('--list')) {
  for (const s of SCREENS) console.log(`${s.id.padEnd(34)} ${s.session.padEnd(16)} ${s.area ?? ''}`);
  const universal = WIDTHS.filter((w) => !w.optIn && !w.onDemand).map((w) => w.name);
  const optIn = WIDTHS.filter((w) => w.optIn).map((w) => w.name);
  const onDemand = WIDTHS.filter((w) => w.onDemand).map((w) => w.name);
  console.log(`\n${SCREENS.length} screens × ${universal.length} widths (${universal.join(', ')})` +
    (optIn.length ? ` · opt-in: ${optIn.join(', ')}` : '') +
    (onDemand.length ? ` · on demand (--width=<w>): ${onDemand.join(', ')}` : ''));
  process.exit(0);
}

let screens = onlyIds ? SCREENS.filter((s) => onlyIds.includes(s.id)) : SCREENS;

/**
 * `--changed` defaults to a representative PAIR of widths — the narrow phone and the desktop —
 * rather than all three (361, 768, 1440; 390 is on demand).
 *
 * Measured: ~3.4s per screen-width on a warm dev server. A normal feature diff touches one or two
 * screens, so two widths keeps a review step in the seconds. A palette or shared-chrome diff widens
 * to all 28 screens by design, and there four widths would be ~20 minutes — slow enough that the
 * step gets skipped, which is worse than covering two widths well. 361 and 1440 straddle both of
 * the portal's breakpoints (900 shell, 640 content), so a layout that is right at both is very
 * rarely wrong between them. The deliberate whole-suite run still covers all three.
 *
 * A dark run takes the same pair, for its own reason: it measures contrast only, and these two are
 * the widths that between them showed every dark-only finding (see the header).
 */
const CHANGED_DEFAULT_WIDTHS = ['361', '1440'];
/** `--with-dark` reads dark at the dark run's own widths (see the header: these two showed every dark-only finding). */
const darkAt = (w) => withDark && CHANGED_DEFAULT_WIDTHS.includes(w.name);
/** `--width=<px>` naming no listed width: an ad-hoc desktop width (see the header) — measured, never baselined. */
const adHocWidth = onlyWidth && !WIDTHS.some((w) => w.name === onlyWidth) && /^\d+$/.test(onlyWidth) && Number(onlyWidth) >= 901
  ? { name: onlyWidth, width: Number(onlyWidth), height: 800, adHoc: true }
  : null;
if (adHocWidth && (mode === 'init' || mode === 'prune')) {
  console.error(`✗ --width=${onlyWidth} is not a listed width, so it has no baseline to write. Diff two --dump runs instead.`);
  process.exit(1);
}
const listedWidths = adHocWidth
  ? [adHocWidth]
  : onlyWidth
    ? WIDTHS.filter((w) => w.name === onlyWidth)
    : has('--changed') || theme === 'dark'
      ? WIDTHS.filter((w) => CHANGED_DEFAULT_WIDTHS.includes(w.name))
      // An `onDemand` width (390, owner 2026-11-15; see WIDTHS) runs only when named. Leaving it out of `widths` also
      // leaves its baseline entries out of this run's ownership, so a default --init or --prune never touches them.
      : WIDTHS.filter((w) => !w.onDemand);
// A strip run measures the desktop only: at 900 and under there is no sidebar to collapse.
const widths = stripRun ? listedWidths.filter((w) => w.width > 900) : listedWidths;
if (!widths.length) {
  console.error(`✗ No width to measure${stripRun ? ' — --sidebar=strip measures desktop widths only (above 900)' : ''}.`);
  process.exit(1);
}
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
let pairCount = screens.reduce((n, s) => n + widths.filter((w) => runsAt(s, w)).length, 0);

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
  const { scopeSel, tapFloor, exempt, only, contrastExempt = [], overflowExempt = [] } = opts;
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
  // ⚠ THE TOPMOST one when two are stacked (practice plans on a phone, 2026-09-23): the block's
  // sheet opens its station's form OVER itself, and taking the FIRST visible dialog measured the
  // sheet underneath — so R6 read the station form as a fixed bar covering every control on the
  // sheet (20 findings, all the stack working as designed). The user is in the LAST one opened,
  // which is the last in document order: every stacked floor in the portal mounts after its host.
  const openModal = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'))
    .filter((d) => visible(d)).pop() ?? null;

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
  //
  // ── R2c · …and an ICON-ONLY control clears it sideways too (same pass, same rect) ──
  //
  // The tap floor reads HEIGHT only, so a control that shrank horizontally passed it in silence.
  // Not hypothetical (app-wide table review, 2026-09-06): the money grid's category toggle was as
  // wide as the category's name — "Gear" exposed a far smaller target than "Tournament entry
  // fees" on the same table — and a 44px-tall, 25px-wide chevron button is still a miss for a
  // thumb. A control with VISIBLE text sizes its width to the word and is judged by its height;
  // an icon-only control has nothing to size it but this rule. ⚠ "Visible" is measured, not read
  // from textContent: this codebase labels icon buttons with an `.srOnly` span, whose text is
  // real and rendered 1px wide — a textContent test would have exempted exactly the well-labelled
  // icon button the rule exists for. Fields are excluded: a select or an input is as wide as its
  // column. Same width band as the tap floor, for the same reason.
  if ((wanted('tap-floor') || wanted('control-width')) && tapFloor > 0) {
    const hasVisibleText = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const b = range.getBoundingClientRect();
        if (b.width > 2 && b.height > 2) return true;
      }
      return false;
    };
    for (const el of Array.from(root.querySelectorAll(CONTROL_SEL))) {
      if (!visible(el) || isExempt(el)) continue;
      const r = el.getBoundingClientRect();
      if (wanted('tap-floor') && r.height < tapFloor - 0.5) add('tap-floor', sigOf(el), `${Math.round(r.height)}px tall (floor ${tapFloor})`);
      if (wanted('control-width') && !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && r.width < tapFloor - 0.5 && !hasVisibleText(el)) {
        add('control-width', sigOf(el), `${Math.round(r.width)}px wide (floor ${tapFloor}) — icon-only control`);
      }
    }
  }

  // ── R8 · every table cell reads at a size on the type ladder ───────────────
  //
  // The app-wide table standard (docs/agents/design/TABLE_AND_LIST_STANDARD.md §3.2): a cell
  // decides its own size from the eight `--type-*` tokens, or from the money grid's registered
  // K-02 ladder. Asserted as MEMBERSHIP — a rendered size is on the ladder or it is not — never
  // as a pixel snapshot, so a legitimate move between rungs is not a finding. This is the rule
  // that catches the 2026-09-06 defect at its root: 109 tables rendering 15px because a global
  // element rule beat every table-level size, which no stylesheet-reading gate could see.
  // One finding per TABLE (the offending sizes listed), so the baseline holds a decision, not a
  // thousand cells.
  //
  // ⚠ THE LADDER IS READ FROM THE PAGE, NEVER RESTATED HERE. The eight `--type-*` tokens live on
  // `:root` and the money grid's three `--money-*-size` tokens on the coaches shell; resolving them
  // on the TABLE itself gives each table the ladder its own ancestry actually publishes (the money
  // sizes only resolve inside the shell). A typed copy of the values would be a second source that
  // goes stale on its own — the exact trap the stylesheet guard's header warns about.
  if (wanted('type-ladder')) {
    const rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const toPx = (v) => { v = (v || '').trim(); if (!v) return null; if (v.endsWith('rem')) return parseFloat(v) * rootFs; if (v.endsWith('px')) return parseFloat(v); return null; };
    const LADDER_TOKENS = ['--type-display', '--type-figure', '--type-title', '--type-heading', '--type-body', '--type-support', '--type-label', '--type-token', '--money-cat-size', '--money-line-size', '--money-catnum-size'];
    // The sizes inside a container that are not on the ladder the container publishes — one
    // reader for tables (every cell) and row lists (every text leaf in a row). Returns null when
    // the surface publishes no ladder at all: it cannot be held to one.
    const offLadder = (container, cells) => {
      const ccs = getComputedStyle(container);
      const ladder = LADDER_TOKENS.map((t) => toPx(ccs.getPropertyValue(t))).filter((v) => v != null);
      if (!ladder.length) return null;
      const off = new Set();
      for (const cell of cells) {
        if (!visible(cell)) continue;
        const fs = parseFloat(getComputedStyle(cell).fontSize);
        if (!ladder.some((v) => Math.abs(v - fs) < 0.35)) off.add(fs.toFixed(2));
      }
      return off;
    };
    for (const table of Array.from(root.querySelectorAll('table'))) {
      if (!visible(table) || isExempt(table)) continue;
      const off = offLadder(table, Array.from(table.querySelectorAll('th, td')));
      if (off && off.size) {
        const head = table.querySelector('th');
        add('type-ladder', `table·${(head && nameOf(head)) || nameOf(table)}`, `cells at ${[...off].join('px, ')}px — not on the type ladder (a cell sets its own size from --type-*, or registers an exception)`);
      }
    }
    // A ROW LIST is a table without a heading row (standard §1, §3.10) and is held to the same
    // ladder: every text leaf inside a `[data-row-list-row]` — the title, the caption, the date
    // column, a chip — reads at a ladder size. One finding per list, keyed on the list's label.
    const hasText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    for (const list of Array.from(root.querySelectorAll('[data-row-list]'))) {
      if (!visible(list) || isExempt(list)) continue;
      const off = offLadder(list, Array.from(list.querySelectorAll('[data-row-list-row] *')).filter(hasText));
      if (off && off.size) add('type-ladder', `list·${list.getAttribute('aria-label') || nameOf(list)}`, `rows at ${[...off].join('px, ')}px — not on the type ladder`);
    }
  }

  // ── R9 · a row list sits on the card — read from the ANCESTOR, never the row ────
  //
  // Standard §3.10.1: between an item row and the paper there is exactly ONE thing that paints
  // the card — the list's own frame, or the card / shelf around it — never zero, never two.
  //
  // ⚠⚠ THIS RULE EXISTS BECAUSE THE TABLE STANDARD SHIPPED FOR TEN DAYS WITH ITS GROUND UNPAINTED
  // (register F-24, 2026-09-16). The sentence said "rows transparent over the card"; the gate
  // verified the transparency and never the card, and every list table sat on the blueprint grid
  // under a crisp white heading while the inventory RECORDED the transparency as a pass. A rule
  // that says "over X" is a rule about X — so this one walks UP from the row to `main` and asks
  // what the first painted ancestor is, and compares it to the card token resolved on that very
  // element (both skins, no literal).
  //
  // ONE SENTENCE AT EVERY WIDTH (owner ruling P1, 2026-09-29, "Phone lists in one frame"). Until
  // then a phone flipped the question — each row its own card, nothing behind the stack — unless
  // the list declared the framed form (`data-row-list-phone="frame"`, S.7). The row-card form is
  // gone, so a phone is held to the desktop's sentence: the rows paint nothing, the frame (or the
  // card around an inset list) paints the card, and nothing paints twice. A row that paints its own
  // ground on a phone is the retired card form coming back.
  if (wanted('list-ground')) {
    const transparent = (c) => !c || c === 'transparent' || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)$/.test(c);
    const resolve = (el, token) => {
      // The token is read off the element itself so its own ancestry publishes the value (the
      // warm and dark skins both remap --card-bg); a probe element paints it so we compare
      // COMPUTED rgb to computed rgb, never a var() string to a colour.
      const raw = getComputedStyle(el).getPropertyValue(token).trim();
      if (!raw) return null;
      const probe = document.createElement('span');
      probe.style.backgroundColor = raw;
      el.appendChild(probe);
      const out = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return out;
    };
    for (const list of Array.from(root.querySelectorAll('[data-row-list]'))) {
      if (!visible(list) || isExempt(list)) continue;
      // The walk ends at the list's OWN nearest <main> — the paper is main's ground and does not
      // count. It used to end at the page's FIRST <main>, and the coach shell nests two (an
      // unstyled outer one from the org layout, then `.coachesMain`, which paints the paper): the
      // walk sailed past the inner one and reported it as a second painter behind every framed
      // list on a coach screen (the schedule sheet's 768/1440 entries in the baseline are that).
      const stopAt = list.closest('main') || root;
      // Only the FIRST visible row is read — `.find`, not `.filter`, so a forty-row list costs one
      // layout read, not forty (the same idiom the modal finder above uses).
      const row = Array.from(list.querySelectorAll(':scope > [data-row-list-row]')).find(visible);
      if (!row) continue;
      const label = `list·${list.getAttribute('aria-label') || nameOf(list)}`;
      const card = resolve(list, '--card-bg');
      if (!card) continue; // a surface with no card token cannot be held to one
      // Walk up from the row: the first painted ancestor must be the card.
      let node = row.parentElement;
      let painter = null;
      while (node && node !== stopAt.parentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (!transparent(bg)) { painter = { node, bg }; break; }
        node = node.parentElement;
      }
      const rowBg = getComputedStyle(row).backgroundColor;
      if (!transparent(rowBg)) {
        add('list-ground', label, `the row itself paints ${rowBg} — a row is not a card, at any width (§3.10.2, P1)`);
      } else if (!painter) {
        add('list-ground', label, `nothing between the row and the page paints a ground — the list sits on the paper (§3.10.1: exactly one painter)`);
      } else if (painter.bg !== card) {
        add('list-ground', label, `the ground behind the row is ${painter.bg}, painted by <${painter.node.tagName.toLowerCase()} class="${String(painter.node.className).slice(0, 60)}">, not the card (${card})`);
      } else {
        // Exactly ONE painter: a framed list must be the painter itself; an inset list must
        // find it above. A framed list inside a painted card is "two" — and since a healthy
        // frame is always the FIRST painter the walk meets, the second is looked for by
        // continuing ABOVE the frame to `main` (the paper is main's own ground and does not count).
        const declared = list.getAttribute('data-row-list');
        if (declared === 'frame' && painter.node !== list) add('list-ground', label, `declared as a framed list but the card is painted by an ancestor <${painter.node.tagName.toLowerCase()}> — two painters, or the frame lost its ground`);
        if (declared === 'inset' && painter.node === list) add('list-ground', label, `declared inset (the card around it paints) but the list paints its own ground`);
        if (declared === 'frame' && painter.node === list) {
          // The page's own ground (--bg, the paper) is not a second card: a shell with no <main> of its own (the free coach
          // portal's) paints it on a wrapper, exactly as a <main> would, so an ancestor painting that token is the paper.
          const paper = resolve(list, '--bg');
          let above = list.parentElement;
          while (above && above !== stopAt) {
            const bg = getComputedStyle(above).backgroundColor;
            if (!transparent(bg) && bg !== paper) { add('list-ground', label, `a framed list inside a painted <${above.tagName.toLowerCase()} class="${String(above.className).slice(0, 60)}"> (${bg}) — two painters; pass \`inset\` and let the card paint`); break; }
            above = above.parentElement;
          }
        }
      }
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
      if (overflowExempt.some((s) => el.closest(s))) continue;
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
          // ⚠ NOT `clip`. `overflow: clip` clips without establishing a scroll container, so a
          // sticky element inside it sticks against the next scroller UP — which is exactly why
          // the row recipe's framed phone list uses it (the Schedule's month band pins against
          // the list's scroller through the frame; stage 2 · C1, 2026-09-21). Treating `clip` as
          // a scroller reported that band as "trapped in <ul>" on a frame that never scrolls.
          if (/(auto|scroll|hidden)/.test(getComputedStyle(a)[overflowProp])) { scroller = a; break; }
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
      if (contrastExempt.some((s) => el.closest(s))) continue;
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

  // ── Field floor (phone re-evaluation stage 0 · A4, owner 2026-09-20) ───────────────────────
  //
  // A surface read STANDING UP — the game console, the run screen, the event sheet's attendance
  // list — declares `data-field-floor`. Inside it nothing readable is under 12px (the ladder's
  // `support` step) and a `data-field-key` (the position a coach looks for) is at least 14px.
  // The ladder is untouched: the surfaces remap their two smallest steps to support in CSS, and
  // this rule is what stops a future declaration reintroducing a 10px word at the fence. Measured
  // before the rule: 66 of the console's 122 words at 10–11px.
  if (wanted('field-floor')) {
    const seen = new Set();
    for (const surface of Array.from(root.querySelectorAll('[data-field-floor]'))) {
      if (!visible(surface)) continue;
      for (const el of Array.from(surface.querySelectorAll('*'))) {
        if (!visible(el) || isExempt(el)) continue;
        const ownText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join(' ')
          .trim();
        if (!ownText) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        const floor = el.closest('[data-field-key]') ? 14 : 12;
        if (size < floor - 0.5) {
          const sig = `${sigOf(el)}·${Math.round(size)}px`;
          if (seen.has(sig)) continue;
          seen.add(sig);
          add('field-floor', sig, `${Math.round(size)}px on a surface read standing up (floor ${floor}px${floor === 14 ? ' — the value a coach looks for' : ''})`);
        }
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

    // ⚠ THE PAGE'S SCROLLER IS NOT ALWAYS THE DOCUMENT (2026-11-07). On a phone the club admin
    // locks its shell to the screen (`data-admin-locked`) and its main column is the one scroller,
    // so the document never moves. Read from the document, a locked page is "at the end" at rest,
    // and everything in the bottom bar's band before the first scroll was reported trapped (six
    // phantoms at 390, each measured clear at the column's end). So: when the document does not
    // scroll and a locked shell holds a scroller, that scroller is the page. Same finder as the
    // scroll-to-end driver below (`lockedShellScroller` there); keep the two in step.
    const de = document.documentElement;
    let pageScroller = null;
    const lockedShell = de.scrollHeight <= de.clientHeight + 2 && document.querySelector('[data-admin-locked]');
    if (lockedShell) {
      let area = 0;
      for (const s of Array.from(lockedShell.querySelectorAll('*'))) {
        if (!/(auto|scroll)/.test(getComputedStyle(s).overflowY) || s.scrollHeight <= s.clientHeight + 2) continue;
        if (s.closest('[role="dialog"], dialog, [aria-modal="true"]')) continue;
        const r = s.getBoundingClientRect();
        if (r.width * r.height > area) { area = r.width * r.height; pageScroller = s; }
      }
    }
    const atTop = pageScroller ? pageScroller.scrollTop <= 2 : window.scrollY <= 2;
    const atEnd = pageScroller
      ? Math.abs(pageScroller.scrollTop + pageScroller.clientHeight - pageScroller.scrollHeight) <= 2
      : Math.abs(window.scrollY + window.innerHeight - de.scrollHeight) <= 2;
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
/** The key a strip run records a strip-only finding under — a strip run reads both this and `keyOf`. */
const stripKeyOf = (f) => `${f.screen}|${f.width}${STRIP_SUFFIX}|${f.rule}|${f.signature}`;
/** The key THIS run owns a finding under. */
const keyFor = stripRun ? stripKeyOf : keyOf;

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
/** Is this baseline entry THIS run's to write or prune? A full run owns the plain keys, a strip run its
 *  `@strip` keys — each leaves the other's alone. */
const ownsKey = (k) => {
  const [screen, width] = k.split('|');
  if (width.endsWith(STRIP_SUFFIX) !== stripRun) return false;
  return coversPair(screen, stripRun ? width.slice(0, -STRIP_SUFFIX.length) : width);
};

function readBaseline(file) {
  if (!existsSync(file)) return { entries: {} };
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { console.error(`✗ ${path.relative(ROOT, file)} is not valid JSON.`); process.exit(1); }
}

// ── run ───────────────────────────────────────────────────────────────────────
/** A production build is the target when `UAT_BASE_URL` is set (see the header); the dev server otherwise. */
const remote = !!process.env.UAT_BASE_URL;
/**
 * The per-wait budget on a production build (header, item 2). Started at 30 s on 2026-11-15, to be set from a healthy
 * run's p95 (`budgetFromP95`). ⚠ The dev server keeps 150 s: it compiles each route on first visit, and the help hub
 * once exceeded a 60 s ceiling on a cold cache and was reported "did not render" while still building.
 */
const REMOTE_BUDGET_MS = 30_000;
const budgetEnv = Number(process.env.LAYOUT_BUDGET_S);
const BUDGET_MS = remote ? (Number.isFinite(budgetEnv) && budgetEnv >= 20 ? budgetEnv * 1000 : REMOTE_BUDGET_MS) : 150_000;
/** A production page network-idle this long without its ready mark is dead, not slow (header, item 2). */
const SETTLE_MS = 8_000;
/** Failures in a row inside one unit before its session and the target are re-checked (header, item 3). */
const SESSION_DEAD_AFTER = 3;
/** Screens one page serves before it is replaced in the same context (header, item 6). */
const RECYCLE_EVERY = 25;
const runStarted = Date.now();

/** null when the address answers 200 (after redirects), else why not. */
async function answers(url, ms = 15_000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return res.ok ? null : `answered ${res.status}`;
  } catch (e) { return e.cause?.code ?? e.message; }
}

const AUTH_REPAIR = 'npx playwright test --config playwright.config.ts --project=auth-setup   (⚠ signs every other session out: ask the owner first)';

// ── the first minute (header, item 1): everything that can fail before a screen opens, printed together ──────
/** @type {{ what: string, repair?: string }[]} */
const preRun = [];
/** Screens this server does not serve by design, taken out of the run by name (see below). */
const notServed = [];
const firstMinute = Date.now();
let ctx = null;
{
  const [uat, admin, free] = await Promise.allSettled([
    resolveUatContext(),
    // The admin world is a second fixture, resolved only when an admin or volunteer screen is in the
    // run — a coach-only sweep must never fail on the Club fixture it does not open.
    screens.some((s) => s.area) ? resolveAdminContext() : Promise.resolve({}),
    // The free coach's world likewise — only when a free-coach screen is in the run.
    screens.some((s) => s.session === 'freeCoach') ? resolveFreeCoachContext() : Promise.resolve({}),
  ]);
  for (const r of [uat, admin, free]) if (r.status === 'rejected') preRun.push({ what: `UAT fixture unavailable: ${r.reason?.message ?? r.reason}` });
  if (uat.status === 'fulfilled') ctx = Object.assign(uat.value, admin.value ?? {}, free.value ?? {});
}
const baseUrl = ctx?.baseUrl ?? process.env.UAT_BASE_URL ?? 'http://localhost:3000';
const base = new URL(baseUrl);

let neededSessions = [...new Set(screens.map((s) => s.session))];
for (const s of neededSessions) {
  const f = SESSION_FILES[s];
  if (f && !existsSync(f)) preRun.push({ what: `Missing session for "${s}": ${path.relative(ROOT, f)}`, repair: AUTH_REPAIR });
}

/**
 * A SAVED SESSION, CARRIED TO THE SERVER BEING SWEPT (2026-10-13 — the release sweep runs on staging).
 *
 * The UAT sessions are written by signing in on the dev server, so their cookies belong to
 * `localhost`. A sign-in belongs to the DATABASE, not the site: staging reads the same Supabase
 * project as the dev server, so the same cookie is the same signed-in person there once it is
 * addressed to staging's host. Re-addressing beats a second set of session files nobody refreshes.
 */
const sessionStates = new Map();
function sessionFor(file) {
  if (!sessionStates.has(file)) {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    for (const c of state.cookies) {
      if (c.domain === base.hostname) continue;
      c.domain = base.hostname;
      c.secure = base.protocol === 'https:';
    }
    sessionStates.set(file, state);
  }
  return sessionStates.get(file);
}

// ⚠ AND PROVE IT IS SIGNED IN THERE before a page opens. A session that is not — stale, or carried
// to a server on another database (production) — fails quietly: a coach entry is not held to the
// redirect check, so it can land on the sign-in page and be measured as the screen it asked for.
/** null when the session is signed in at the target, else why not. */
async function signedIn(s) {
  const f = SESSION_FILES[s];
  if (!f || !existsSync(f)) return null;
  let state;
  try { state = sessionFor(f); } catch (e) { return `its file is not readable (${e.message})`; }
  const cookie = state.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  // A timeout, because a server that accepts the connection and never answers would hang the run here.
  const res = await fetch(new URL('/api/me/role-summary', base), { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
    .catch((e) => e);
  if (res instanceof Error) return `could not be checked: ${res.message}`;
  // Refused outright, or bounced to a sign-in page (fetch follows the redirect and reports its 200).
  if (res.status === 401 || res.status === 403 || (res.redirected && /login|sign-?in/i.test(res.url))) return 'is not signed in';
  return null;
}

const targetWhy = await answers(baseUrl);
if (targetWhy) {
  preRun.push({ what: `No healthy server at ${baseUrl} (${targetWhy})`,
    repair: remote ? 'wait until the build has finished deploying there (or check UAT_BASE_URL), then re-run'
      : 'npm run dev — or, for another server, set UAT_BASE_URL to its address' });
} else {
  // A screen this server deliberately does not serve (`onlyWhereServed` in layout-screens.mjs, e.g. the legal pages
  // while their switch is off) is taken out of the run BY NAME and listed on every run, never counted as measured. It
  // answers "not found" there by design, so measuring it would measure the 404 page, and failing on it would fail every
  // release until a switch someone else owns is flipped.
  await Promise.all(screens.filter((s) => s.onlyWhereServed).map(async (s) => {
    const res = await fetch(new URL(s.path(ctx), base), { signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (res?.status === 404) notServed.push({ id: s.id, why: s.onlyWhereServed });
  }));
  if (notServed.length) {
    const out = new Set(notServed.map((n) => n.id));
    screens = screens.filter((s) => !out.has(s.id));
    pairCount = screens.reduce((n, s) => n + widths.filter((w) => runsAt(s, w)).length, 0);
    neededSessions = [...new Set(screens.map((s) => s.session))];
    if (!screens.length) preRun.push({ what: `Every selected screen is one this server does not serve: ${notServed.map((n) => n.id).join(', ')}` });
  }
  const selected = new Set(screens.map((s) => s.id));
  await Promise.all([
    ...neededSessions.map(async (s) => {
      const why = await signedIn(s);
      if (why) preRun.push({ what: `The "${s}" session ${why} at ${baseUrl}. The server must read the same database as the dev server (never production), and the session must be current.`, repair: AUTH_REPAIR });
    }),
    // Fixtures that expire with the clock (layout-screens.mjs FIXTURE_CHECKS), only for the screens in this run.
    ...FIXTURE_CHECKS.filter((fc) => fc.screens.some((id) => selected.has(id))).map(async (fc) => {
      const html = await fetch(new URL(fc.path, base), { signal: AbortSignal.timeout(30_000) }).then((r) => r.text()).catch(() => '');
      if (!fc.expect.test(html)) preRun.push({ what: `Fixture expired or missing: ${fc.what} (${fc.path}; needed by ${fc.screens.filter((id) => selected.has(id)).join(', ')})`, repair: fc.repair });
    }),
  ]);
}

function stopForPreRun(heading) {
  console.error(`\n✗ ${heading} — nothing was swept (${formatDuration(Date.now() - firstMinute)}):\n`);
  const repairs = [];
  for (const p of preRun) {
    console.error(`  · ${p.what}`);
    if (p.repair && !repairs.includes(p.repair)) repairs.push(p.repair);
  }
  if (repairs.length) {
    console.error('\n  Repair:');
    for (const r of repairs) console.error(`    ${r}`);
  }
  process.exit(1);
}
if (preRun.length) stopForPreRun(`${preRun.length} problem(s) before the first screen`);

const exemptSelectors = CHROME_EXEMPT.map((e) => e.sel);
const findings = [];
/** `--with-dark`: the dark contrast findings read in place (empty on any other run). */
const darkFindings = [];
const landingFailures = [];
const navFailures = [];
/** Pairs recorded unmeasured under ONE cause line (a dead session, a dead target, a screen dead twice). */
const causes = new Map();
const unmeasuredBy = (cause, label, url) => { if (!causes.has(cause)) causes.set(cause, []); causes.get(cause).push({ label, url }); };

// ⚠ A sweep is the heaviest thing this repo asks of a dev server: every screen it has not seen
// yet is compiled on demand and then held forever. Refuse to start with no headroom, and watch
// it as we go — see scripts/memory-guard.mjs for what happened the two times nothing was watching.
const resumeCommand = `npm run check:layout -- ${[...argv.filter((a) => a !== '--resume'), '--resume'].join(' ')}`;
preflight('Memory', { remote });
const memory = createWatchdog('layout sweep', { remote, resumeCommand });
let aborted = null;

const browser = await chromium.launch();

/** A fresh context for a session (and a pinned clock), set up exactly as every unit's is. */
async function openContext(session, clock) {
  const file = SESSION_FILES[session];
  // ⚠ reducedMotion is not a nicety. `app/globals.css` sets `html { scroll-behavior: smooth }`, so
  // a programmatic scroll ANIMATES — and the covered-by-chrome rule, which measures after scrolling
  // to the end, was reading a mid-flight position. The app already honours prefers-reduced-motion
  // with `scroll-behavior: auto !important`, so asking for it here uses the product's own code path
  // to make the measurement deterministic.
  const context = await browser.newContext({
    ...(file ? { storageState: sessionFor(file) } : {}),
    reducedMotion: 'reduce',
  });
  if (clock) await context.clock.setFixedTime(new Date(clock));

  // ⚠⚠ A CLOSED NAV GROUP IS AN UNMEASURED NAV GROUP. The coach rail's groups collapse and "Team"
  // starts CLOSED (Phase 5b, 2026-08-18), which would quietly take Roster, Tryouts, Staff,
  // Documents and Settings out of every layout invariant on every coach screen — the sweep would
  // stay green while measuring five fewer doors than it reports. Seeding the rail's own storage key
  // with all five groups open uses the product's own preference path rather than a test-only hook,
  // so what the sweep measures is a real state a coach can be in. Pinned from the other end by
  // tests/unit/coach-nav-groups.test.ts, because this failure is invisible.
  //
  // The admin rail has the same trap (admin slice 0, 2026-09-25): a tournament's Setup group opens
  // only for a draft and Admin never by default, so an active tournament's sweep would measure the
  // Operations rows alone. Its own key (`fl_nav_groups`, `AdminKitRail`) opens all three.
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        'flhq-coach-nav-groups',
        JSON.stringify(['Season', 'Progress', 'Money', 'Communication', 'Team']),
      );
      localStorage.setItem('fl_nav_groups', JSON.stringify(['operations', 'setup', 'admin']));
    } catch { /* private-mode browsers throw; the sweep then measures the defaults */ }
  });
  // `--theme`: the product's own device fast-path (`fl_user_theme`, read pre-paint by the root
  // no-flash script). Only the consumer shell reconciles against the account, and no sweep screen
  // is a consumer screen, so this is the whole of the theme choice for every screen measured here.
  if (theme) {
    await context.addInitScript((t) => {
      try { localStorage.setItem('fl_user_theme', t); } catch { /* private mode: the default stands */ }
    }, theme);
  }
  // `--sidebar=strip`: the product's own setting (`lib/sidebar-strip.ts`), read pre-paint by the same
  // no-flash script, so every portal's sidebar is the strip from the first paint — as a strip user sees it.
  if (stripRun) {
    await context.addInitScript(() => {
      try { localStorage.setItem('flhq-sidebar', 'strip'); } catch { /* private mode: the full sidebar stands */ }
    });
  }
  return context;
}

async function openPage(context, w) {
  const page = await context.newPage();
  await page.setViewportSize({ width: w.width, height: w.height });
  return page;
}

/**
 * Wait for a screen's ready mark. On a production build (`early`), a page that has gone network-idle and then
 * SETTLE_MS more without it is reported dead at once rather than waited on for the whole budget (header, item 2).
 */
async function waitReady(page, sel, early) {
  const ready = page.waitForSelector(sel, { timeout: BUDGET_MS, state: 'attached' });
  if (!early) return ready;
  ready.catch(() => {});
  const settled = (async () => {
    await page.waitForLoadState('networkidle', { timeout: BUDGET_MS }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS).catch(() => {});
    return 'settled';
  })();
  const first = await Promise.race([ready.then(() => 'ready'), settled]);
  if (first === 'ready') return;
  if (await page.locator(sel).count().catch(() => 0)) return;
  throw new Error(`the page went quiet (network idle, then ${SETTLE_MS / 1000} s) without its ready mark ${sel}`);
}

// ── the canaries (header, item 1): one screen per session opens, before the run commits to the rest ────────────
{
  const canaries = neededSessions.map((session) => {
    const s = screens.find((x) => x.session === session);
    return { session, screen: s, w: widths.find((x) => runsAt(s, x)) };
  }).filter((c) => c.w);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(workers, canaries.length) }, async () => {
    while (next < canaries.length) {
      const { session, screen, w } = canaries[next++];
      const context = await openContext(session, screen.clock ? screen.clock(ctx) : null);
      try {
        const page = await openPage(context, w);
        await page.goto(baseUrl + screen.path(ctx), { waitUntil: 'domcontentloaded', timeout: BUDGET_MS });
        await waitReady(page, screen.ready, remote);
        if (SESSION_FILES[session] && /\/(auth\/)?(login|sign-?in)\b/.test(new URL(page.url()).pathname)) {
          throw new Error(`it was sent to the sign-in page (${new URL(page.url()).pathname})`);
        }
      } catch (e) {
        preRun.push({ what: `The "${session}" session's first screen, ${pairLabel(screen.id, w.name)}, did not open: ${String(e.message || e).split('\n')[0]}`,
          repair: `re-run just it to see the page: npm run check:layout -- --only=${screen.id} --width=${w.name}` });
      } finally {
        await context.close().catch(() => {});
      }
    }
  }));
  if (preRun.length) { await browser.close(); stopForPreRun(`${preRun.length} canary screen(s) did not open`); }
  console.log(`First-minute checks passed in ${formatDuration(Date.now() - firstMinute)}: the target, ${neededSessions.length} session(s), the fixtures, ${canaries.length} canary screen(s).`);
}

/**
 * One browser context per SESSION — and per pinned CLOCK within it (admin slice 0, 2026-09-25).
 * A `clock` entry pins the page's Date to the day its content lives on (the volunteer screens show
 * one day's games). The pin belongs to the whole context, so a pinned entry gets a context of its
 * own rather than leaking its date into every screen after it.
 */
const groups = [];
for (const session of neededSessions) {
  for (const s of screens.filter((x) => x.session === session)) {
    const clock = s.clock ? s.clock(ctx) : null;
    let g = groups.find((x) => x.session === session && x.clock === clock);
    if (!g) groups.push(g = { session, clock, list: [] });
    g.list.push(s);
  }
}

/**
 * THE UNIT OF WORK IS ONE SESSION AT ONE WIDTH, in a context of its own (2026-10-13, `--workers`).
 *
 * ⚠ Its results must not depend on how many run at once, or the ratchet flickers. A context carries
 * device memory (localStorage) from one screen to the next — a view a screen's gesture picked, a
 * group a screen opened — so a screen's measurement can depend on what was visited before it in the
 * same context. Handing screens to whichever worker is free would make that history depend on
 * timing. A unit is the same list in the same order in a fresh context, whichever worker runs it and
 * however many are running, so a run at --workers=1 and one at --workers=4 measure the same pages.
 *
 * Before this, a context spanned every width of a session, so the 390 pass inherited the 361 pass's
 * device memory. A fresh context per width is the cleaner of the two — each width now opens the way
 * a person's first visit does — and a baseline entry that flips on the change was order-dependent.
 */
const allUnits = [];
for (const g of groups) {
  for (const w of widths) {
    const list = g.list.filter((s) => runsAt(s, w));
    if (list.length) allUnits.push({ ...g, w, list });
  }
}

// ── the journal (header, item 4) ──────────────────────────────────────────────
const probeFingerprint = digest(probeInPage.toString() + JSON.stringify({
  CHROME_EXEMPT, CONTRAST_EXEMPT, OVERFLOW_EXEMPT, rulesOnly, TAP_FLOOR, TAP_FLOOR_MAX_WIDTH,
}));
/**
 * WHICH BUILD IS MEASURED. On a production build that is the TARGET's build, read from its own page (Next's build id
 * rides in the inline router payload as `"b":"…"`), not this checkout's HEAD: other sessions commit to the shared
 * branch all day, and on 2026-11-15 a commit nobody had deployed made a staging run's journal unresumable. The dev
 * server builds from this checkout, so there HEAD is the honest answer. (`commit` is the journal key's field name.)
 */
async function measuredBuild() {
  if (remote) {
    const html = await fetch(baseUrl, { signal: AbortSignal.timeout(15_000) }).then((r) => r.text()).catch(() => '');
    // Escaped inside the page's inline script (`\"b\":\"…`); the plain form is kept for a payload served as JSON.
    const m = /\\"b\\":\\"([A-Za-z0-9_-]{8,})/.exec(html) ?? /"b":"([A-Za-z0-9_-]{8,})"/.exec(html);
    const id = m?.[1];
    if (id) return `build ${id}`;
  }
  try { return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}
const commit = await measuredBuild();
const key = journalKey({
  commit, host: base.host, theme: withDark ? 'default+dark' : theme, sidebar, probe: probeFingerprint,
  pairs: pairListHash(allUnits.flatMap((u) => u.list.map((s) => ({ label: pairLabel(s.id, u.w.name), url: s.path(ctx), ready: s.ready })))),
});
mkdirSync(JOURNAL_DIR, { recursive: true });
const journalFile = path.join(JOURNAL_DIR, journalFileName(key));
let done = new Map();
if (has('--resume')) {
  if (existsSync(journalFile)) {
    const parsed = parseJournal(readFileSync(journalFile, 'utf8'));
    const why = keyMismatch(parsed.header, key);
    if (why.length) { await browser.close(); console.error(`✗ --resume: ${path.relative(ROOT, journalFile)} is not this run's:\n    ${why.join('\n    ')}`); process.exit(1); }
    done = parsed.done;
  } else {
    // Name what differs, so "the journal is for another commit" is not mistaken for "there is no journal".
    const prefix = `${key.theme}-${key.sidebar}-`;
    const others = readdirSync(JOURNAL_DIR).filter((f) => f.startsWith(prefix) && f.endsWith('.jsonl'));
    await browser.close();
    console.error(`✗ --resume: no journal for this run (${path.relative(ROOT, journalFile)}). Nothing was swept.`);
    for (const f of others) {
      const parsed = parseJournal(readFileSync(path.join(JOURNAL_DIR, f), 'utf8'));
      console.error(`  ${f} is another run's: ${keyMismatch(parsed.header, key).join('; ')}`);
    }
    console.error('  Run without --resume to start a fresh one.');
    process.exit(1);
  }
} else {
  writeFileSync(journalFile, JSON.stringify({ kind: 'header', key, started: new Date().toISOString() }) + '\n');
}
// A resumed run's measured pairs come back as findings, so the dump and the NEW comparison read journal + this run.
for (const row of done.values()) {
  for (const f of row.findings ?? []) findings.push({ ...f, screen: row.screen, width: row.width });
  for (const f of row.dark ?? []) darkFindings.push({ ...f, screen: row.screen, width: row.width });
}
const slim = (list) => list.map(({ rule, signature, detail }) => ({ rule, signature, detail }));
const journal = (screen, w, kept, darkKept, ms) => appendFileSync(journalFile, JSON.stringify({
  kind: 'pair', label: pairLabel(screen.id, w.name), screen: screen.id, width: w.name, ms,
  findings: slim(kept), ...(darkAt(w) ? { dark: slim(darkKept) } : {}),
}) + '\n');

const units = selectRemaining(allUnits, done).map((u) => ({ ...u, findings: [], darkFindings: [] }));
const toMeasure = units.reduce((n, u) => n + u.list.length, 0);
console.log(`Layout sweep · ${screens.length} screen(s) · ${pairCount} screen-width pair(s) · ${baseUrl}` +
  `${workers > 1 ? ` · ${workers} at once` : ''}${rulesOnly ? ` · ${rulesOnly.join(', ')} only` : ''}` +
  ` · ${BUDGET_MS / 1000} s per wait${done.size ? ` · resuming: ${done.size} from the journal, ${toMeasure} to go` : ''}\n`);
const notServedLine = notServed.length
  ? `⚠ NOT SWEPT on this server, by design (${notServed.length}): ${notServed.map((n) => `${n.id}: ${n.why}`).join('; ')}`
  : '';
if (notServedLine) console.log(`${notServedLine}\n`);

// ── the pause (header, item 5) and the one-at-a-time lane it leaves behind ────────────────────────────────────
let pausing = null;
let single = false;
let pauses = 0;
/**
 * After a pause the run goes one page at a time, and returns to `workers` at once only when free memory has stayed
 * above the floor plus BACK_TO_FULL_MB for BACK_TO_FULL_MS. (2026-11-15: three pauses in the first hour of the
 * whole-product run left it at one page for the remaining hours, with 5 GB free.)
 */
const BACK_TO_FULL_MB = 2048;
const BACK_TO_FULL_MS = 120_000;
let healthySince = null;
async function memoryGate(label) {
  if (aborted) return;
  if (pausing) { await pausing; return; }
  const trip = memory.check(label);
  if (!trip && single) {
    const roomy = freeMb() >= memory.floor + BACK_TO_FULL_MB;
    healthySince = roomy ? (healthySince ?? Date.now()) : null;
    if (roomy && Date.now() - healthySince >= BACK_TO_FULL_MS) {
      single = false;
      healthySince = null;
      console.log(`  ▶ ${freeMb()} MB free for ${formatDuration(BACK_TO_FULL_MS)}: back to ${workers} at once`);
    }
  }
  if (!trip) return;
  pausing = (async () => {
    console.log(`  ⏸ ${trip.free} MB free (floor ${trip.floor} MB) at ${label}: no new page opens; waiting up to ` +
      `${PAUSE_DEFAULTS.maxWaitMs / 60_000} min for ${trip.floor + PAUSE_DEFAULTS.marginMb} MB`);
    const r = await memory.waitForHeadroom();
    if (r.recovered) {
      pauses += 1;
      single = true;
      healthySince = null;
      console.log(`  ▶ ${r.free} MB free after ${formatDuration(r.waitedMs)}: continuing, one page at a time`);
    } else {
      // ⚠ Set, never cleared: another worker may have tripped it, and its null must not undo that.
      aborted ??= { ...trip, free: r.free, where: `${label}, after waiting ${formatDuration(r.waitedMs)}` };
    }
  })();
  await pausing;
  pausing = null;
}
let laneTail = Promise.resolve();
/** After a pause, one page is measured at a time across every worker. */
function lane(fn) {
  if (!single) return fn();
  const run = laneTail.then(fn, fn);
  laneTail = run.catch(() => {});
  return run;
}
/** Run in the lane, timed INSIDE it: a pair's cost is its own, never its wait in the queue behind other pairs. */
const timedLane = (fn) => lane(async () => {
  const started = Date.now();
  const r = await fn();
  return { r, ms: Date.now() - started };
});

/**
 * Measure one screen on a page that is already at this width. The measuring is exactly what it always was; only the
 * outcome is returned rather than pushed, so the caller can set a failure aside for its one retry.
 * @returns {Promise<{ status: 'measured', kept: object[] } | { status: 'nav', why: string } | { status: 'landing', saw: string }>}
 */
async function measureScreen(page, screen, w, early) {
  const url = baseUrl + screen.path(ctx);
  const label = pairLabel(screen.id, w.name);
  // See the `storage` note below the goto: seeded device memory is handed back on EVERY exit
  // from this iteration — a failed render or a wrong landing included — or the next entry on
  // this page (and the next width) would open the seeded view instead of the product's default.
  const seededKv = screen.storage ? screen.storage(ctx) : null;
  const unseed = async () => {
    if (!seededKv) return;
    await page.evaluate((ks) => { try { for (const k of ks) localStorage.removeItem(k); } catch { /* private mode */ } }, Object.keys(seededKv)).catch(() => {});
  };
  try {
    // ⚠ A POINTER LEFT WHERE THE LAST GESTURE LANDED HOVERS THE NEXT SCREEN. One page serves every entry
    // at this width, and an `interact` click leaves the mouse resting on that spot — so a later screen
    // that happens to put a hover target there loads hovered. That is how the house league's "Season
    // statuses" bubble was measured OPEN @361/390 (the Families Show-pill tap rests exactly on its "?"),
    // and how a scouting row's hover wash put a red chip at 4.41:1 @768 (2026-10-19, layout upkeep A4).
    // What a screen measures must not depend on the screen before it: park the pointer off the page.
    await page.mouse.move(-1, -1).catch(() => {});
    // The budget fits the target (BUDGET_MS, header item 2): generous on the dev server, which compiles on first visit.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: BUDGET_MS });
    await waitReady(page, screen.ready, early);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    if (screen.area) await waitForNoLoading(page);
    // ⚠ The web fonts too: under four pages at once a label was measured in its fallback face and
    // reported a 2px spill that no single run reproduced (rep team "Tryouts", 2026-10-14).
    // Capped at 5s: a font request that hangs rather than fails must not stall the whole run.
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])).catch(() => {});
    // ⚠ A VIEW THE URL NEVER SHOWS IS A VIEW THE SWEEP NEVER MEASURED. The money report keeps
    // its view (Statement / By activity / Months) in device memory, not the URL, so every
    // sweep of `coach-budget-vs-actual` measured the Statement and nothing else — which is how
    // the Months view's figure doors sat at 26px on a phone, unmeasured, until the 2026-09-06
    // table review seeded the preference and looked. A screen entry may carry `storage`:
    // the keys it returns are written to localStorage on the page's own origin, the page is
    // reloaded so the panel reads them on mount, and they are removed again after the probe
    // so the next entry (and the next width) opens the product's real default.
    if (seededKv) {
      await page.evaluate((kv2) => { try { for (const [k, v] of Object.entries(kv2)) localStorage.setItem(k, v); } catch { /* private mode */ } }, seededKv);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: BUDGET_MS });
      await waitReady(page, screen.ready, early);
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      if (screen.area) await waitForNoLoading(page);
      await page.waitForTimeout(600);
    }
    // A state neither the URL nor device memory can reach — a block opened in place on the
    // practice sheet. One product gesture, after the screen is ready, before it is measured;
    // see `interact` in layout-screens.mjs. A gesture that fails is a screen that did not
    // render the state it is listed for, and is reported as such rather than measured shut.
    if (screen.interact) await screen.interact(page);
  } catch (e) {
    console.log(`  ✗ ${label} — did not render`);
    await unseed();
    return { status: 'nav', why: String(e.message || e).split('\n')[0] };
  }

  // ⚠ Did we actually LAND? A screen that renders "Not assigned to any teams" measures
  // perfectly and means nothing. This is the trap the existing coach specs document.
  const body = (await page.textContent('body').catch(() => '')) || '';
  // What a person can SEE — no inline scripts, no hidden nodes. The newer checks read this.
  const visible = (await page.innerText('body').catch(() => '')) || '';
  // ⚠ THE ADMIN GATES BY REDIRECT, not by a message (admin slice 0, 2026-09-25): a wrong org
  // lands on the user's own org, an `official` on the scorekeeper, a lapsed session on the login
  // page — each a real screen that measures cleanly and says nothing about the one asked for. So
  // an admin entry must END where it was sent. (Coach entries are not held to this: several are
  // deliberate redirect targets and their text checks above already serve them.)
  const wantPath = new URL(url).pathname;
  const gotPath = new URL(page.url()).pathname;
  if (screen.area && gotPath !== wantPath) {
    console.log(`  ✗ ${label} — redirected to ${gotPath}`);
    await unseed();
    return { status: 'landing', saw: `a redirect to ${gotPath}` };
  }
  const deniedHere = VISIBLE_LANDING_FAILURES.find((t) => visible.includes(t))
    ?? (screen.area && ADMIN_LANDING_FAILURES.find((t) => visible.includes(t)));
  if (deniedHere) {
    console.log(`  ✗ ${label} — landed on "${deniedHere}"`);
    await unseed();
    return { status: 'landing', saw: deniedHere };
  }
  const landed = LANDING_FAILURES.find((t) => body.includes(t));
  if (landed) {
    console.log(`  ✗ ${label} — landed on "${landed}"`);
    await unseed();
    return { status: 'landing', saw: landed };
  }

  // The tap floor is a touch rule (see TAP_FLOOR_MAX_WIDTH). Above that width it is not
  // relaxed to a smaller number - it is not asked, because 44px answers a question about
  // fingers that a mouse never posed.
  const tapFloorHere = w.width <= TAP_FLOOR_MAX_WIDTH ? TAP_FLOOR : 0;
  const opts = { scopeSel: screen.scope ?? null, tapFloor: tapFloorHere, exempt: exemptSelectors, only: rulesOnly,
    contrastExempt: CONTRAST_EXEMPT.map((e) => e.sel), overflowExempt: OVERFLOW_EXEMPT.map((e) => e.sel) };
  let found = await page.evaluate(probeInPage, opts);
  // `--with-dark`: dark contrast on this same page, before it is scrolled (a real dark visit reads from the top).
  const darkFound = darkAt(w) ? await probeDarkInPlace(page, opts) : null;
  await unseed();

  // The classic defect — the last row trapped under the bottom bar — only exists once the
  // page is scrolled to its end, so that rule is asked a second time down there.
  //
  // ⚠ The scroll is driven to a FIXED POINT and confirmed, not fired once and hoped for.
  // Smooth scrolling plus content that settles after paint meant a single scrollTo left the
  // page short of the end (measured: 1496 of 1567), so the second pass was reading an
  // arbitrary mid-page position.
  const wantsBottom = !rulesOnly || rulesOnly.includes('hidden-behind-chrome');
  //
  // ⚠ AND THE THING DRIVEN IS THE PAGE'S SCROLLER, which on a phone in the club admin is the
  // locked shell's main column, not the document (2026-11-07). `lockedShellScroller` is the
  // same finder the probe's R6 uses to decide `atEnd`; keep the two in step.
  const reachedBottom = wantsBottom && await page.evaluate(async () => {
    const de = document.documentElement;
    const lockedShellScroller = () => {
      const shell = de.scrollHeight <= de.clientHeight + 2 && document.querySelector('[data-admin-locked]');
      if (!shell) return null;
      let best = null, area = 0;
      for (const s of Array.from(shell.querySelectorAll('*'))) {
        if (!/(auto|scroll)/.test(getComputedStyle(s).overflowY) || s.scrollHeight <= s.clientHeight + 2) continue;
        if (s.closest('[role="dialog"], dialog, [aria-modal="true"]')) continue;
        const r = s.getBoundingClientRect();
        if (r.width * r.height > area) { area = r.width * r.height; best = s; }
      }
      return best;
    };
    const target = lockedShellScroller() ?? de;
    const prev = target.style.scrollBehavior;
    target.style.scrollBehavior = 'auto';
    let settled = false;
    for (let i = 0; i < 30; i++) {
      target.scrollTop = target.scrollHeight;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (Math.abs(target.scrollTop + target.clientHeight - target.scrollHeight) <= 2) { settled = true; break; }
    }
    target.style.scrollBehavior = prev;
    return settled;
  });
  if (wantsBottom && !reachedBottom) console.log(`      ! ${label}: page would not settle at its end — covered-by-chrome skipped`);
  const atBottom = reachedBottom
    ? await page.evaluate(probeInPage, { ...opts, only: ['hidden-behind-chrome'] })
    : [];

  const bySig = new Map();
  for (const f of [...found, ...atBottom]) {
    const k = `${f.rule}|${f.signature}`;
    if (!bySig.has(k)) bySig.set(k, f);
  }
  const skip = new Set(screen.skip ?? []);
  const kept = [...bySig.values()].filter((f) => !skip.has(f.rule)).map((f) => ({ ...f, screen: screen.id, width: w.name }));

  const darkKept = darkFound
    ? dedupeBySig(darkFound).filter((f) => !skip.has(f.rule)).map((f) => ({ ...f, screen: screen.id, width: w.name }))
    : [];

  console.log(`  ${kept.length ? '·' : '✓'} ${label}${kept.length ? ` — ${kept.length} finding(s)` : ''}` +
    `${darkFound ? ` · dark ${darkKept.length}` : ''}`);
  return { status: 'measured', kept, darkKept };
}

const dedupeBySig = (list) => [...new Map(list.map((f) => [`${f.rule}|${f.signature}`, f])).values()];

/**
 * Flip this page to dark in place, read contrast, flip back (see `--with-dark` at the flags). The theme rule is the
 * product's own (lib/no-flash-script.ts `applyNoFlashAttributes`): stored 'dark' AND a session cookie present, else
 * warm, so a signed-out page reads warm here exactly as it does on a real dark visit. Transitions are off for the
 * flip, so no colour is read mid-fade, and back on afterwards.
 */
async function probeDarkInPlace(page, opts) {
  const twoFrames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = '__sweep-no-transition';
    style.textContent = '*, *::before, *::after { transition: none !important; }';
    document.head.appendChild(style);
    try { localStorage.setItem('fl_user_theme', 'dark'); } catch { /* private mode: the rule below still decides */ }
    let signedIn = false;
    for (const part of document.cookie.split(';')) {
      const base = part.split('=')[0].trim().replace(/.d+$/, '');
      if (base.indexOf('sb-') === 0 && base.slice(-11) === '-auth-token') { signedIn = true; break; }
    }
    document.documentElement.setAttribute('data-user-theme', signedIn ? 'dark' : 'warm');
  });
  await twoFrames();
  try {
    return await page.evaluate(probeInPage, { ...opts, only: ['contrast'] });
  } finally {
    await page.evaluate(() => {
      try { localStorage.removeItem('fl_user_theme'); } catch { /* private mode */ }
      document.documentElement.setAttribute('data-user-theme', 'warm');
    }).catch(() => {});
    await twoFrames().catch(() => {});
    await page.evaluate(() => document.getElementById('__sweep-no-transition')?.remove()).catch(() => {});
  }
}

// ── dead screens, dead sessions, a dead target (header, item 3) ───────────────────────────────────────────────
/** Screen id → its first failure, once a screen has not rendered; its other widths wait for the retry. */
const deadScreens = new Map();
/** Pairs set aside for the end: failed ones and the widths of a dead screen not yet opened. */
const setAside = [];
const deadSessions = new Map();
let targetDead = null;
const timings = [];
let retries = 0;

async function recheck(session, label) {
  const t = await answers(baseUrl);
  if (t) { targetDead ??= `the target stopped answering at ${label} (${t})`; return; }
  const why = await signedIn(session);
  if (why) deadSessions.set(session, `the "${session}" session ${why} at ${label} (repair: ${AUTH_REPAIR})`);
}

/** The pair's outcome, recorded. Returns true when it was measured. */
function record(unit, screen, w, r, ms) {
  const label = pairLabel(screen.id, w.name);
  const url = baseUrl + screen.path(ctx);
  if (r.status === 'measured') {
    unit.findings.push(...r.kept);
    unit.darkFindings.push(...r.darkKept);
    timings.push({ label, ms });
    journal(screen, w, r.kept, r.darkKept, ms);
    return true;
  }
  if (r.status === 'landing') landingFailures.push({ label, url, saw: r.saw });
  return false;
}

/** Run one unit. Its findings land on the unit and are gathered in unit order once all are done. */
async function runUnit(unit) {
  const { session, clock, w, list } = unit;
  const context = await openContext(session, clock);
  let page = await openPage(context, w);
  let streak = 0;
  let onPage = 0;
  try {
    for (const screen of list) {
      const label = pairLabel(screen.id, w.name);
      const url = baseUrl + screen.path(ctx);
      if (targetDead) { unmeasuredBy(targetDead, label, url); continue; }
      if (deadSessions.has(session)) { unmeasuredBy(deadSessions.get(session), label, url); continue; }
      if (deadScreens.has(screen.id)) { setAside.push({ unit, screen, opened: false }); continue; }
      // Checked before the page is opened, not after: the goal is to not take the next bite.
      await memoryGate(label);
      if (aborted) break;
      if (onPage >= RECYCLE_EVERY) {
        await page.close().catch(() => {});
        page = await openPage(context, w);
        onPage = 0;
      }
      onPage += 1;
      const { r, ms } = await timedLane(() => measureScreen(page, screen, w, remote));
      if (record(unit, screen, w, r, ms)) { streak = 0; continue; }
      if (r.status === 'nav') {
        if (!deadScreens.has(screen.id)) deadScreens.set(screen.id, { label, why: r.why });
        setAside.push({ unit, screen, opened: true, why: r.why });
      }
      if (++streak >= SESSION_DEAD_AFTER) { streak = 0; await recheck(session, label); }
    }
  } finally {
    await context.close().catch(() => {});
  }
}

async function pool(items, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (!aborted && next < items.length) await fn(items[next++]);
  }));
}

await pool(units, runUnit);

/**
 * The one retry (header, item 3). Per dead screen: its first failed pair again, in a fresh context, with no settle
 * shortcut. Rendered → its other set-aside widths are measured now. Not rendered → it is a failure with its own reason,
 * and the rest are recorded unmeasured under it without being opened.
 */
async function retryPair({ unit, screen }) {
  const context = await openContext(unit.session, unit.clock);
  try {
    const page = await openPage(context, unit.w);
    return await timedLane(() => measureScreen(page, screen, unit.w, false));
  } finally {
    await context.close().catch(() => {});
  }
}
const byScreen = new Map();
for (const p of setAside) {
  if (targetDead) { unmeasuredBy(targetDead, pairLabel(p.screen.id, p.unit.w.name), baseUrl + p.screen.path(ctx)); continue; }
  if (deadSessions.has(p.unit.session)) { unmeasuredBy(deadSessions.get(p.unit.session), pairLabel(p.screen.id, p.unit.w.name), baseUrl + p.screen.path(ctx)); continue; }
  if (!byScreen.has(p.screen.id)) byScreen.set(p.screen.id, []);
  byScreen.get(p.screen.id).push(p);
}
if (byScreen.size && !aborted) {
  console.log(`\nRetrying ${byScreen.size} screen(s) that did not render, once each, in a fresh context:`);
  await pool([...byScreen.values()], async (pairs) => {
    const first = pairs.find((p) => p.opened) ?? pairs[0];
    await memoryGate(pairLabel(first.screen.id, first.unit.w.name));
    if (aborted) return;
    retries += 1;
    const { r, ms } = await retryPair(first);
    if (!record(first.unit, first.screen, first.unit.w, r, ms) && r.status === 'nav') {
      const label = pairLabel(first.screen.id, first.unit.w.name);
      navFailures.push({ label, url: baseUrl + first.screen.path(ctx), why: `did not render twice: ${r.why}` });
      const cause = `not opened: ${label} did not render twice (${r.why})`;
      for (const p of pairs) if (p !== first) unmeasuredBy(cause, pairLabel(p.screen.id, p.unit.w.name), baseUrl + p.screen.path(ctx));
      return;
    }
    for (const p of pairs) {
      if (p === first || aborted) continue;
      await memoryGate(pairLabel(p.screen.id, p.unit.w.name));
      if (aborted) return;
      if (p.opened) retries += 1;
      const again = await retryPair(p);
      if (!record(p.unit, p.screen, p.unit.w, again.r, again.ms) && again.r.status === 'nav') {
        navFailures.push({ label: pairLabel(p.screen.id, p.unit.w.name), url: baseUrl + p.screen.path(ctx), why: again.r.why });
      }
    }
  });
}

await browser.close();
for (const u of units) { findings.push(...u.findings); darkFindings.push(...u.darkFindings); }

// ── the run's cost (header, item 7) ───────────────────────────────────────────
const wallMs = Date.now() - runStarted;
const cost = timingSummary(timings);
const timing = {
  wallMs, wall: formatDuration(wallMs), workers, budgetMs: BUDGET_MS, measured: cost.pairs, fromJournal: done.size,
  p50Ms: cost.p50, p95Ms: cost.p95, slowest: cost.slowest, retries, pauses, lowWaterMb: memory.lowWater(), floorMb: memory.floor,
};
const costLine = `Run cost · ${timing.wall} wall-clock · ${workers} worker(s) · ${cost.pairs} pair(s) measured` +
  `${done.size ? ` + ${done.size} from the journal` : ''} · p50 ${(cost.p50 / 1000).toFixed(1)} s · p95 ${(cost.p95 / 1000).toFixed(1)} s` +
  ` · ${retries} retried · ${pauses} pause(s) · memory low ${timing.lowWaterMb} MB (floor ${timing.floorMb} MB)`;
console.log(`\nSlowest pairs: ${cost.slowest.map((p) => `${p.label} ${(p.ms / 1000).toFixed(1)} s`).join(' · ') || '(none)'}`);
// The cost is the run's LAST line, whichever way it ends below.
process.on('exit', () => console.log(`${notServedLine ? `\n${notServedLine}` : ''}\n${costLine}`));

// ⚠ Must come BEFORE anything that writes the baseline. An aborted sweep left screens
// unmeasured, and unmeasured screens contribute no findings — so a baseline written from one
// records the product as cleaner than it is. Same reasoning as the partial-run guard below,
// except an abort produces no nav failures for that guard to catch, so it needs its own exit.
// ⚠ And unlike that guard, this one has NO --allow-partial escape hatch, deliberately: a nav
// failure is a countable, inspectable set of screens you might knowingly accept, whereas an
// abort stopped at an arbitrary point with an unknown remainder. There is no case where
// snapshotting that is the right thing to do, so the override is not offered.
// (The journal keeps every pair measured before the abort, so the re-run with --resume measures only the rest.)
if (aborted) {
  memory.report(aborted);
  process.exit(1);
}
memory.summarise();

const causedCount = [...causes.values()].reduce((n, l) => n + l.length, 0);
const unmeasuredCount = navFailures.length + landingFailures.length + causedCount;

// `--dump`: every finding this run saw, keyed exactly as the baseline keys them, plus what could
// not be measured — so two runs (a slice's before and after) diff as sets. Written before the
// modes below, which may exit non-zero on a finding the dump exists to record.
if (dumpFile) {
  const out = path.resolve(ROOT, dumpFile);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({
    generated: new Date().toISOString(),
    theme: theme ?? 'default',
    sidebar,
    rules: rulesOnly ?? 'all',
    pairs: pairCount,
    commit,
    timing,
    notServed,
    findings: Object.fromEntries(findings.map((f) => [keyOf(f), f.detail])),
    unmeasured: [...navFailures.map((f) => f.label), ...landingFailures.map((f) => f.label),
      ...[...causes.values()].flat().map((f) => f.label)],
  }, null, 2) + '\n');
  console.log(`\nDump: ${path.relative(ROOT, out)} (${findings.length} findings)`);
  if (withDark) {
    // Shaped exactly as a `--theme=dark` run's dump, so the two diff as sets.
    const darkOut = out.replace(/(\.json)?$/, '.dark.json');
    const darkPairs = screens.reduce((n, s) => n + widths.filter((w) => runsAt(s, w) && darkAt(w)).length, 0);
    writeFileSync(darkOut, JSON.stringify({
      generated: new Date().toISOString(), theme: 'dark', sidebar, rules: ['contrast'], pairs: darkPairs, commit,
      measured: 'in place, on the warm run\'s page (--with-dark)',
      findings: Object.fromEntries(darkFindings.map((f) => [keyOf(f), f.detail])),
    }, null, 2) + '\n');
    console.log(`Dump: ${path.relative(ROOT, darkOut)} (${darkFindings.length} dark findings)`);
  }
}

// ── hard failures first: a screen we could not measure is not a pass ──────────
if (unmeasuredCount) {
  console.error('\n✗ Screens that could not be measured — these are failures, not skips:');
  for (const f of navFailures) console.error(`    ${f.label} — ${f.why}\n      ${f.url}`);
  for (const f of landingFailures) console.error(`    ${f.label} — landed on "${f.saw}"\n      ${f.url}`);
  for (const [cause, list] of causes) {
    console.error(`    ${list.length} pair(s) — ${cause}`);
    console.error(`      ${list.slice(0, 12).map((f) => f.label).join(', ')}${list.length > 12 ? `, …and ${list.length - 12} more` : ''}`);
  }
  console.error(`\n  Usual causes: the fixture is incomplete (node scripts/seed-uat-coach-fixture.mjs),`);
  console.error(`  the session is stale (${AUTH_REPAIR}),`);
  console.error(remote
    ? `  or the target stopped answering. Re-run just the missing screens with --only=<ids>.`
    : `  or the dev server died mid-run — a full sweep has exhausted its heap before now,\n  which kills every remaining screen. Restart it and re-run the missing width.`);
  if (mode === 'check') process.exit(1);

  // ⚠ NEVER snapshot a partial run. An unmeasured screen contributes no findings, so a baseline
  // written from a crashed sweep silently records the product as cleaner than it is — and the
  // headline "look how much this improved" is then partly just screens nobody looked at. This
  // exact thing happened on 2026-08-02: the server ran out of memory during the 1440 pass and 26
  // of 112 combinations went unmeasured, which would have overstated a colour fix by a wide margin.
  if ((mode === 'init' || mode === 'prune') && !has('--allow-partial')) {
    console.error(`\n✗ Refusing to write the baseline from an incomplete run (${unmeasuredCount} unmeasured).`);
    console.error(`  Fix the cause and re-run, or narrow the run: --width=<w> / --only=<ids>.`);
    console.error(`  To override deliberately: --allow-partial`);
    process.exit(1);
  }
}

// ── modes ─────────────────────────────────────────────────────────────────────
const baseline = readBaseline(BASELINE);
const known = baseline.entries ?? {};
/** Dark's own accepted list (ask A3) — null on any other run. */
const darkKnown = theme === 'dark' ? readBaseline(DARK_BASELINE).entries ?? {} : null;
/**
 * A dark run matches contrast on the ELEMENT: a contrast signature ends in the colours it was read
 * at, which differ between the themes by design, so a whole-key match would call every dark reading
 * new. Element-matched, NEW means "unreadable in dark, and not already known in warm" — the question
 * the separate warm/dark comparison of the 2026-10-13 sweep answered by hand.
 */
const elementKey = (k) => (k.split('|')[2] === 'contrast' ? k.replace(/·[^·]*on\d+,\d+,\d+$/, '') : k);
const knownElements = theme === 'dark' ? new Set(Object.keys(known).map(elementKey)) : null;
/** Known with the full sidebar — or, in a strip run, under the strip's own key too. */
const isKnownKey = (k) => (knownElements ? knownElements.has(elementKey(k)) : k in known);
const knownInWarm = (f) => isKnownKey(keyOf(f)) || (stripRun && isKnownKey(stripKeyOf(f)));
/** Accepted on dark's own list: whole key, colours included, so a changed colour reads as new again. */
const knownInDark = (f) => !!darkKnown && (keyFor(f) in darkKnown || (stripRun && keyOf(f) in darkKnown));

if (mode === 'init') {
  // A dark run writes dark's own list, and only what warm does not already hold: the dark-only findings.
  const file = darkKnown ? DARK_BASELINE : BASELINE;
  const previous = darkKnown ?? known;
  const entries = {};
  // A strip run records only what the full sidebar does not already have, under its own key.
  const recorded = darkKnown
    ? findings.filter((f) => !knownInWarm(f) && !(stripRun && keyOf(f) in previous))
    : stripRun ? findings.filter((f) => !(keyOf(f) in previous)) : findings;
  for (const f of recorded) {
    const k = keyFor(f);
    entries[k] = { reason: previous[k]?.reason ?? null, detail: f.detail };
  }
  // Keep every entry this run does not own (a --only run must not erase the rest of the file, and a strip
  // run never rewrites the full sidebar's entries, nor a full run the strip's).
  const covered = new Set(recorded.map(keyFor));
  for (const [k, v] of Object.entries(previous)) {
    if (!ownsKey(k) && !covered.has(k)) entries[k] = v;
  }
  writeFileSync(file, JSON.stringify({ generated: new Date().toISOString(), entries }, null, 2) + '\n');
  const unexplained = Object.values(entries).filter((e) => !e.reason).length;
  console.log(`\nBaseline written: ${Object.keys(entries).length} entr(ies), ${unexplained} without a reason.`);
  console.log(`  ${path.relative(ROOT, file)}`);
  process.exit(0);
}

const seen = new Set(findings.map(keyFor));
const fresh = findings.filter((f) => !knownInWarm(f) && !knownInDark(f));
// ⚠ A run limited to some rules cannot say an entry of ANOTHER rule stopped reproducing — it never
// asked. Without this, a contrast-only run listed every geometry entry as "the ratchet can tighten".
// A dark run can say it of dark's own list, which holds contrast only.
const stale = darkKnown
  ? Object.keys(darkKnown).filter((k) => ownsKey(k) && !seen.has(k))
  : rulesOnly ? [] : Object.keys(known).filter((k) => ownsKey(k) && !seen.has(k));

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
  md += `| \`hidden-behind-chrome\` | Nothing usable hides under a fixed bar. |\n`;
  md += `| \`control-width\` | An icon-only control is ${TAP_FLOOR}px wide as well as tall — at touch widths only. |\n`;
  md += `| \`type-ladder\` | Every table cell — and every line of a row list — reads at a size on the type ladder (membership, not pixels). |\n`;
  md += `| \`list-ground\` | A row list sits on the card: the first painted ancestor behind a row IS the card token, painted by exactly one thing; at ≤ 640 each row is its own card and nothing paints a slab behind the stack. Read from the ancestor, never the row (F-24). |\n\n`;
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
/**
 * `--with-dark`: the dark findings judged exactly as a `--theme=dark` run judges them — NEW means not known in warm
 * (matched on the ELEMENT, see `elementKey`) and not on dark's own accepted list (whole key).
 */
let darkFresh = [];
if (withDark) {
  const darkList = readBaseline(DARK_BASELINE).entries ?? {};
  const warmElements = new Set(Object.keys(known).map(elementKey));
  const inWarm = (f) => warmElements.has(elementKey(keyOf(f))) || (stripRun && warmElements.has(elementKey(stripKeyOf(f))));
  const inDark = (f) => keyFor(f) in darkList || (stripRun && keyOf(f) in darkList);
  darkFresh = darkFindings.filter((f) => !inWarm(f) && !inDark(f));
  if (darkFresh.length) {
    console.error(`✗ ${darkFresh.length} NEW dark-mode contrast finding(s) (read in place):\n`);
    const byScreen = {};
    for (const f of darkFresh) (byScreen[f.screen] ??= []).push(f);
    for (const [screen, list] of Object.entries(byScreen)) {
      console.error(`  ${screen}`);
      for (const f of list) console.error(`    @${f.width} [${f.rule}] ${f.signature}\n        ${f.detail}`);
    }
    console.error(`\n  Fix them, or — on the owner's word — record dark's list with a reason from a real dark run:`);
    console.error(`    node scripts/check-layout-invariants.mjs --theme=dark --init${stripRun ? ' --sidebar=strip' : ''}\n`);
  } else {
    console.log(`✓ No new dark-mode contrast findings (${darkFindings.length} read in place; dark's list: ${Object.keys(darkList).length} accepted).`);
  }
}
if (fresh.length) {
  console.error(`✗ ${fresh.length} NEW layout finding(s):\n`);
  const byScreen = {};
  for (const f of fresh) (byScreen[f.screen] ??= []).push(f);
  for (const [screen, list] of Object.entries(byScreen)) {
    console.error(`  ${screen}`);
    for (const f of list) console.error(`    @${f.width} [${f.rule}] ${f.signature}\n        ${f.detail}`);
  }
  if (theme === 'dark') {
    // Dark has its own accepted list (ask A3): a deliberate dark-only finding is recorded there, on the owner's word.
    console.error(`\n  Fix them, or — if one is a deliberate decision, on the owner's word — record dark's list with a reason:`);
    console.error(`    node scripts/check-layout-invariants.mjs --theme=dark --init${stripRun ? ' --sidebar=strip' : ''}   (then write the reason into the entry)`);
  } else if (adHocWidth) {
    // --init refuses an ad-hoc width (it has no baseline), so every finding here reads as new by design.
    console.error(`\n  ${onlyWidth} has no baseline, so every finding reads as new: --dump this run in both sidebar states and diff them.`);
  } else {
    console.error(`\n  Fix them, or — if one is a deliberate decision — record it with a reason:`);
    console.error(`    node scripts/check-layout-invariants.mjs --init${stripRun ? ' --sidebar=strip' : ''}   (then write the reason into the entry)`);
  }
  process.exit(1);
}

const ownList = darkKnown ?? known;
const unexplained = Object.values(ownList).filter((e) => !e.reason).length;
console.log(`✓ No new layout findings. ${darkKnown ? `Dark's list: ${Object.keys(darkKnown).length} accepted, warm: ${Object.keys(known).length} known` : `Baseline: ${Object.keys(known).length} known`} (${unexplained} without a reason).`);
if (stale.length) {
  console.log(`\n  ${stale.length} ${darkKnown ? "of dark's accepted entr(ies)" : 'baseline entr(ies)'} no longer reproduce — the ratchet can tighten:`);
  for (const k of stale.slice(0, 15)) console.log(`    ${k}`);
  if (stale.length > 15) console.log(`    …and ${stale.length - 15} more`);
  console.log(darkKnown
    ? "  Drop them: re-run the same dark run with --init (on the owner's word); it rewrites only what it measured."
    : '  Drop them: node scripts/check-layout-invariants.mjs --prune');
}
// `--with-dark`: warm passed, but a NEW dark finding still fails the run (printed above, before the warm verdict).
if (darkFresh.length) process.exit(1);
