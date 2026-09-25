/**
 * after-migration-refresh-hook.mjs — the PostToolUse hook (.claude/settings.json) that refreshes the
 * schema snapshots after an agent applies a migration.
 *
 * Reads the hook payload on stdin. It does nothing, silently, unless
 * lib/migration-refresh-gate.mjs says the call really applied a migration. The settings `if` is
 * only a pre-filter: it fails open on shell loops, which is how the previous hook came to pin the
 * database CPU (docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md).
 *
 * Single flight across every session sharing this checkout: a lock file in the OS temp dir that
 * records its owner's pid. A migration that lands while a refresh is running sets a PENDING flag, and
 * the running refresh goes once more when it finishes. It never skips, because a refresh that started
 * before the migration landed has not captured it.
 *
 * Time budget: Claude Code kills a hook at the settings timeout (180 s). A killed holder would leave
 * its lock behind and break the promise made to every migration queued behind it. So no new refresh
 * starts after START_ANOTHER_MS, each refresh is capped at REFRESH_TIMEOUT_MS (worst case
 * 90 + 75 = 165 s), and a migration still pending when the budget runs out is told to refresh by
 * hand, not promised a run that will never come.
 *
 * Never blocks or fails the agent's tool call: it always exits 0. It reports through
 * additionalContext, and check-snapshot-freshness is the safety net if a refresh fails.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { shouldRefreshSnapshots, checkoutKey, appliedStampPath } from './lib/migration-refresh-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = path.join(os.tmpdir(), `fieldlogichq-snapshot-refresh-${checkoutKey(ROOT)}.lock`);
const PENDING = `${LOCK}.pending`;
const STAMP = appliedStampPath(ROOT);
const REFRESH_TIMEOUT_MS = 75_000;  // a refresh takes about 20 s
const START_ANOTHER_MS = 90_000;    // no new refresh after this, so 90 + 75 stays under the 180 s kill
const STALE_MS = 200_000;           // nothing can hold the lock longer than the 180 s kill

const BY_HAND = 'Run `node scripts/refresh-db-snapshots.mjs` by hand; check-snapshot-freshness will fail until it runs.';

function report(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text },
  }));
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function tryLock() {
  try {
    fs.writeFileSync(LOCK, `${process.pid} ${new Date().toISOString()}`, { flag: 'wx' });
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    try {
      const owner = parseInt(fs.readFileSync(LOCK, 'utf8'), 10);
      const age = Date.now() - fs.statSync(LOCK).mtimeMs;
      // A dead owner (a hook killed at its timeout), or older than any hook can live (pid reuse).
      if (!pidAlive(owner) || age > STALE_MS) {
        fs.rmSync(LOCK, { force: true });
        return tryLock();
      }
    } catch { /* the holder released it between our calls — let the caller treat it as held */ }
    return false;
  }
}

function unlock() {
  try {
    // Only our own lock: a lock taken over as stale belongs to its new holder.
    if (parseInt(fs.readFileSync(LOCK, 'utf8'), 10) === process.pid) fs.rmSync(LOCK, { force: true });
  } catch { /* already gone */ }
}

function refreshOnce() {
  // Consume the flags BEFORE reading the schema. Anything applied after this line re-sets one of
  // them, and the loop runs again.
  fs.rmSync(PENDING, { force: true });
  fs.rmSync(STAMP, { force: true });
  const out = execFileSync('node', [path.join(ROOT, 'scripts', 'refresh-db-snapshots.mjs')], {
    cwd: ROOT, encoding: 'utf8', timeout: REFRESH_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\n').find((l) => l.startsWith('Wrote DRIFT_dev_vs_prod')) ?? 'Snapshots refreshed.';
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let payload;
  try { payload = JSON.parse(raw); } catch { return; }
  if (!shouldRefreshSnapshots(payload, { appliedStamp: fs.existsSync(STAMP) })) return;

  let locked;
  try {
    locked = tryLock();
  } catch (e) {
    report(`The schema-snapshot refresh could not take its lock (${e.code ?? e.message}). ${BY_HAND}`);
    return;
  }
  if (!locked) {
    try {
      fs.writeFileSync(PENDING, new Date().toISOString());
    } catch (e) {
      report(`A schema-snapshot refresh is already running and this migration could not be queued behind it (${e.code ?? e.message}). ${BY_HAND}`);
      return;
    }
    report('A migration was applied while a schema-snapshot refresh was already running. That refresh ' +
      'will run once more when it finishes, so this migration is captured. Commit the refreshed snapshot ' +
      'files and update docs/agents/db/DATA_DICTIONARY.md for the schema change.');
    return;
  }

  const started = Date.now();
  const withinBudget = () => Date.now() - started < START_ANOTHER_MS;
  let last = '';
  let runs = 0;
  try {
    for (;;) {
      try {
        do { last = refreshOnce(); runs++; } while (fs.existsSync(PENDING) && withinBudget());
      } finally {
        unlock();
      }
      if (!fs.existsSync(PENDING)) break;
      if (!withinBudget()) {
        report(`Schema snapshots refreshed ${runs} time${runs === 1 ? '' : 's'}, but another migration landed and ` +
          `the hook's time budget ran out before it could be captured. ${BY_HAND}`);
        return;
      }
      // A migration set PENDING between the loop's last check and the unlock. Take the lock back for
      // it; if someone else already holds it, their refresh captures the migration.
      if (!tryLock()) break;
    }
    report(`Schema snapshots refreshed after the migration (dev + prod, ${runs} run${runs === 1 ? '' : 's'}). ` +
      `${last} Commit the refreshed snapshot files and update docs/agents/db/DATA_DICTIONARY.md for the schema change.`);
  } catch (e) {
    report(`The automatic schema-snapshot refresh FAILED (${String(e.message).split('\n')[0]}). ${BY_HAND}`);
  }
}

main().catch(() => { /* never fail the agent's tool call */ }).finally(() => process.exit(0));
