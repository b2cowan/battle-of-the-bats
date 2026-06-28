/**
 * draft-release-notes.mjs — Phase 3 of the release-notes system.
 *
 * Generates a DRAFT customer-facing changelog entry from the conventional commits
 * being shipped in a release. This is the *deterministic* half of the draft-then-approve
 * flow: it collects + filters + groups commits and prints a ready-to-edit skeleton.
 * A human then rewrites the skeleton into plain language and appends the finished
 * entry to lib/release-notes.ts. NOTHING is published automatically — see
 * docs/projects/active/RELEASE_NOTES_CHANGELOG_PLAN.md (Phase 3).
 *
 * Range resolution (what "this release" means):
 *   1. --since <ref>          explicit start ref (exclusive)
 *   2. newest release/* tag   (the convention this script also suggests you create)
 *   3. fallback: last 30 commits, with a warning
 *
 * Usage:
 *   node scripts/draft-release-notes.mjs                 # auto range
 *   node scripts/draft-release-notes.mjs --since v1.2.0  # explicit start ref
 *   npm run draft:notes
 *
 * Read-only: runs `git log` / `git tag` only. Never commits, pushes, or tags.
 */

import { execSync } from 'child_process';

// ── Config: what counts as customer-facing ──────────────────────────────────
// Commit TYPES we surface (everything else — chore/docs/refactor/test/build/ci/style — is dropped).
// feat → New, fix → Fixed, perf → Improved (a draft suggestion; the human re-tags freely).
const TYPE_TO_CATEGORY = { feat: 'new', fix: 'fixed', perf: 'improved' };

// SCOPES that are operator/plumbing only — dropped even when the type is feat/fix,
// because they don't change anything a customer sees.
const INTERNAL_SCOPES = new Set([
  'platform-admin', 'db', 'dba', 'release', 'snapshot', 'snapshots',
  'ci', 'deps', 'tooling', 'agents', 'docs', 'test', 'tests',
]);

const CATEGORY_ORDER = ['new', 'improved', 'fixed'];
const CATEGORY_LABEL = { new: 'New', improved: 'Improved', fixed: 'Fixed' };

// ── Args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const sinceIdx = argv.indexOf('--since');
const explicitSince = sinceIdx !== -1 ? argv[sinceIdx + 1] : null;

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
}

function resolveRange() {
  if (explicitSince) return { since: explicitSince, source: `--since ${explicitSince}` };
  // newest release/* tag by creation date
  let tags = '';
  try {
    tags = git(`tag --list "release/*" --sort=-creatordate`);
  } catch {
    /* no tags */
  }
  const latestTag = tags.split('\n').filter(Boolean)[0];
  if (latestTag) return { since: latestTag, source: `last release tag (${latestTag})` };
  return { since: null, source: 'fallback: last 30 commits (no release/* tag found)' };
}

function getCommits(since) {
  // %H tab %s — hash + subject. Exclude merge commits (they restate, never describe a change).
  const range = since ? `${since}..HEAD` : `-n 30`;
  const raw = git(`log ${range} --no-merges --pretty=format:%H%x09%s`);
  if (!raw) return [];
  return raw.split('\n').map(line => {
    const tab = line.indexOf('\t');
    return { hash: line.slice(0, tab), subject: line.slice(tab + 1) };
  });
}

// Parse "type(scope)!: description"
const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

function classify(commit) {
  const m = commit.subject.match(CONVENTIONAL);
  if (!m) return { ...commit, kept: false, reason: 'not a conventional commit' };
  const [, type, scope, breaking, desc] = m;
  const category = TYPE_TO_CATEGORY[type];
  if (!category) return { ...commit, kept: false, reason: `type "${type}" not customer-facing` };
  if (scope && INTERNAL_SCOPES.has(scope.toLowerCase()))
    return { ...commit, kept: false, reason: `scope "${scope}" is internal-only` };
  return { ...commit, kept: true, type, scope, breaking: !!breaking, desc, category };
}

function todayISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── Run ──────────────────────────────────────────────────────────────────────
const { since, source } = resolveRange();
const commits = getCommits(since);
const classified = commits.map(classify);
const kept = classified.filter(c => c.kept);
const dropped = classified.filter(c => !c.kept);

const date = todayISO();
const tag = `release/${date}`;

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  DRAFT RELEASE NOTES  (review + rewrite before publishing)');
console.log('══════════════════════════════════════════════════════════════');
console.log(`Range:    ${source}`);
console.log(`Commits:  ${commits.length} total · ${kept.length} customer-facing · ${dropped.length} dropped`);
console.log(`Date:     ${date}`);

if (!since) {
  console.log('\n⚠  No release/* tag found — used the last 30 commits as a rough range.');
  console.log('   After this release, tag it so the next run is exact:');
  console.log(`     git tag ${tag} && git push origin ${tag}`);
}

if (kept.length === 0) {
  console.log('\n✋ No customer-facing changes in this range.');
  console.log('   RECOMMENDED: publish NO entry for this release (internal-only).');
  console.log('   (Dropped commits listed below for reference.)\n');
} else {
  // Grouped, human-readable draft
  console.log('\n── Suggested grouping (edit freely) ──────────────────────────');
  for (const cat of CATEGORY_ORDER) {
    const items = kept.filter(c => c.category === cat);
    if (!items.length) continue;
    console.log(`\n${CATEGORY_LABEL[cat]}:`);
    for (const c of items) {
      const scopeTag = c.scope ? `[${c.scope}] ` : '';
      const bang = c.breaking ? '⚠ BREAKING — ' : '';
      console.log(`  • ${bang}${scopeTag}${c.desc}   (${c.hash.slice(0, 7)})`);
    }
  }

  // Ready-to-paste TS entry skeleton for lib/release-notes.ts (top of RELEASE_ENTRIES)
  console.log('\n── Paste-ready skeleton for lib/release-notes.ts ─────────────');
  console.log('   ⚠ REWRITE every `text` in plain customer language before publishing.');
  console.log('   ⚠ Set a real `title`. Drop anything internal that slipped through.\n');
  const lines = [];
  lines.push('  {');
  lines.push(`    date: '${date}',`);
  lines.push(`    title: 'TODO — short release title',`);
  lines.push('    highlights: [');
  for (const cat of CATEGORY_ORDER) {
    const items = kept.filter(c => c.category === cat);
    if (!items.length) continue;
    lines.push(`      // ${CATEGORY_LABEL[cat]}`);
    for (const c of items) {
      const text = c.desc.replace(/'/g, "\\'");
      lines.push(`      { category: '${cat}', text: '${text}' },`);
    }
  }
  lines.push('    ],');
  lines.push('  },');
  console.log(lines.join('\n'));

  console.log('\n── After publishing, tag the release ─────────────────────────');
  console.log(`     git tag ${tag} && git push origin ${tag}`);
}

if (dropped.length) {
  console.log('\n── Dropped (NOT in the draft — pull one back if it is customer-facing) ──');
  for (const c of dropped) {
    console.log(`  – ${c.subject}   (${c.hash.slice(0, 7)}) — ${c.reason}`);
  }
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  Nothing was published. Edit lib/release-notes.ts by hand,');
console.log('  commit it WITH the release, then push + tag.');
console.log('══════════════════════════════════════════════════════════════\n');
