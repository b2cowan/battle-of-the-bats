/**
 * Token-debt guardrail + inventory for CSS modules — TWO independent scopes.
 *
 *   --scope=public    (default)  public fan/org surfaces + shared public chrome
 *   --scope=operator             operator shells (admin / coaches / scorekeeper / platform-admin)
 *
 * Each scope has its OWN baseline file and its OWN report doc — they are NEVER conflated
 * (the public redesign and the operator cleanup are separate initiatives with separate debt).
 * Scans `*.module.css` under the scope's roots for literal hex colors that should be design
 * tokens (`var(--*)`), maps each to a candidate token from app/globals.css, and:
 *
 *   node scripts/check-public-tokens.mjs [--scope=…]            # RATCHET: fail if any file has
 *                                                               #   more literals than its baseline
 *   node scripts/check-public-tokens.mjs [--scope=…] --report   # write the inventory doc
 *   node scripts/check-public-tokens.mjs [--scope=…] --init      # snapshot/lower the baseline
 *
 * The ratchet lets the ~existing debt stay while making it impossible to ADD new literals.
 * As tranches get fixed, re-run --init to lock in the lower counts.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const ROOT = process.cwd();

// ── scope config ──────────────────────────────────────────────────────────────
// Each scope: the recursive dirs to walk, extra individual files outside those dirs,
// path segments to skip, plus its own baseline + report. Operator surfaces own their own
// styling (separate from the public redesign) — hence a separate scope, not an exclude flip.
const SCOPES = {
  public: {
    // Public tournament/org surfaces + public components. (app/teams — the pre-multi-tenant
    // public team profile — was deleted 2026-07-24 with the other orphaned top-level pages.)
    dirs: ['app/[orgSlug]', 'components/public'],
    // Individual public-chrome CSS modules that live OUTSIDE the dirs above (Unified Home
    // nav merge, Phase 5): the shared nav bars now theme public tournament pages, so guard
    // them against new literal hex too. warmTheme.module.css is intentionally NOT listed —
    // it DEFINES the --home-* tokens, so literal hex there is correct by construction.
    files: [
      'components/Navbar.module.css',
      'components/consumer/ConsumerShell.module.css',
    ],
    // Operator surfaces are covered by the operator scope — keep them out of the public count.
    excludeSegments: new Set(['admin', 'scorekeeper', 'coaches']),
    baseline: 'scripts/.public-token-baseline.json',
    report: 'docs/projects/active/PUBLIC_VISUAL_REDESIGN_TOKEN_DEBT.md',
    reportTitle: 'Public Visual Redesign',
  },
  operator: {
    // Operator shells: the org-scoped day-of/admin/coaches surfaces, the platform coach
    // journey, platform-admin, and their shared component libraries. The public scan never
    // visits these (it excludes admin/coaches/scorekeeper), so they need their own roots —
    // the exclude-set alone can never reach them.
    dirs: [
      'app/[orgSlug]/admin',
      'app/[orgSlug]/coaches',
      'app/[orgSlug]/scorekeeper',
      'app/coaches',
      'app/platform-admin',
      'components/admin',
      'components/coaches',
    ],
    files: [],
    excludeSegments: new Set(),
    baseline: 'scripts/.operator-token-baseline.json',
    report: 'docs/projects/active/OPERATOR_VISUAL_TOKEN_DEBT.md',
    reportTitle: 'Operator Visual Cleanup',
  },
};

const scopeArg = process.argv.find(a => a.startsWith('--scope='));
const SCOPE = scopeArg ? scopeArg.slice('--scope='.length) : 'public';
const cfg = SCOPES[SCOPE];
if (!cfg) {
  console.error(`Unknown --scope="${SCOPE}". Use --scope=public (default) or --scope=operator.`);
  process.exit(1);
}

const mode = process.argv.includes('--report') ? 'report'
  : process.argv.includes('--init') ? 'init'
  : 'check';

function norm(hex) {
  let h = hex.replace('#', '').toLowerCase();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return '#' + h.slice(0, 6).toUpperCase();
}

// ── token map: dark :root in globals.css → { '#RRGGBB': ['--tok', ...] } ────────
function buildTokenMap() {
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');
  const start = css.indexOf(':root');
  const open = css.indexOf('{', start);
  let depth = 0, end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) { end = i; break; }
  }
  const block = css.slice(open, end);
  const map = {};
  const re = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g;
  let m;
  while ((m = re.exec(block))) {
    const hex = norm(m[2]);
    (map[hex] ||= []).push(m[1]);
  }
  return map;
}

function moduleFiles() {
  const out = [];
  for (const d of cfg.dirs) {
    const abs = join(ROOT, d);
    if (!existsSync(abs)) continue;
    for (const rel of readdirSync(abs, { recursive: true })) {
      const p = String(rel).split(sep).join('/');
      if (!p.endsWith('.module.css')) continue;
      if (p.split('/').some(s => cfg.excludeSegments.has(s))) continue;
      out.push(`${d}/${p}`);
    }
  }
  for (const f of cfg.files) {
    if (existsSync(join(ROOT, f))) out.push(f);
  }
  return out.sort();
}

function scan(file) {
  // Blank out comment contents but KEEP newlines so reported line numbers stay accurate.
  const txt = readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '));
  const hits = [];
  txt.split(/\r?\n/).forEach((line, idx) => {
    const re = /#[0-9a-fA-F]{3,8}\b/g;
    let m;
    while ((m = re.exec(line))) hits.push({ line: idx + 1, hex: m[0] });
  });
  return hits;
}

const tokenMap = buildTokenMap();
const files = moduleFiles();
const perFile = files.map(f => ({ file: f, hits: scan(f) })).filter(x => x.hits.length);

// ── modes ───────────────────────────────────────────────────────────────────
if (mode === 'init') {
  const baseline = {};
  for (const { file, hits } of perFile) baseline[file] = hits.length;
  writeFileSync(join(ROOT, cfg.baseline), JSON.stringify(baseline, null, 2) + '\n');
  const total = perFile.reduce((s, x) => s + x.hits.length, 0);
  console.log(`Baseline written (${SCOPE}): ${cfg.baseline} (${Object.keys(baseline).length} files, ${total} literals)`);
  process.exit(0);
}

if (mode === 'check') {
  const baseline = existsSync(join(ROOT, cfg.baseline)) ? JSON.parse(readFileSync(join(ROOT, cfg.baseline), 'utf8')) : {};
  const offenders = [];
  for (const { file, hits } of perFile) {
    const allowed = baseline[file] ?? 0;
    if (hits.length > allowed) offenders.push({ file, count: hits.length, allowed });
  }
  if (offenders.length) {
    console.error(`✖ Token-debt ratchet (${SCOPE}): new literal hex color(s) in ${SCOPE} CSS modules.`);
    console.error('  Use design tokens (var(--*)) instead. Offending files:');
    for (const o of offenders) console.error(`    ${o.file}: ${o.count} literals (baseline ${o.allowed})`);
    console.error(`  If a literal is genuinely intentional, add the token or (last resort) re-baseline with --scope=${SCOPE} --init.`);
    process.exit(1);
  }
  console.log(`✓ Token-debt ratchet (${SCOPE}): no new literal hex in ${files.length} module(s).`);
  process.exit(0);
}

// mode === 'report'
const matchable = [];
const custom = [];
for (const { file, hits } of perFile) {
  for (const h of hits) {
    const toks = tokenMap[norm(h.hex)];
    (toks ? matchable : custom).push({ file, ...h, tokens: toks });
  }
}
const total = matchable.length + custom.length;
const byFile = [...perFile].sort((a, b) => b.hits.length - a.hits.length);

let md = `# ${cfg.reportTitle} — Token-Debt Inventory\n\n`;
md += `> Auto-generated: \`node scripts/check-public-tokens.mjs --scope=${SCOPE} --report\`. Read-only analysis.\n`;
md += `> Literal hex colors in ${SCOPE} \`*.module.css\` that should be \`var(--*)\` tokens.\n\n`;
md += `## Summary\n\n`;
md += `- **${total}** literal hex colors across **${perFile.length}** files\n`;
md += `- **${matchable.length}** map exactly to an existing token (safe swaps — dark-identical, fix light-mode drift)\n`;
md += `- **${custom.length}** have no token match (custom colors — leave, or promote to a new token case-by-case)\n\n`;
md += `## Worst offenders (fix these tranches first)\n\n`;
for (const { file, hits } of byFile.slice(0, 15)) md += `- \`${file}\` — ${hits.length}\n`;
md += `\n## Exact-token candidates (safe to swap, verify light mode)\n\n`;
md += `| File:line | Literal | Candidate token(s) |\n|---|---|---|\n`;
for (const r of matchable) md += `| \`${r.file}:${r.line}\` | \`${r.hex}\` | ${r.tokens.map(t => `\`${t}\``).join(' / ')} |\n`;
md += `\n## Custom colors (no token match — decide per-instance)\n\n`;
md += `| File:line | Literal |\n|---|---|\n`;
for (const r of custom) md += `| \`${r.file}:${r.line}\` | \`${r.hex}\` |\n`;
writeFileSync(join(ROOT, cfg.report), md);
console.log(`Report written (${SCOPE}): ${cfg.report}`);
console.log(`  ${total} literals · ${matchable.length} token-matchable · ${custom.length} custom · ${perFile.length} files`);
