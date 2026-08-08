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
      'components/rep-teams/TryoutFlowHeader.module.css',
      'components/rep-teams/TryoutCheckIn.module.css',
      'components/rep-teams/TryoutAcceptDrawer.module.css',
      'components/rep-teams/TryoutReportCard.module.css',
      'components/rep-teams/TryoutBaselineCard.module.css',
      'components/rep-teams/TryoutMemoryStrip.module.css',
      // The shared field scorer (Chunk E WI-1) — one surface behind the public token door AND
      // the coach's signed-in door; deliberately fixed-dark (token-exempt annotations inline).
      'components/rep-teams/TryoutScorerSurface.module.css',
      'components/notifications/notifications.module.css',
      'components/notifications/notifications-page.module.css',
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
      'components/notifications/PushPermissionPrompt.module.css',
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

// Block comments only — valid for CSS and TSX alike. JS line comments are deliberately left
// alone: a `//` inside a URL string ("https://…") would swallow the rest of the line and hide
// real literals. A hex sitting in a `//` comment is a harmless, baseline-grandfathered miss.
const blankComments = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '));

function scan(file) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const rawLines = raw.split(/\r?\n/);
  const lines = blankComments(raw).split(/\r?\n/);
  const hex = [], rgba = [];
  const exempted = (idx) => EXEMPT.test(rawLines[idx] || '') || EXEMPT.test(rawLines[idx - 1] || '');

  lines.forEach((line, idx) => {
    if (exempted(idx)) return;
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

if (mode === 'check') {
  const names = SCOPE === 'all' ? Object.keys(SCOPES) : [SCOPE];
  let ok = true;
  for (const n of names) ok = checkScope(n) && ok;
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
