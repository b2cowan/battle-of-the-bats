/**
 * Color-token guardrail + inventory — EVERY surface, EVERY color format.
 *
 * A rebrand must be "edit app/globals.css once → ship → nothing straggles". That only holds
 * if no color is typed directly into a stylesheet or a component. This script is the gate.
 *
 * ── Scopes (each has its OWN baseline + report; never conflated) ───────────────
 *   public      public fan/org tournament surfaces + public chrome
 *   operator    admin / coaches / scorekeeper / platform-admin shells + their component libs
 *   consumer    the signed-in consumer app (home / scores / chat / account)
 *   marketing   the logged-out marketing site (/, /for-*, /pricing, /changelog)
 *   shared      renders in BOTH a public and an operator shell (chat, help, root chrome…)
 *   tsx         inline colors in component code (style={{…}} / string literals) — see below
 *
 * ── What is flagged ───────────────────────────────────────────────────────────
 *   1. literal hex        (#RGB / #RRGGBB / #RRGGBBAA)
 *   2. BRAND rgb()/rgba() — only triples that match a `--*-rgb` token in globals `:root`,
 *      plus the stale pre-refresh lime. Deliberately NOT every rgba: white/black alphas
 *      (rgba(255,255,255,…) / rgba(0,0,0,…)) are the --white-NN/--black-NN family, and
 *      arbitrary one-off tints are not brand colors.
 *
 * ── Escape hatch: `token-exempt` ──────────────────────────────────────────────
 * A genuinely non-brand literal (print-only neutral, gradient stop, decorative accent,
 * a user-chosen team color swatch) is exempted by naming a REASON on the same line or the
 * line above:  `color: #F0F0F0; /* token-exempt: print-only neutral *​/`
 * A bare `token-exempt` with no reason does NOT exempt — the reason is the point. This is
 * what lets every baseline sit at a true 0: whatever survives is explained in place.
 *
 * ── Modes ─────────────────────────────────────────────────────────────────────
 *   node scripts/check-public-tokens.mjs [--scope=…]           RATCHET (default): fail if any
 *                                                              file exceeds its baseline
 *   node scripts/check-public-tokens.mjs --scope=all           every scope + coverage, one run
 *   node scripts/check-public-tokens.mjs [--scope=…] --report  write the inventory doc
 *   node scripts/check-public-tokens.mjs [--scope=…] --init    snapshot / lower the baseline
 *   node scripts/check-public-tokens.mjs --coverage            fail if any *.module.css under
 *                                                              app/ or components/ belongs to
 *                                                              NO scope (or to two)
 *   node scripts/check-public-tokens.mjs --staged <files…>     pre-commit: staged files only
 *
 * `--scope=all` and `--coverage` mean new scopes and new stylesheets are picked up
 * automatically — amplify.yml / verify:changed never need editing again.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { execSync } from 'node:child_process';
import { ownerOf, SHARED_SURFACE } from './lib/admin-old-look.mjs';

const ROOT = process.cwd();

// ── scope config ──────────────────────────────────────────────────────────────
// dirs: recursive roots (a trailing `*` is a prefix glob, e.g. 'app/for-*' — so a new
//       marketing page directory is covered the day it lands).
// files: individual stylesheets living outside those roots.
// excludeSegments: path segments to skip; excludeFiles: exact paths claimed by another scope.
//
// warmTheme.module.css is never scanned anywhere — it DEFINES the --home-* tokens, so literal
// hex there is correct by construction.
const SCOPES = {
  public: {
    // Public tournament/org surfaces + public chrome. (app/teams — the pre-multi-tenant public
    // team profile — was deleted 2026-07-24; the live one is under app/[orgSlug].)
    // register.module.css files are PUBLIC registration forms (C24), not operator screens,
    // even though they sit in the rep-teams/league component folders.
    dirs: ['app/[orgSlug]', 'components/public'],
    files: [
      'components/Navbar.module.css',
      'components/consumer/ConsumerShell.module.css',
      'components/rep-teams/register.module.css',
      'components/league/register.module.css',
      'components/YearSelector.module.css',
    ],
    excludeSegments: new Set(['admin', 'scorekeeper', 'coaches']),
    baseline: 'scripts/.public-token-baseline.json',
    report: 'docs/projects/active/PUBLIC_VISUAL_REDESIGN_TOKEN_DEBT.md',
    reportTitle: 'Public Visual Redesign',
  },
  operator: {
    // Operator shells + the component libraries only they render. The public scan excludes
    // admin/coaches/scorekeeper, so these need their own roots.
    dirs: [
      'app/[orgSlug]/admin',
      'app/[orgSlug]/coaches',
      'app/[orgSlug]/scorekeeper',
      'app/coaches',
      'app/platform-admin',
      'app/tryout-score',
      'components/admin',
      'components/coaches',
      'components/charts',
      'components/accounting',
      'components/billing',
      'components/feedback',
      'components/platform-admin',
      'components/volunteer',
    ],
    // Named individually, NOT by folder: components/rep-teams also holds the PUBLIC
    // register.module.css (claimed by the public scope above), and components/notifications
    // is split between operator chrome and consumer preference screens.
    files: [
      'components/rep-teams/TryoutDayCard.module.css',
      'components/rep-teams/TryoutRubricCard.module.css',
      'components/rep-teams/TryoutFlowHeader.module.css',
      'components/rep-teams/TryoutSetupChecklist.module.css',
      'components/rep-teams/TryoutCheckIn.module.css',
      'components/rep-teams/TryoutNamesSwitch.module.css',
      'components/rep-teams/TryoutReportCard.module.css',
      'components/rep-teams/TryoutBaselineCard.module.css',
      'components/rep-teams/TryoutMemoryStrip.module.css',
      // The shared field scorer (Chunk E WI-1) — one surface behind the public token door AND
      // the coach's signed-in door; deliberately fixed-dark (token-exempt annotations inline).
      'components/rep-teams/TryoutScorerSurface.module.css',
      'components/notifications/notifications.module.css',
      'components/notifications/notifications-page.module.css',
      'components/notifications/NotificationUndoNote.module.css',
      'components/notifications/NotificationMessage.module.css',
      'components/notifications/NotificationReader.module.css',
      'components/notifications/notification-buttons.module.css',
      'components/notifications/EnablePushBanner.module.css',
    ],
    excludeSegments: new Set(),
    baseline: 'scripts/.operator-token-baseline.json',
    report: 'docs/projects/active/OPERATOR_VISUAL_TOKEN_DEBT.md',
    reportTitle: 'Operator Visual Cleanup',
  },
  consumer: {
    // The signed-in consumer app. ConsumerShell.module.css is deliberately NOT here — it is
    // the public chrome wrapper and is counted once, under `public`.
    dirs: ['app/(consumer)', 'components/consumer'],
    files: [
      'components/home/PendingInvitationsCard.module.css',
      'app/team/page.module.css',
      'components/notifications/PreferencesTable.module.css',
      'components/notifications/PushDeviceTester.module.css',
      'components/notifications/FanAlertsCard.module.css',
      // Chunk D 3.2 — the player season recap, rendered on the family page AND (inside the
      // consumer warm shell) in the coach's preview. Scoped as consumer because that is the
      // token set it is built on and the surface it is for.
      'components/family/PlayerRecapView.module.css',
    ],
    excludeSegments: new Set(),
    excludeFiles: new Set(['components/consumer/ConsumerShell.module.css']),
    baseline: 'scripts/.consumer-token-baseline.json',
    report: 'docs/projects/active/CONSUMER_VISUAL_TOKEN_DEBT.md',
    reportTitle: 'Consumer App',
  },
  marketing: {
    // Logged-out marketing site. 'app/for-*' is a prefix glob so a new segment page is
    // guarded from the moment it exists.
    // app/see-it-live is the sandbox door's confirm screen — a funnel surface between the
    // marketing site and the demo, wearing the marketing ground.
    dirs: ['app/for-*', 'app/pricing', 'app/changelog', 'components/marketing', 'app/see-it-live'],
    files: [
      'app/page.module.css',
      'components/PricingSection.module.css',
      'components/EarlyAccessForm.module.css',
      'components/EarlyAccessModalTrigger.module.css',
    ],
    excludeSegments: new Set(),
    baseline: 'scripts/.marketing-token-baseline.json',
    report: 'docs/projects/active/MARKETING_VISUAL_TOKEN_DEBT.md',
    reportTitle: 'Marketing Site',
  },
  shared: {
    // C40: surfaces that render inside BOTH a public/consumer shell and an operator shell.
    // Given their own scope (owner call 2026-07-25) rather than double-listed, so the debt
    // is counted once and cross-cutting screens are obvious. app/system-screens.module.css is
    // root chrome (error/404/offline) reachable from every shell, so it lives here too.
    // components/sandbox is here for the same reason: the "See it live" chrome mounts over the
    // PUBLIC tournament pages and the OPERATOR admin shell from one place in the org layout.
    dirs: ['components/chat', 'components/shared', 'components/help', 'components/whats-new', 'components/bracket', 'components/sandbox'],
    files: [
      'components/InstallAppPrompt.module.css',
      'components/TeamAvatar.module.css',
      // The product-wide confirm/feedback dialog: global .modal classes carry the admin look,
      // the module carries the coaches-portal skin — one dialog, every shell.
      'components/FeedbackModal.module.css',
      /* ⚰ `components/notifications/PushPermissionPrompt.module.css` was listed here and went with
         its component on 2026-09-01 (cleanup tranche 6) — both were unimported. A dead entry here
         is inert (the walker skips a missing file) but it makes this list describe a product that
         no longer exists, which is how a scope list stops being readable. */
      'app/system-screens.module.css',
      // The site footer renders on TWO grounds since Chunk C — the marketing site's dark ground
      // and the consumer app's warm paper (which itself follows the account's Dark/Warm
      // preference). Cross-shell root chrome, same reason system-screens.module.css lives here.
      'components/Footer.module.css',
    ],
    excludeSegments: new Set(),
    baseline: 'scripts/.shared-token-baseline.json',
    report: 'docs/projects/active/SHARED_VISUAL_TOKEN_DEBT.md',
    reportTitle: 'Shared Surfaces',
  },
  tsx: {
    // Inline colors in component code — invisible to a *.module.css scanner but exactly as
    // rebrand-hostile: style={{ color: '#0f1123' }}, 'rgba(217,249,157,0.4)' strings, and
    // var(--tok, #fallback) fallbacks that silently render the OLD brand if the token moves.
    // Ratchet only: the existing population is grandfathered by the baseline; the point is
    // that no NEW inline color can be added.
    dirs: ['app', 'components'],
    files: [],
    ext: '.tsx',
    excludeSegments: new Set(['__tests__', 'node_modules']),
    baseline: 'scripts/.tsx-token-baseline.json',
    report: 'docs/projects/active/INLINE_TSX_TOKEN_DEBT.md',
    reportTitle: 'Inline Component Colors',
  },
};

const CSS_SCOPES = Object.keys(SCOPES).filter(s => !SCOPES[s].ext);

const scopeArg = process.argv.find(a => a.startsWith('--scope='));
const SCOPE = scopeArg ? scopeArg.slice('--scope='.length) : 'public';
const mode = process.argv.includes('--report') ? 'report'
  : process.argv.includes('--init') ? 'init'
  : process.argv.includes('--coverage') ? 'coverage'
  : 'check';

if (SCOPE !== 'all' && !SCOPES[SCOPE] && mode !== 'coverage') {
  console.error(`Unknown --scope="${SCOPE}". Use one of: ${Object.keys(SCOPES).join(', ')}, all.`);
  process.exit(1);
}

// ── token maps from app/globals.css ───────────────────────────────────────────
// ONLY the top-level `:root` blocks. Tokens declared inside a theme gate
// (html[data-user-theme="warm"] …, [data-color-mode="light"], warmTheme.module.css .warmVars)
// are intentionally excluded: --home-paper / --home-rust / --gold-strong etc. do not resolve
// outside their gate, so telling a dark-mode stylesheet to use them would be a real bug.
function rootBlocks(text) {
  const out = [];
  const re = /(^|\n)\s*:root\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const open = text.indexOf('{', m.index);
    let depth = 0, end = open;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) { end = i; break; }
    }
    out.push(text.slice(open, end));
  }
  return out;
}

function norm(hex) {
  let h = hex.replace('#', '').toLowerCase();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return '#' + h.slice(0, 6).toUpperCase();
}

// Pre-palette-refresh lime. Not a token any more, but ~70 sites still carry it; flagging it
// here is what surfaces them. Swapping CHANGES THE RENDERED HUE — never a blind swap.
const STALE_BRAND_RGB = { '163,230,53': ['--logic-lime-rgb  ⚠ STALE pre-refresh lime — hue change'] };
const STALE_BRAND_HEX = { '#A3E635': ['--logic-lime  ⚠ STALE pre-refresh lime — hue change'] };

function buildTokenMaps() {
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');
  const hexMap = { ...STALE_BRAND_HEX };
  const rawRgb = {};
  for (const block of rootBlocks(css)) {
    for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g)) {
      (hexMap[norm(m[2])] ||= []).push(m[1]);
    }
    for (const m of block.matchAll(/(--[a-z0-9-]+-rgb)\s*:\s*([^;]+);/g)) rawRgb[m[1]] = m[2].trim();
  }
  // Resolve `--primary-rgb: var(--platform-primary-rgb)` chains down to a literal triple.
  const resolve = (tok, seen = new Set()) => {
    const v = rawRgb[tok];
    if (!v || seen.has(tok)) return null;
    seen.add(tok);
    const alias = v.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/);
    if (alias) return resolve(alias[1], seen);
    const t = v.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
    return t ? `${+t[1]},${+t[2]},${+t[3]}` : null;
  };
  const rgbMap = { ...STALE_BRAND_RGB };
  for (const tok of Object.keys(rawRgb)) {
    const triple = resolve(tok);
    if (triple) (rgbMap[triple] ||= []).push(tok);
  }
  return { hexMap, rgbMap };
}

const { hexMap, rgbMap } = buildTokenMaps();

// ── file discovery ────────────────────────────────────────────────────────────
function expandDirs(dirs) {
  const out = [];
  for (const d of dirs) {
    if (!d.endsWith('*')) { out.push(d); continue; }
    const prefix = d.slice(0, -1);
    const slash = prefix.lastIndexOf('/');
    const parent = slash === -1 ? '.' : prefix.slice(0, slash);
    const stem = prefix.slice(slash + 1);
    const abs = join(ROOT, parent);
    if (!existsSync(abs)) continue;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory() && e.name.startsWith(stem)) out.push(`${parent}/${e.name}`);
    }
  }
  return out;
}

function scopeFiles(cfg) {
  const ext = cfg.ext || '.module.css';
  const out = [];
  for (const d of expandDirs(cfg.dirs)) {
    const abs = join(ROOT, d);
    if (!existsSync(abs)) continue;
    for (const rel of readdirSync(abs, { recursive: true })) {
      const p = String(rel).split(sep).join('/');
      if (!p.endsWith(ext)) continue;
      if (p.endsWith('.test.tsx') || p.endsWith('.spec.tsx')) continue;
      if (p.split('/').some(s => cfg.excludeSegments.has(s))) continue;
      const full = `${d}/${p}`;
      if (full.endsWith('warmTheme.module.css')) continue;   // DEFINES tokens
      if (cfg.excludeFiles?.has(full)) continue;
      out.push(full);
    }
  }
  for (const f of cfg.files) {
    if (existsSync(join(ROOT, f))) out.push(f);
  }
  return [...new Set(out)].sort();
}

// ── scanning ──────────────────────────────────────────────────────────────────
// Comments are blanked (newlines preserved so line numbers stay true) BEFORE matching, but
// the raw lines are kept so a `token-exempt: reason` marker — which lives in a comment — is
// still visible. A marker on the literal's own line or the line directly above exempts it.
const EXEMPT = /token-exempt:\s*\S/;
/** Is 0-based line `idx` exempt — a `token-exempt: reason` on it or on the line above? */
const exemptAt = (rawLines, idx) => EXEMPT.test(rawLines[idx] || '') || EXEMPT.test(rawLines[idx - 1] || '');

// Block comments only — valid for CSS and TSX alike. JS line comments are deliberately left
// alone: a `//` inside a URL string ("https://…") would swallow the rest of the line and hide
// real literals. A hex sitting in a `//` comment is a harmless, baseline-grandfathered miss.
const blankComments = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '));

function scan(file) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const rawLines = raw.split(/\r?\n/);
  const lines = blankComments(raw).split(/\r?\n/);
  const hex = [], rgba = [];
  lines.forEach((line, idx) => {
    if (exemptAt(rawLines, idx)) return;
    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      hex.push({ line: idx + 1, value: m[0], tokens: hexMap[norm(m[0])] });
    }
    // Legacy `rgb(r, g, b)` / `rgba(r, g, b, a)` and modern `rgb(r g b / a)`.
    for (const m of line.matchAll(/\brgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,/)]/g)) {
      const triple = `${+m[1]},${+m[2]},${+m[3]}`;
      const tokens = rgbMap[triple];
      if (tokens) rgba.push({ line: idx + 1, value: `rgb(${triple})`, tokens });
    }
  });
  return { hex, rgba };
}

const readBaseline = (cfg) => {
  const p = join(ROOT, cfg.baseline);
  if (!existsSync(p)) return {};
  const parsed = JSON.parse(readFileSync(p, 'utf8'));
  // Tolerate the pre-2026-07-25 shape (a bare number = hex count, rgba was not yet scanned).
  for (const k of Object.keys(parsed)) {
    if (typeof parsed[k] === 'number') parsed[k] = { hex: parsed[k], rgba: 0 };
  }
  return parsed;
};
const allowed = (baseline, file) => baseline[file] ?? { hex: 0, rgba: 0 };

// ── --staged: pre-commit mode ─────────────────────────────────────────────────
// Only files STAGED in this commit, against their own baseline — pre-existing debt (or
// another session's files) never blocks an unrelated commit. Iterates every scope, so a
// scope added above is enforced with no hook edit.
if (process.argv.includes('--staged')) {
  // The hook passes staged paths as args (the reliable path on Windows, where node's
  // execSync shell may not have git on PATH). Fall back to asking git directly.
  let staged = process.argv.slice(2).filter(a => a.endsWith('.module.css') || a.endsWith('.tsx'));
  if (staged.length === 0) {
    try {
      staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
        .split(/\r?\n/).map(s => s.trim()).filter(f => f.endsWith('.module.css') || f.endsWith('.tsx'));
    } catch { staged = []; }
  }
  const stagedSet = new Set(staged.map(f => f.replace(/\\/g, '/')));
  if (stagedSet.size === 0) { console.log('✓ Pre-commit token check: nothing to check.'); process.exit(0); }

  const offenders = [];
  for (const [name, cfg] of Object.entries(SCOPES)) {
    const baseline = readBaseline(cfg);
    for (const f of scopeFiles(cfg)) {
      if (!stagedSet.has(f)) continue;
      const { hex, rgba } = scan(f);
      const cap = allowed(baseline, f);
      if (hex.length > cap.hex) offenders.push({ name, f, kind: 'hex', found: hex, count: hex.length, cap: cap.hex });
      if (rgba.length > cap.rgba) offenders.push({ name, f, kind: 'brand rgba', found: rgba, count: rgba.length, cap: cap.rgba });
    }
  }
  if (offenders.length) {
    console.error('✖ Pre-commit: staged file(s) add hardcoded color(s) that should be design tokens.');
    for (const o of offenders) {
      console.error(`    [${o.name}] ${o.f}: ${o.count} ${o.kind} literal(s) (baseline ${o.cap})`);
      for (const h of o.found.slice(-6)) {
        console.error(`        line ${h.line}: ${h.value}${h.tokens ? `  →  ${h.tokens.join(' / ')}` : '  (no token match)'}`);
      }
    }
    console.error('  Fix: use a var(--token) from app/globals.css.');
    console.error('  Genuinely not a brand color? annotate it in place:  /* token-exempt: why */');
    process.exit(1);
  }
  console.log(`✓ Pre-commit token check: ${stagedSet.size} staged file(s) clean.`);
  process.exit(0);
}

// ── --coverage: no stylesheet may be invisible to the guardrail ───────────────
// Without this, a brand-new components/whatever/x.module.css belongs to no scope and its
// colors are never checked. This is the check that makes "every surface" true over time.
function coverage() {
  const owner = new Map();
  const conflicts = [];
  for (const name of CSS_SCOPES) {
    for (const f of scopeFiles(SCOPES[name])) {
      if (owner.has(f)) conflicts.push({ f, a: owner.get(f), b: name });
      else owner.set(f, name);
    }
  }
  const all = [];
  for (const base of ['app', 'components']) {
    const abs = join(ROOT, base);
    if (!existsSync(abs)) continue;
    for (const rel of readdirSync(abs, { recursive: true })) {
      const p = String(rel).split(sep).join('/');
      if (p.endsWith('.module.css') && !p.endsWith('warmTheme.module.css')) all.push(`${base}/${p}`);
    }
  }
  const orphans = all.filter(f => !owner.has(f)).sort();
  if (orphans.length || conflicts.length) {
    if (orphans.length) {
      console.error(`✖ Token-guardrail coverage: ${orphans.length} CSS module(s) belong to NO scope:`);
      for (const f of orphans) console.error(`    ${f}`);
      console.error('  Add each to the right scope in scripts/check-public-tokens.mjs (SCOPES), then --init.');
    }
    for (const c of conflicts) console.error(`✖ ${c.f} is claimed by BOTH "${c.a}" and "${c.b}" — debt would be double-counted.`);
    return false;
  }
  console.log(`✓ Token-guardrail coverage: all ${all.length} CSS module(s) belong to exactly one scope.`);
  return true;
}

if (mode === 'coverage') process.exit(coverage() ? 0 : 1);

// ── check / init / report ─────────────────────────────────────────────────────
function checkScope(name) {
  const cfg = SCOPES[name];
  const baseline = readBaseline(cfg);
  const files = scopeFiles(cfg);
  const offenders = [];
  for (const f of files) {
    const { hex, rgba } = scan(f);
    const cap = allowed(baseline, f);
    if (hex.length > cap.hex || rgba.length > cap.rgba) {
      offenders.push({ f, hex: hex.length, rgba: rgba.length, cap, found: [...hex, ...rgba] });
    }
  }
  if (offenders.length) {
    console.error(`✖ Token-debt ratchet (${name}): new hardcoded color(s).`);
    for (const o of offenders) {
      console.error(`    ${o.f}: ${o.hex} hex / ${o.rgba} brand-rgba (baseline ${o.cap.hex}/${o.cap.rgba})`);
      for (const h of o.found.slice(0, 8)) {
        console.error(`        line ${h.line}: ${h.value}${h.tokens ? `  →  ${h.tokens.join(' / ')}` : '  (no token match)'}`);
      }
    }
    console.error(`  Use var(--token) from app/globals.css, or annotate: /* token-exempt: why */`);
    console.error(`  Last resort re-baseline: node scripts/check-public-tokens.mjs --scope=${name} --init`);
    return false;
  }
  const debt = files.reduce((s, f) => { const r = scan(f); return s + r.hex.length + r.rgba.length; }, 0);
  console.log(`✓ Token-debt ratchet (${name}): ${files.length} file(s), ${debt} grandfathered literal(s) remaining.`);
  return true;
}

// ── the admin: STRICT — no colour literal at all, with a debt list that only shrinks ─────────────
// (Admin Design Continuity: Phase 1 2026-09-25 → released 2026-09-28 → closed 2026-09-30.)
// The rules above count only hex and BRAND rgb; white/black alphas and one-off tints pass them, and those
// are exactly the literals a theme cannot move (the Phase 0 inventory: 769 of the admin's 812). So the admin
// is held to more: NO literal colour — no hex, no rgb()/hsl() without a var() inside, no named colour.
//   • EVERY stylesheet under the admin's roots (`ADMIN_ROOTS`: the admin, its components, the volunteer
//     shells) is strict, whole file — a new sheet is born strict, and needs no entry here.
//   • …unless it is on `ADMIN_COLOUR_DEBT`: a sheet still carrying the old look, retired by the redesign
//     stage that rebuilds its screen (named from `scripts/lib/admin-old-look.mjs`). The list may only
//     SHRINK: an entry that has come clean fails until it is taken off, so it cannot quietly regress. Its
//     literals are held meanwhile by value in the restyled ratchet below, and its kit rules are strict.
//   • …or a SHARED-SURFACE part (`SHARED_SURFACE`, the same lib): its base rules are another surface's
//     look, so only its `[data-admin-kit]` rules are strict — as for every sheet anywhere that scopes one.
//   • Outside the roots, a sheet only the admin reads joins by name (`KIT_FILES`).
const ADMIN_ROOTS = [
  'app/[orgSlug]/admin/',
  'components/admin/',
  'app/[orgSlug]/scorekeeper/',
  'app/[orgSlug]/check-in/',
  'components/volunteer/',
];
const KIT_FILES = new Set([
  // Plan & billing's "See what … includes" panel — the admin's alone (Part B area 2, 2026-09-29).
  'components/billing/PlanArticlePanel.module.css',
]);
// The admin's old look, by stylesheet (2026-09-30, when Admin Design Continuity closed). Remove an entry the
// day its sheet comes clean — the gate fails until you do. A hand list on purpose, unlike the old-look
// ratchet's generated baseline: membership is the decision (no tool may add a sheet to it), and the values
// inside a listed sheet are already held, by value, by the restyled ratchet below.
const ADMIN_COLOUR_DEBT = new Set([
  'app/[orgSlug]/admin/accounting/budget-vs-actual/bva.module.css',
  'app/[orgSlug]/admin/accounting/budget/budget.module.css',
  'app/[orgSlug]/admin/admin-common.module.css',
  'app/[orgSlug]/admin/house-league/house-league.module.css',
  'app/[orgSlug]/admin/onboarding/onboarding.module.css',
  'app/[orgSlug]/admin/org/tournaments/tournaments-admin.module.css',
  'app/[orgSlug]/admin/public-site/public-site.module.css',
  'app/[orgSlug]/admin/tournaments/branding/branding.module.css',
  'app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css',
  'app/[orgSlug]/admin/tournaments/schedule/components/BracketBuilder.module.css',
  'app/[orgSlug]/admin/tournaments/schedule/components/ScheduleTimeline.module.css',
  'app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css',
  'app/[orgSlug]/admin/tournaments/settings/notifications/notifications.module.css',
  'app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css',
  'app/[orgSlug]/admin/tournaments/summary/summary.module.css',
  'app/[orgSlug]/scorekeeper/scorekeeper.module.css',
  'components/admin/NumberStepper.module.css',
  'components/admin/tournament/GuidanceRail.module.css',
  'components/admin/tournament/TournamentAdminUI.module.css',
  'components/admin/TournamentSetupWizard.module.css',
  'components/volunteer/DayOfShell.module.css',
]);
// A colour literal: hex, or rgb/rgba/hsl/hsla with no var() inside. The kit check also refuses the keywords.
const COLOR_LITERAL = String.raw`#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\((?![^()]*var\()[^()]*\)`;
const KIT_LITERAL = new RegExp(`${COLOR_LITERAL}|(?:^|\\s)(?:white|black)(?:\\s|$)`);
// A kit rule scopes itself under `[data-admin-kit]`. The legacy exclusion `:where(:not([data-admin-kit] *))`
// (slice 2) names it too, to say the opposite — so read the selector with its :not() clauses removed.
const isKitSelector = (selector) => selector.replace(/:not\([^()]*\)/g, '').includes('[data-admin-kit]');

function checkAdminKit() {
  // EVERY stylesheet under app/ and components/, whatever scope owns it: a kit rule is recognised by its
  // selector, not by where its sheet lives. The operator scope alone missed app/globals.css (the kit's
  // shared buttons, chips, windows and fields — slices 1, 2 and 4a) and the admin-only chat parts in
  // components/chat (slice 4b); each was a hand-added exception until the walk went repo-wide.
  const files = [...scopeFiles({ dirs: ['app', 'components'], files: [], excludeSegments: new Set() }), 'app/globals.css'];
  const offenders = [];
  let kitRules = 0;
  let strictSheets = 0;
  const cleanDebt = [...ADMIN_COLOUR_DEBT].filter(d => !files.includes(d));   // gone = off the list too
  for (const f of files) {
    const debt = ADMIN_COLOUR_DEBT.has(f);
    const wholeFile = KIT_FILES.has(f)
      || (ADMIN_ROOTS.some(r => f.startsWith(r)) && !debt && !SHARED_SURFACE.has(f));
    const raw = readFileSync(join(ROOT, f), 'utf8');
    if (!wholeFile && !debt && !raw.includes('[data-admin-kit]')) continue;
    if (wholeFile) strictSheets++;
    const rawLines = raw.split(/\r?\n/);
    const txt = blankComments(raw);
    let debtLeft = 0;   // a debt sheet's own literals: counted, not reported — they say whether it is clean
    for (const m of txt.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].trim();
      const strict = wholeFile || isKitSelector(selector);
      if (!strict && !debt) continue;
      if (strict) kitRules++;
      const bodyStart = m.index + m[0].indexOf('{') + 1;
      let offset = 0;
      for (const decl of m[2].split(';')) {
        const colon = decl.indexOf(':');
        const value = colon > -1 ? decl.slice(colon + 1).trim() : '';
        if (value && KIT_LITERAL.test(value)) {
          const line = txt.slice(0, bodyStart + offset + decl.indexOf(value)).split('\n').length;
          if (!exemptAt(rawLines, line - 1)) {
            if (strict) offenders.push({ f, line, selector: selector.split('\n').pop().trim(), value });
            else debtLeft++;
          }
        }
        offset += decl.length + 1;
      }
    }
    if (debt && !debtLeft) cleanDebt.push(f);
  }
  let ok = true;
  if (offenders.length) {
    ok = false;
    console.error(`✖ Admin (strict): ${offenders.length} literal colour(s) — the admin holds none.`);
    for (const o of offenders) console.error(`    ${o.f}:${o.line}  ${o.selector}  →  ${o.value}`);
    console.error('  Use a var(--token) the warm block and the dark gate both define (app/globals.css).');
    console.error('  A sheet still on the old look is on ADMIN_COLOUR_DEBT; nothing new joins that list.');
  }
  if (cleanDebt.length) {
    ok = false;
    console.error('✖ Admin (strict): these debt-list sheets hold no colour literal now (or are gone) — take them off');
    console.error('  ADMIN_COLOUR_DEBT in scripts/check-public-tokens.mjs, so they stay clean:');
    for (const f of cleanDebt) console.error(`    ${f}  (retired by ${ownerOf(f)})`);
  }
  if (!ok) return false;
  console.log(`✓ Admin (strict): ${strictSheets} admin sheet(s) whole and ${kitRules} kit rule(s) in all, no literal colour; `
    + `${ADMIN_COLOUR_DEBT.size} on the shrinking debt list.`);
  return true;
}

// ── restyled admin areas: EVERY literal colour ratchets (Admin Design Continuity, Phase 1) ─────
// The ratchets above ignore white/black alphas and one-off tints; checkAdminKit holds only the kit
// layer. An area the foundation has restyled keeps its LEGACY rules until the release slice deletes
// them — those literals are the switch-off look and must stay — but nothing NEW may add one: a new
// rule belongs in the kit layer (tokens), and a new inline colour on a token. So every colour literal
// in a restyled area's files (hex, rgb/rgba/hsl/hsla without var(), white/black alphas included) is
// held per file BY VALUE: a count alone would let one literal be swapped for a different new one.
// Areas join this list as their slice lands (the build prompt: "widen what it counts as each area
// comes clean"). Re-baseline after a deliberate drop: `node scripts/check-public-tokens.mjs --init-restyled`.
const RESTYLED_BASELINE = 'scripts/.admin-restyled-baseline.json';
const RESTYLED_DIRS = [
  // slice 1
  'app/[orgSlug]/admin/families',
  'app/[orgSlug]/admin/public-site',
  // slice 2
  'app/[orgSlug]/admin/house-league',
  'app/[orgSlug]/admin/onboarding',
  'app/[orgSlug]/admin/org/venues',
  'app/[orgSlug]/admin/org/tournaments',
  'app/[orgSlug]/admin/org/coaches-portal-links',
  'app/[orgSlug]/admin/org/settings/pdf',
  'app/[orgSlug]/admin/org/billing/mock-portal',
  // slice 3 (`components/accounting` is not listed: it is the coaches portal's too, already on the
  // portal's `--home-*` tokens, and was not restyled here)
  'app/[orgSlug]/admin/rep-teams',
  'app/[orgSlug]/admin/accounting',
  // slice 4a — the tournament screens' setup and records (4b/4c add operations and the schedule)
  'app/[orgSlug]/admin/tournaments/settings',
  'app/[orgSlug]/admin/tournaments/divisions',
  'app/[orgSlug]/admin/tournaments/venues',
  'app/[orgSlug]/admin/tournaments/rules',
  'app/[orgSlug]/admin/tournaments/branding',
  'app/[orgSlug]/admin/tournaments/archives',
  'app/[orgSlug]/admin/tournaments/summary',
  'app/[orgSlug]/admin/tournaments/data-tools',
  'components/admin/tournament',
  // slice 4b — the tournament screens on game day (the schedule's own folder joins with 4c)
  'app/[orgSlug]/admin/tournaments/dashboard',
  'app/[orgSlug]/admin/tournaments/registrations',
  'app/[orgSlug]/admin/tournaments/results',
  'app/[orgSlug]/admin/tournaments/check-in',
  'app/[orgSlug]/admin/tournaments/staff-kit',
  'app/[orgSlug]/admin/tournaments/communication',
  'app/[orgSlug]/admin/tournaments/chat',
  'components/admin/import',
  // slice 4c — the schedule: the page, timeline, brackets, generator, playoff wizard and its windows
  // (the game list and the sheet were already held by file, 4b)
  'app/[orgSlug]/admin/tournaments/schedule',
  // slice 5 — the volunteer shells (the scorekeeper, the gate, their shared furniture; ruling R3, fixed
  // warm) and the help guide (R4 — `components/help` is also the coaches portal's and the platform admin's;
  // its kit layer reaches only the admin, and every one of its legacy literals is held here all the same)
  'app/[orgSlug]/scorekeeper',
  'app/[orgSlug]/check-in',
  'components/volunteer',
  'components/help',
];
const RESTYLED_FILES = [
  'app/[orgSlug]/admin/org/page.tsx',
  'components/notifications/NotificationsPageContent.tsx',
  'components/admin/kit/kit-inline.ts',
  // slice 4a — the tournament screens' shared parts and the new-tournament wizard
  'app/[orgSlug]/admin/admin-common.module.css',
  'components/admin/ExportMenu.module.css',
  'components/admin/CollapsibleCard.module.css',
  'components/admin/TieBreakerEditor.tsx',
  'components/admin/TieBreakerEditor.module.css',
  'components/admin/TournamentSetupWizard.tsx',
  'components/admin/TournamentSetupWizard.module.css',
  'components/admin/TournamentStyleCards.tsx',
  'components/admin/TournamentStyleCards.module.css',
  // slice 4b — the game list (moved from 4c by the owner: it is Results' body), the check-in board
  // (shared with the volunteer gate; its kit layer reaches only the admin), the live feed, and the
  // chat's three admin-only parts. The schedule's sheet is held whole: 4b wrote the game list's kit
  // block into it, and 4c restyles the rest.
  'app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx',
  'app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css',
  'components/admin/CheckInBoard.tsx',
  'components/admin/CheckInBoard.module.css',
  'components/admin/LiveEventLog.tsx',
  'components/chat/ChatRoomsPanel.module.css',
  'components/chat/ChatManagePanel.module.css',
  'components/chat/NewRoomDialog.module.css',
  // slice 4c — the number stepper (only the schedule's windows use it) and the admin bottom sheet
  // (the timeline's and the check-in board's; also two public components, which its kit layer excludes)
  'components/admin/NumberStepper.tsx',
  'components/admin/NumberStepper.module.css',
  'components/admin/BottomSheet.tsx',
  'components/admin/BottomSheet.module.css',
  // slice 6 — Plan & billing for every plan but Club (the Club plan's page is Club Stage 1's kit screen) and its
  // "See what … includes" panel (reached only from that page), restyled on the owner's word; seeded from HEAD
  'app/[orgSlug]/admin/org/billing/page.tsx',
  'app/[orgSlug]/admin/org/billing/billing.module.css',
  'components/billing/PlanArticlePanel.tsx',
  'components/billing/PlanArticlePanel.module.css',
];
const ANY_LITERAL = new RegExp(COLOR_LITERAL, 'g');

function restyledFiles() {
  const cfg = { dirs: RESTYLED_DIRS, files: RESTYLED_FILES, excludeSegments: new Set() };
  return [...new Set(['.module.css', '.tsx', '.ts'].flatMap(ext => scopeFiles({ ...cfg, ext })))].sort();
}

/** One spelling per colour: lower case, no spaces, short hex written long (`#fff` = `#ffffff`). */
const literalKey = (lit) => lit.toLowerCase().replace(/\s+/g, '')
  .replace(/^#([0-9a-f]{3,4})$/, (_, h) => '#' + [...h].map(c => c + c).join(''));

/** Every colour literal in a file, as { value → how many }, keyed by `literalKey`. */
function literalCounts(file) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const rawLines = raw.split(/\r?\n/);
  const counts = {};
  blankComments(raw).split(/\r?\n/).forEach((line, idx) => {
    if (exemptAt(rawLines, idx)) return;
    for (const m of line.matchAll(ANY_LITERAL)) {
      const v = literalKey(m[0]);
      counts[v] = (counts[v] ?? 0) + 1;
    }
  });
  return counts;
}

function checkRestyledAreas() {
  const p = join(ROOT, RESTYLED_BASELINE);
  const baseline = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  const offenders = [];
  let total = 0;
  const files = restyledFiles();
  for (const f of files) {
    const counts = literalCounts(f);
    const held = baseline[f] ?? {};
    const fresh = Object.entries(counts).filter(([v, n]) => n > (held[v] ?? 0)).map(([v, n]) => `${v} ×${n - (held[v] ?? 0)}`);
    total += Object.values(counts).reduce((x, y) => x + y, 0);
    if (fresh.length) offenders.push({ f, fresh });
  }
  if (offenders.length) {
    console.error('✖ Restyled admin areas: a NEW colour literal in an area already on the kit.');
    for (const o of offenders) console.error(`    ${o.f}: ${o.fresh.join(', ')}`);
    console.error('  A new rule belongs in the kit layer on tokens; a new inline colour on a var(--token).');
    return false;
  }
  console.log(`✓ Restyled admin areas: ${files.length} file(s), ${total} legacy literal(s) held (none new).`);
  return true;
}

if (process.argv.includes('--init-restyled')) {
  const out = {};
  for (const f of restyledFiles()) { const c = literalCounts(f); if (Object.keys(c).length) out[f] = c; }
  writeFileSync(join(ROOT, RESTYLED_BASELINE), JSON.stringify(out, null, 2) + '\n');
  const total = Object.values(out).reduce((s, c) => s + Object.values(c).reduce((x, y) => x + y, 0), 0);
  console.log(`Baseline written: ${RESTYLED_BASELINE} — ${Object.keys(out).length} file(s), ${total} literal(s)`);
  process.exit(0);
}

if (mode === 'check') {
  const names = SCOPE === 'all' ? Object.keys(SCOPES) : [SCOPE];
  let ok = true;
  for (const n of names) ok = checkScope(n) && ok;
  if (SCOPE === 'all' || SCOPE === 'operator') ok = checkAdminKit() && ok;
  if (SCOPE === 'all' || SCOPE === 'operator') ok = checkRestyledAreas() && ok;
  if (SCOPE === 'all') ok = coverage() && ok;
  process.exit(ok ? 0 : 1);
}

if (mode === 'init') {
  const names = SCOPE === 'all' ? Object.keys(SCOPES) : [SCOPE];
  for (const n of names) {
    const cfg = SCOPES[n];
    const out = {};
    let total = 0;
    for (const f of scopeFiles(cfg)) {
      const { hex, rgba } = scan(f);
      if (hex.length || rgba.length) { out[f] = { hex: hex.length, rgba: rgba.length }; total += hex.length + rgba.length; }
    }
    writeFileSync(join(ROOT, cfg.baseline), JSON.stringify(out, null, 2) + '\n');
    console.log(`Baseline written (${n}): ${cfg.baseline} — ${Object.keys(out).length} file(s), ${total} literal(s)`);
  }
  process.exit(0);
}

// mode === 'report'
function report(name) {
  const cfg = SCOPES[name];
  const rows = [];
  for (const f of scopeFiles(cfg)) {
    const { hex, rgba } = scan(f);
    for (const h of hex) rows.push({ file: f, kind: 'hex', ...h });
    for (const r of rgba) rows.push({ file: f, kind: 'rgba', ...r });
  }
  const matchable = rows.filter(r => r.tokens);
  const custom = rows.filter(r => !r.tokens);
  const stale = rows.filter(r => r.tokens?.some(t => t.includes('STALE')));
  const byFile = {};
  for (const r of rows) byFile[r.file] = (byFile[r.file] || 0) + 1;

  let md = `# ${cfg.reportTitle} — Token-Debt Inventory\n\n`;
  md += `> Auto-generated: \`node scripts/check-public-tokens.mjs --scope=${name} --report\`. Read-only analysis.\n`;
  md += `> Hardcoded colors in ${name} \`${cfg.ext || '*.module.css'}\` files that should be \`var(--*)\` tokens.\n`;
  md += `> Brand \`rgba()\` is flagged; \`rgba(255,255,255,…)\`/\`rgba(0,0,0,…)\` alphas are not (they are the --white-NN/--black-NN family).\n\n`;
  md += `## Summary\n\n`;
  md += `- **${rows.length}** hardcoded colors across **${Object.keys(byFile).length}** files (${rows.filter(r => r.kind === 'hex').length} hex · ${rows.filter(r => r.kind === 'rgba').length} brand rgba)\n`;
  md += `- **${matchable.length - stale.length}** map exactly to a current token — dark-identical swaps, verify LIGHT mode\n`;
  md += `- **${stale.length}** are the STALE pre-refresh lime — swapping CHANGES THE HUE, eyeball first\n`;
  md += `- **${custom.length}** have no token match — promote to a token, or annotate \`/* token-exempt: why */\`\n\n`;
  if (Object.keys(byFile).length) {
    md += `## Worst offenders\n\n`;
    for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 20)) md += `- \`${f}\` — ${n}\n`;
  }
  md += `\n## Exact-token candidates\n\n| File:line | Literal | Candidate token(s) |\n|---|---|---|\n`;
  for (const r of matchable) md += `| \`${r.file}:${r.line}\` | \`${r.value}\` | ${r.tokens.map(t => `\`${t}\``).join(' / ')} |\n`;
  md += `\n## No token match — decide per-instance\n\n| File:line | Literal |\n|---|---|\n`;
  for (const r of custom) md += `| \`${r.file}:${r.line}\` | \`${r.value}\` |\n`;
  writeFileSync(join(ROOT, cfg.report), md);
  console.log(`Report (${name}): ${cfg.report} — ${rows.length} literals · ${matchable.length} matchable (${stale.length} stale-lime) · ${custom.length} custom`);
}

for (const n of (SCOPE === 'all' ? Object.keys(SCOPES) : [SCOPE])) report(n);
