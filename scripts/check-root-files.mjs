#!/usr/bin/env node
/**
 * check-root-files.mjs — nothing lands at the top of the repo without a decision.
 *
 * ⚠ WHY. Cleanup tranche 6 (2026-09-01) swept five junk files off the repo root: two empty files
 * named `0` and `=` (a shell redirect that went somewhere unintended), a 178KB `scratch_diff.txt`,
 * and two files whose NAMES were mangled Windows temp paths — a past session had written a scratch
 * diff to a path with the `:` stripped, creating
 * `C:Usersb2cowAppDataLocalTemp…scratchpaddiff.txt` as a literal filename. The oldest had been
 * sitting there for nine days. Every one of them showed up in `git status` on every run, for every
 * session, and every session's eye slid straight past it.
 *
 * That is the whole failure mode: junk at the root is *permanently visible and therefore
 * permanently invisible*. It costs nothing except that `git status` stops being trustworthy at a
 * glance — which matters a great deal in a repo where several sessions share one working copy and
 * `git status` is how each one works out what is theirs.
 *
 * ── What is checked, and what is deliberately not ─────────────────────────────
 * Only entries at the repo ROOT, and only ones git does NOT ignore. Everything gitignored is an
 * expected local artefact (`.next/`, `node_modules/`, the dev-server logs, `*.tsbuildinfo`) and is
 * none of this gate's business — that is `.gitignore`'s job, it already does it, and duplicating
 * the list here would just create a second thing to keep in sync. Note the five junk files were
 * all NON-ignored, which is exactly why they were visible in `git status` in the first place.
 *
 * ⚠ IT JUDGES THE LIVE WORKING TREE, NOT YOUR DIFF — and in this repo several sessions share one
 * working copy, so it CAN go red because of somebody else's stray file. That is deliberate and it
 * matches the rest of `verify:changed`, which is whole-tree throughout (the colour-token ratchet,
 * module purity, spelling, date-correctness and the unit suite all read the tree, not the index).
 * The staged-scoped discipline belongs to `.githooks/pre-commit`, and this check is correctly NOT
 * wired in there: a whole-tree gate on commit would block one session over another's scratch file.
 * If this fires on a file you did not create, the fix is still to clear it — a stray file at the
 * root is nobody's and everybody's, which is precisely how the last five survived nine days.
 *
 * ── The escape hatch is editing this file ─────────────────────────────────────
 * A genuinely new root file (a new config, a new top-level doc) is a real decision, and the cost of
 * recording it is one line here. That is the point: the gate does not stop you adding a root file,
 * it stops you adding one BY ACCIDENT.
 *
 *   node scripts/check-root-files.mjs           check (exit 1 on anything unlisted)
 *   node scripts/check-root-files.mjs --list    print what is there now and how it classifies
 */
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');

/** Directories that belong at the root. */
const DIRS = new Set([
  '.claude', '.git', '.githooks',
  'app', 'components', 'docs', 'lib', 'memory', 'public', 'scripts', 'supabase', 'tests',
  /* ⚠ Per-editor folders. Nobody's tooling choice should turn this gate red on their first run —
     the gate is here to catch stray SCRATCH files, not to have an opinion about editors. Listed
     rather than gitignored because that is a repo-wide decision this gate has no business taking. */
  '.vscode', '.idea',
]);

/**
 * Files that belong at the root. Grouped so an addition lands somewhere meaningful rather than at
 * the bottom of one long list.
 */
const FILES = new Set([
  // Agent + contributor instructions (loaded automatically by the assistants).
  'AGENTS.md', 'AGENCY_RULES.md', 'AGENT_PLAYBOOK.md', 'CLAUDE.md', 'README.md',
  // Living trackers that have deliberately stayed at the root.
  'TODO.md', 'RELEASE_CONFIG.md', 'UAT_FINDINGS.md', 'UAT_SETUP.md',
  // Toolchain + framework config.
  '.gitattributes', '.gitignore', '.npmrc',
  'amplify.yml', 'eslint.config.mjs', 'instrumentation.ts', 'next-env.d.ts', 'next.config.ts',
  'playwright.config.ts', 'postcss.config.js', 'proxy.ts', 'tailwind.config.ts', 'tsconfig.json',
  // Dead-code REPORT config (report-only; knip is fetched by npx, never installed). See its header.
  'knip.jsonc',
  // Package management. ⚠ pnpm-lock.yaml is the one `check-lockfile-sync.mjs` reads;
  // package-lock.json is a tracked leftover from before the pnpm move.
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package-lock.json',
  // Environment. Both are gitignored in practice; listed so a rename is still a decision.
  '.env.local', '.env.production.local',
]);

/**
 * One `git check-ignore` call for everything, rather than one per entry.
 *
 * ⚠ `-c core.quotepath=false` IS LOAD-BEARING, and it is not cosmetic. Git defaults `core.quotepath`
 * to true, which C-quotes any path containing a non-ASCII byte on the way OUT — `café.txt` comes
 * back as the literal 14-character string `"caf\303\251.txt"`. `readdirSync` returns the real
 * UTF-8 name, so the two never match, the entry is judged NOT ignored, and a properly-gitignored
 * file fails this gate for a reason its owner cannot see. Turning quoting off makes the round trip
 * lossless. (Embedded newlines would defeat the line split too, but Windows forbids them in
 * filenames outright, and a Set membership test degrades to a false alarm on that one file rather
 * than mis-labelling a different one.)
 */
function ignoredSet(names) {
  if (!names.length) return new Set();
  try {
    const out = execFileSync('git', ['-c', 'core.quotepath=false', 'check-ignore', '--stdin'], {
      cwd: ROOT, input: names.join('\n'), encoding: 'utf8',
    });
    return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean));
  } catch (e) {
    // git exits 1 when NOTHING matched — that is a valid answer, not a failure.
    const out = (e.stdout ?? '').toString();
    if (e.status === 1) return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean));
    console.error(`✗ check-root-files: could not ask git what is ignored — ${e.message}`);
    process.exit(1);
  }
}

const entries = readdirSync(ROOT, { withFileTypes: true });
const ignored = ignoredSet(entries.map((e) => e.name));

const unexpected = [];
const rows = [];

for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  const name = entry.name;
  const isDir = entry.isDirectory();
  if (ignored.has(name)) { rows.push([name, isDir ? 'dir' : 'file', 'gitignored — not checked']); continue; }
  const known = isDir ? DIRS.has(name) : FILES.has(name);
  rows.push([name, isDir ? 'dir' : 'file', known ? 'allowed' : 'UNLISTED']);
  if (!known) unexpected.push({ name, isDir });
}

if (LIST) {
  const w = Math.max(...rows.map((r) => r[0].length));
  for (const [name, kind, verdict] of rows) {
    console.log(`  ${name.padEnd(w)}  ${kind.padEnd(4)}  ${verdict}`);
  }
  process.exit(0);
}

if (!unexpected.length) {
  console.log(`✓ Repo root clean — every non-ignored entry is accounted for.`);
  process.exit(0);
}

console.error(`\n✗ ${unexpected.length} unexpected entr(ies) at the repo root:\n`);
for (const { name, isDir } of unexpected) {
  console.error(`    ${name}${isDir ? '/' : ''}`);
}
console.error(`
  If it is junk (a stray redirect, a scratch file, a mangled temp path) — delete it.
  If it is scratch you still want — move it to the session scratchpad, not the repo.
  If it genuinely belongs here — add it to FILES/DIRS in scripts/check-root-files.mjs,
  which is the decision this gate exists to make you take on purpose.
`);
process.exit(1);
