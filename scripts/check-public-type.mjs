#!/usr/bin/env node
/**
 * check-public-type.mjs — THE PUBLIC FACE'S TYPEWRITER LETTERING MAY ONLY SHRINK (The public face, warm: S1,
 * owner Ask 10 A, 2026-10-23).
 *
 * The marketing site, the system screens and about fifty emails set whole sentences, buttons, headings and
 * navigation links in the typewriter face, many of them in capitals. A newcomer reads that as a terminal. The
 * first look's screens proved the cure: the typewriter face for a plan chip and real data, nothing else. The rule is P1
 * (and P3, P2) in `docs/agents/brand/VISUAL_IDENTITY.md`; the walk and the rulings are in
 * `docs/projects/active/PUBLIC_FACE_WARM_PLAN.md`.
 *
 * Counted per file, in CODE only (comments blanked first), three signals:
 *
 *   face    the typewriter face — `font-family`/`font:`/`fontFamily` naming `--font-data`, `--font-mono`,
 *           monospace, Courier or Plex Mono, in a stylesheet, an inline style, or an email's template string
 *   caps    forced capitals — `text-transform: uppercase` / `textTransform: 'uppercase'`
 *   heavy   an 800 or 900 weight — `font-weight`/`font:`/`fontWeight`
 *
 * Not counted: TRACKING. Nothing in P1–P10 limits letter-spacing by itself (the eyebrow is spaced on purpose),
 * and the lettering it travels with is already counted: spaced capitals are `caps`, spaced typewriter is
 * `face`. Counting it too would only make a plan chip carry a second marker for the same fact.
 *
 * ⚖ AN ALLOWED PLACE SAYS WHICH ONE IT IS. A line that holds an allowed role carries a `type-ok: <role>`
 * comment on that line or the one above (`/* type-ok: eyebrow *\/`, `// type-ok: plan chip`), and a marker
 * exempts only the signals its role may carry. A marker covers the line it is on; one standing ALONE on its own
 * line also covers the next line (that is how an email template string, which cannot hold a comment, is marked).
 * A marker trailing a declaration covers that declaration only, so each declaration in a rule takes its own.
 * A declaration split across lines is read as one and belongs to the line it starts on. The roles, and the rule each comes from:
 *
 *   plan chip  face, caps   P1  the one typewriter label on the public face
 *   eyebrow    caps         P3  the Inter 600 eyebrow line (capitals, never the typewriter face)
 *   data       face         P1  a figure or code a person reads as data, such as a price code
 *
 * `heavy` has no role: the headline is 700. A marker that names none of these is an error — including `wordmark`, a
 * role retired in S4 Part B (2026-10-23) when the name became the Inter lockup (P9).
 * Anything else is the old lettering, and the fix is Inter in sentence case (the headline face is Barlow
 * Condensed 700, sentence case).
 *
 * The ratchet, as `check-admin-type.mjs`'s:
 *   • per file, each count may only go DOWN from its baseline (`scripts/.public-type-baseline.json`);
 *   • a count that went down must be LOCKED IN in the same change: `node scripts/check-public-type.mjs --init`.
 *     Each stage that restyles a surface (S3a emails, S4 marketing, S5 system screens) locks in its own drop;
 *   • a file NOT in the baseline may hold none of it unmarked — new lettering declares its role or is Inter;
 *   • `--init` can only LOWER the baseline: it refuses to raise a count or admit a file. Raising one means
 *     editing the baseline by hand, where a reviewer sees it.
 *
 * Scope — the public surfaces The public face, warm owns (found in the code, not from a plan):
 *   marketing         the home page, /pricing, the four /for-* pages and their walkthroughs, /changelog, /demos,
 *                     /see-it-live, /pitch, the bar, the footer, the plan cards, components/marketing
 *   signed-out shell  the consumer bar, /start, /auth/*, components/auth, the shared name lockup
 *   system screens    the 404, the crash and fatal-crash screens, the offline page, /unsubscribe, the paused screen
 *   emails            lib/ files that build one: the listed builders plus any lib/*.ts named like one
 *                     (email, notify, announcement, reminder, mail), so a new builder starts at none
 * The lettering a CLASS NAME carries is counted too (S4, 2026-10-23): in a .tsx file every string literal is read as
 * a class list, and the Tailwind utilities `font-mono` (face), `uppercase` (caps) and `font-black`/`font-extrabold`
 * (heavy), and the global classes `app/globals.css` gives the face to — `hud-label`, `btn-data`, `badge`,
 * `form-label` — count like the declarations above (S1 could not see them, about 65 uses on the marketing set).
 * ⚠ Still out of sight: `.public-page-header .eyebrow` (the face comes from the PARENT's class, on the public
 * tournament pages, which are not in this scope), and a class composed in from another stylesheet.
 * Out of scope: the org-branded tournament and club pages (their type is their own project, and scores and
 * records keep the typewriter face under R1-4), the admin (`check-admin-type.mjs`), the coaches portal, and
 * `app/globals.css` (every surface's sheet). The OG/share-card renderers (lib/share-card.ts and kin) are
 * images, not pages; S5 owns them.
 *
 * Modes:  node scripts/check-public-type.mjs            check (verify:changed)
 *         node scripts/check-public-type.mjs --init     lock in the drops (lower only)
 *         node scripts/check-public-type.mjs --report   what is left, by surface and file, largest first
 *         node scripts/check-public-type.mjs --help
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { KINDS, ROLES, countsOfSource, compareToBaseline } from './lib/public-type.mjs';

const ROLE_LIST = Object.keys(ROLES).join(', ');

const ROOT = process.cwd();
const BASELINE = 'scripts/.public-type-baseline.json';

// Directories scanned whole. A trailing `*` is a prefix glob, so a new /for-* page is covered the day it lands.
const DIRS = [
  'app/for-*',
  'app/pricing',
  'app/changelog',
  'app/demos',
  'app/pitch',
  'app/see-it-live',
  'app/unsubscribe',
  'app/(consumer)/auth',
  'app/(consumer)/start',
  'components/auth',
  'components/marketing',
];
// Single shared files the public face wears.
const FILES = [
  'app/page.tsx',
  'app/page.module.css',
  'app/not-found.tsx',
  'app/error.tsx',
  'app/global-error.tsx',
  'app/system-screens.module.css',
  'components/shared/SystemScreen.tsx',
  'components/shared/SystemScreen.module.css',
  'public/offline.html',
  'components/Navbar.tsx',
  'components/Navbar.module.css',
  'components/Footer.tsx',
  'components/Footer.module.css',
  'components/PricingSection.tsx',
  'components/PricingSection.module.css',
  'components/consumer/ConsumerNav.tsx',
  'components/consumer/ConsumerShell.module.css',
  'components/consumer/StartMenu.tsx',
  'components/consumer/CoachJourneyChrome.tsx',
  'components/shared/BrandLockup.tsx',
  'components/shared/BrandLockup.module.css',
  // Stylesheets the files above import, found by following their imports (review 2026-10-23). Where one is
  // shared with the admin it is also in `check-admin-type.mjs`'s baseline: the two checks count it separately.
  'components/EarlyAccessModalTrigger.module.css', // the /for-* pages and /start/club
  'components/EarlyAccessForm.module.css',
  'components/shared/AccountMenu.module.css',      // the marketing bar's account menu
  'components/shared/GetAppQr.module.css',         // the footer
  'components/shared/FlipPill.module.css',         // the consumer bar
  'components/shared/WorkspacesPill.module.css',   // the consumer bar
];
// Every email builder. The list is the ones the plan names; the name pattern below adds any future one.
const EMAIL_FILES = [
  'lib/email.ts',
  'lib/email-envelope-warm.ts',
  'lib/email-markup.ts',
  'lib/notify.ts',
  'lib/family-email.ts',
  'lib/dues-reminder-email.ts',
  'lib/practice-plan-email.ts',
  'lib/basic-coach-announcements.ts',
  'lib/club-schedule-send.ts',
  'lib/feedback-email.ts',
  'lib/platform-email-templates.ts',
  'lib/marketing-email-defaults.ts',
];
const EMAIL_NAME = /(email|notify|announcement|reminder|mail)/;

const argv = process.argv.slice(2);
const KNOWN = new Set(['--init', '--report', '--help', '-h']);
const unknown = argv.filter((a) => !KNOWN.has(a));
if (unknown.length) { console.error(`✖ Unknown option: ${unknown.join(' ')} (see --help)`); process.exit(2); }
if (argv.includes('--help') || argv.includes('-h')) {
  const doc = readFileSync(new URL(import.meta.url), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1];
  console.log(doc.split('\n').map((l) => l.replace(/^ \* ?/, '')).join('\n').trim());
  process.exit(0);
}

const isSource = (f) => /\.(tsx?|css|html)$/.test(f) && !f.includes('/node_modules/') && !/\.test\.tsx?$/.test(f);

function walk(dir, out) {
  for (const rel of readdirSync(join(ROOT, dir), { recursive: true })) {
    const f = `${dir}/${String(rel).split(sep).join('/')}`;
    if (isSource(f) && statSync(join(ROOT, f)).isFile()) out.push(f);
  }
}

function listFiles() {
  const out = [];
  for (const d of DIRS) {
    if (d.endsWith('*')) {
      const parent = d.slice(0, d.lastIndexOf('/'));
      const prefix = d.slice(d.lastIndexOf('/') + 1, -1);
      if (!existsSync(join(ROOT, parent))) continue;
      for (const e of readdirSync(join(ROOT, parent), { withFileTypes: true })) {
        if (e.isDirectory() && e.name.startsWith(prefix)) walk(`${parent}/${e.name}`, out);
      }
    } else if (existsSync(join(ROOT, d))) walk(d, out);
  }
  for (const f of FILES) if (existsSync(join(ROOT, f))) out.push(f);
  for (const f of EMAIL_FILES) if (existsSync(join(ROOT, f))) out.push(f);
  for (const e of readdirSync(join(ROOT, 'lib'), { withFileTypes: true })) {
    if (e.isFile() && EMAIL_NAME.test(e.name) && isSource(`lib/${e.name}`)) out.push(`lib/${e.name}`);
  }
  return [...new Set(out)].sort();
}

/** The four public surfaces, in report order, and the stage that restyles each. */
const SURFACES = {
  marketing: 'S4',
  emails: 'S3a (S3b for family emails)',
  'system screens': 'S5',
  'signed-out shell and sign-up': 'already warm (the first look); what is left is leftovers',
};

function surfaceOf(f) {
  if (f.startsWith('lib/')) return 'emails';
  if (/^app\/(not-found|error|global-error|system-screens|unsubscribe)/.test(f) || f === 'public/offline.html'
    || f.startsWith('app/(consumer)/auth/suspended')) return 'system screens';
  if (f.startsWith('app/(consumer)/') || f.startsWith('components/auth/') || f.startsWith('components/consumer/')
    || f.startsWith('components/shared/')) return 'signed-out shell and sign-up';
  return 'marketing';
}

const now = {};
const where = {};
const bad = [];
for (const f of listFiles()) {
  const { c, lines, badRoles } = countsOfSource(f, readFileSync(join(ROOT, f), 'utf8'));
  if (Object.keys(c).length) { now[f] = c; where[f] = lines; }
  for (const n of badRoles) bad.push(`${f}:${n}`);
}
const base = existsSync(join(ROOT, BASELINE)) ? JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8')) : null;
const fmt = (c) => KINDS.filter((k) => c?.[k]).map((k) => `${k} ${c[k]}`).join(' · ');
const sum = (c) => KINDS.reduce((a, k) => a + (c?.[k] ?? 0), 0);
const delta = (r) => r.over.map((k) => `${k} ${r.b?.[k] ?? 0} → ${r.c[k]}`).join(', ');
function totals(map) {
  const t = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const c of Object.values(map)) for (const k of KINDS) t[k] += c[k] ?? 0;
  return `${Object.keys(map).length} files · ${fmt(t)}`;
}

if (argv.includes('--report')) {
  const bySurface = {};
  for (const [f, c] of Object.entries(now)) (bySurface[surfaceOf(f)] ??= []).push([f, c]);
  for (const [name, stage] of Object.entries(SURFACES)) {
    const rows = (bySurface[name] ?? []).sort((a, b) => sum(b[1]) - sum(a[1]));
    console.log(`\n${name.toUpperCase()}  —  ${totals(Object.fromEntries(rows))}  (${stage})`);
    for (const [f, c] of rows) {
      console.log(`  ${f}  —  ${fmt(c)}  (lines ${where[f].slice(0, 12).join(', ')}${where[f].length > 12 ? ', …' : ''})`);
    }
  }
  console.log(`\nThe public face's typewriter lettering, unmarked: ${totals(now)}`);
  if (bad.length) console.log(`\n✖ A \`type-ok:\` that names no allowed role: ${bad.join(', ')}`);
  process.exit(0);
}

const { rises, drops } = compareToBaseline(now, base);

if (argv.includes('--init')) {
  if (bad.length) {
    console.error(`✖ A \`type-ok:\` that names no allowed role (${ROLE_LIST}): ${bad.join(', ')}`);
    process.exit(1);
  }
  if (base && rises.length) {
    console.error('✖ --init only lowers the baseline; these would RAISE it (or admit a file):');
    for (const r of rises) console.error(`    ${r.f}: ${delta(r)}`);
    console.error('  Use Inter in sentence case, or mark an allowed role with `type-ok: <role>`. Raising a count');
    console.error('  means editing the baseline by hand, where review sees it.');
    process.exit(1);
  }
  writeFileSync(join(ROOT, BASELINE), JSON.stringify(now, null, 2) + '\n'); // `now` is already in sorted file order
  console.log(`Baseline written: ${BASELINE} — ${totals(now)}`);
  process.exit(0);
}

if (!base) { console.error(`✖ No baseline at ${BASELINE}. Create it once with --init.`); process.exit(1); }

let ok = true;
if (bad.length) {
  ok = false;
  console.error(`✖ Public lettering: a \`type-ok:\` marker must name an allowed role — ${ROLE_LIST}.`);
  console.error(`    ${bad.join('\n    ')}`);
}
if (rises.length) {
  ok = false;
  console.error("✖ Public lettering: the typewriter look may only shrink on the public face, and this change adds to it.");
  for (const r of rises) {
    const what = r.b ? `above its baseline (${delta(r)})` : `old lettering in a file that had none (${fmt(r.c)})`;
    console.error(`    ${r.f}: ${what}\n        lines ${where[r.f].join(', ')}`);
  }
  console.error('  The public face sets every sentence, label, button, heading and link in Inter, sentence case (P1–P4,');
  console.error('  docs/agents/brand/VISUAL_IDENTITY.md). A plan chip, an eyebrow and a figure read as data are');
  console.error('  allowed: say so with `type-ok: <role>` on the line or the one above.');
}
if (drops.length) {
  ok = false;
  console.error('✖ Public lettering: these went DOWN — lock it in, in the same change, so it cannot creep back:');
  for (const d of drops) console.error(`    ${d.f}: ${fmt(d.b) || '—'} → ${fmt(d.c) || 'none (leaves the baseline)'}`);
  console.error("  node scripts/check-public-type.mjs --init   (if the drop is another session's uncommitted work, it is theirs to lock in)");
}
if (!ok) process.exit(1);
console.log(`✓ Public lettering: ${totals(now)} unmarked, held, none new.`);
