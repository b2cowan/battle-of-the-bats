#!/usr/bin/env node
/**
 * check-lockfile-sync.mjs — catch a dependency change that only the Amplify build rejects.
 *
 * ⚠ WHY THIS EXISTS, and it is not hypothetical. `amplify.yml` installs with pnpm, and pnpm turns
 * on `--frozen-lockfile` by default in CI. So the deploy refuses to install at all unless every
 * specifier in `package.json` is already recorded in `pnpm-lock.yaml`. Adding a package and
 * committing the manifest WITHOUT the regenerated lockfile is therefore a guaranteed red build —
 * and it is completely invisible at the keyboard, because the machine that added the package
 * already has it in `node_modules`. Nothing local reads the lockfile: not `tsc`, not `eslint`, not
 * `npm test`, not `verify:changed`. The first thing that notices is a cloud build, ninety seconds
 * in, minutes after a push.
 *
 * That is exactly what happened on 2026-08-27: `pdfjs-dist` — the renderer behind the PDF document
 * gate — was added to devDependencies on 08-26 in `6a1def21` and the lockfile was never staged with
 * it. Dev job 267 died in 96 seconds with ERR_PNPM_OUTDATED_LOCKFILE, before compiling a line. The
 * fix took one command; finding it took a round trip through CloudWatch.
 *
 * This reproduces pnpm's own frozen-lockfile verdict offline in milliseconds: it compares the
 * specifier sets, per section, for the root importer. No network, no install, no node_modules.
 * It deliberately does NOT check resolved versions — that is pnpm's job and depends on the
 * registry; a stale `version:` line still installs, a missing `specifier:` line does not.
 *
 * The fix when it fires is always the same:  pnpm install --lockfile-only  → stage the lockfile.
 *
 * Usage: node scripts/check-lockfile-sync.mjs            (working tree; exit 1 on drift)
 *        node scripts/check-lockfile-sync.mjs --staged   (the INDEX — what the commit will contain)
 *        node scripts/check-lockfile-sync.mjs --json
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const STAGED = process.argv.includes('--staged');
const JSON_OUT = process.argv.includes('--json');

const MANIFEST = 'package.json';
const LOCKFILE = 'pnpm-lock.yaml';

/** The manifest sections pnpm mirrors into the lockfile's importers block. */
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];

/** Read a file from the index when --staged, otherwise from disk. Returns null if absent. */
function readSource(file) {
  if (!STAGED) return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  try {
    return execFileSync('git', ['show', ':' + file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null; // not in the index — e.g. this commit does not touch it
  }
}

/** Strip one layer of matching quotes off a YAML scalar or key. */
function unquote(value) {
  const trimmed = value.trim();
  const first = trimmed[0];
  if (trimmed.length >= 2 && (first === "'" || first === '"') && trimmed[trimmed.length - 1] === first) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Pull the root importer's specifiers out of pnpm-lock.yaml.
 *
 * The shape is rigidly indented, which is why a narrow line scan is safe here and worth avoiding a
 * YAML dependency for (a guard against dependency drift should not add a dependency):
 *
 *   importers:
 *     .:                      <- 2 spaces, importer path
 *       dependencies:         <- 4 spaces, section
 *         clsx:               <- 6 spaces, package name (quoted when scoped)
 *           specifier: ^2.1.1 <- 8 spaces
 *           version: 2.1.1
 *
 * Returns { section: Map<name, specifier> }, or null if the importers block is missing entirely.
 */
function parseRootImporter(lockText) {
  const lines = lockText.split(/\r?\n/);
  const out = {};
  for (const section of SECTIONS) out[section] = new Map();

  let inImporters = false;
  let inRoot = false;
  let section = null;
  let pkg = null;
  let sawImporters = false;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    // A top-level key ends the importers block (`packages:`, `snapshots:`, …).
    if (/^\S/.test(line)) {
      if (line.startsWith('importers:')) {
        inImporters = true;
        sawImporters = true;
      } else if (inImporters) {
        break;
      }
      continue;
    }
    if (!inImporters) continue;

    const indent = line.length - line.trimStart().length;

    if (indent === 2) {
      // An importer path. Only the root (`.`) corresponds to this package.json.
      inRoot = unquote(line.trim().replace(/:$/, '')) === '.';
      section = null;
      pkg = null;
      continue;
    }
    if (!inRoot) continue;

    if (indent === 4) {
      const name = line.trim().replace(/:$/, '');
      section = SECTIONS.includes(name) ? name : null;
      pkg = null;
      continue;
    }
    if (!section) continue;

    if (indent === 6) {
      pkg = unquote(line.trim().replace(/:$/, ''));
      continue;
    }
    if (indent === 8 && pkg) {
      const match = line.trim().match(/^specifier:\s*(.+)$/);
      if (match) out[section].set(pkg, unquote(match[1]));
    }
  }

  return sawImporters ? out : null;
}

function done(problems) {
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: true, problems }, null, 2));
  } else {
    console.log('✓ lockfile sync — package.json and pnpm-lock.yaml agree');
  }
  process.exit(0);
}

function fail(problems) {
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: false, problems }, null, 2));
    process.exit(1);
  }
  console.error('');
  console.error('✖ pnpm-lock.yaml is out of sync with package.json');
  console.error('');
  for (const problem of problems) console.error('  • ' + problem);
  console.error('');
  console.error('  The Amplify build installs with --frozen-lockfile and will REFUSE to install,');
  console.error('  failing the deploy before it compiles anything. Fix it here instead:');
  console.error('');
  console.error('      pnpm install --lockfile-only');
  console.error('      git add ' + LOCKFILE);
  console.error('');
  process.exit(1);
}

function main() {
  const manifestText = readSource(MANIFEST);
  const lockText = readSource(LOCKFILE);
  const where = STAGED ? 'the staged commit' : 'the working tree';

  if (manifestText === null) {
    // --staged and package.json is not in this commit: nothing this guard can judge. A pass.
    if (!STAGED) fail([MANIFEST + ' not found.']);
    return done([]);
  }
  if (lockText === null) {
    return fail([LOCKFILE + ' is missing from ' + where + ', but ' + MANIFEST + ' is present.']);
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (err) {
    return fail([MANIFEST + ' in ' + where + ' is not valid JSON: ' + err.message]);
  }

  const locked = parseRootImporter(lockText);
  if (!locked) {
    return fail([
      'Could not find an `importers:` block in ' + LOCKFILE + '.',
      'If the lockfile format changed, this guard needs updating alongside it.',
    ]);
  }

  const problems = [];

  for (const section of SECTIONS) {
    const declared = new Map(Object.entries(manifest[section] || {}));
    const recorded = locked[section];

    for (const [name, specifier] of declared) {
      if (!recorded.has(name)) {
        problems.push(name + ' is in ' + section + ' but missing from the lockfile.');
      } else if (recorded.get(name) !== specifier) {
        problems.push(
          name + ' (' + section + ') is "' + specifier + '" in ' + MANIFEST +
            ' but "' + recorded.get(name) + '" in the lockfile.',
        );
      }
    }
    for (const name of recorded.keys()) {
      if (!declared.has(name)) {
        problems.push(name + ' is recorded in the lockfile’s ' + section + ' but is no longer in ' + MANIFEST + '.');
      }
    }
  }

  return problems.length ? fail(problems) : done(problems);
}

main();
