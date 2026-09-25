/**
 * after-migration-refresh-hook.mjs — the PostToolUse hook (.claude/settings.json) that refreshes the
 * schema snapshots after an agent applies a migration.
 *
 * Reads the hook payload on stdin. It does nothing, silently, unless
 * lib/migration-refresh-gate.mjs says the call really applied a migration. The settings `if` is
 * only a pre-filter: it fails open on shell loops, which is how the previous hook came to pin the
 * database CPU (docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md).
 *
 * Single flight across every session sharing this checkout: a lock file in the OS temp dir. A
 * migration that lands while a refresh is running sets a PENDING flag, and the running refresh goes
 * once more when it finishes. It never skips, because a refresh that started before the migration
 * landed has not captured it.
 *
 * Never blocks or fails the agent's tool call: it always exits 0. It reports through
 * additionalContext, and check-snapshot-freshness is the safety net if a refresh fails.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { shouldRefreshSnapshots } from './lib/migration-refresh-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = crypto.createHash('sha1').update(ROOT.toLowerCase()).digest('hex').slice(0, 12);
const LOCK = path.join(os.tmpdir(), `fieldlogichq-snapshot-refresh-${KEY}.lock`);
const PENDING = `${LOCK}.pending`;
const STALE_MS = 5 * 60 * 1000; // the settings timeout is 180 s, so a lock older than this is dead

function report(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text },
  }));
}

function tryLock() {
  try {
    fs.writeFileSync(LOCK, `${process.pid} ${new Date().toISOString()}`, { flag: 'wx' });
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    try {
      if (Date.now() - fs.statSync(LOCK).mtimeMs > STALE_MS) {
        fs.rmSync(LOCK, { force: true });
        return tryLock();
      }
    } catch { /* the holder released it between our two calls — let the caller treat it as held */ }
    return false;
  }
}

function refreshOnce() {
  fs.rmSync(PENDING, { force: true });
  const out = execFileSync('node', [path.join(ROOT, 'scripts', 'refresh-db-snapshots.mjs')], {
    cwd: ROOT, encoding: 'utf8', timeout: 150_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\n').find((l) => l.startsWith('Wrote DRIFT_dev_vs_prod')) ?? 'Snapshots refreshed.';
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let payload;
  try { payload = JSON.parse(raw); } catch { return; }
  if (!shouldRefreshSnapshots(payload)) return;

  if (!tryLock()) {
    fs.writeFileSync(PENDING, new Date().toISOString());
    report('A migration was applied while a schema-snapshot refresh was already running. That refresh ' +
      'will run once more when it finishes, so this migration is captured. Commit the refreshed snapshot ' +
      'files and update docs/agents/db/DATA_DICTIONARY.md for the schema change.');
    return;
  }
  let last = '';
  let runs = 0;
  try {
    for (;;) {
      try {
        do { last = refreshOnce(); runs++; } while (fs.existsSync(PENDING));
      } finally {
        fs.rmSync(LOCK, { force: true });
      }
      // A migration can set PENDING between the loop's last check and the unlock. Take the lock back
      // for it; if someone else already holds it, their refresh captures the migration.
      if (!fs.existsSync(PENDING) || !tryLock()) break;
    }
    report(`Schema snapshots refreshed after the migration (dev + prod, ${runs} run${runs === 1 ? '' : 's'}). ` +
      `${last} Commit the refreshed snapshot files and update docs/agents/db/DATA_DICTIONARY.md for the schema change.`);
  } catch (e) {
    report(`The automatic schema-snapshot refresh FAILED (${String(e.message).split('\n')[0]}). ` +
      'Run `node scripts/refresh-db-snapshots.mjs` by hand; check-snapshot-freshness will fail until it runs.');
  }
}

main().catch(() => { /* never fail the agent's tool call */ }).finally(() => process.exit(0));
