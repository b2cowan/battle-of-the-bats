/**
 * check-agent-automation.mjs — REPORTS changes to shared agent automation and the database checks.
 * A safety net that shows; it never blocks (owner ruling 2026-09-26).
 *
 * Why: from 06-01 to 09-25 an agent-added PostToolUse hook refreshed the schema snapshots up to ~580
 * times a day against BOTH databases (about 90% of all prod query time; dev CPU at 99%). An agent
 * added it inside a giant feature commit, and another widened it from dev-only to dev + PROD inside
 * a cleanup commit that called the change a "hook script rename". Nobody saw either change.
 * See docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md §9.
 *
 * On 09-26 this was briefly a blocking fingerprint gate with an owner-approval step. The owner ruled
 * that approval prompts and approval ceremonies "mean nothing to me" and slow development, and
 * asked for safety nets that check instead. So this lists what changed, and the daily stack health
 * check (scripts/stack-health.mjs) puts that list in front of him.
 *
 *   node scripts/check-agent-automation.mjs              the last 24 h of commits + uncommitted edits
 *   node scripts/check-agent-automation.mjs --hours=168  the last week
 */

import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Shared agent automation, the database checks, and the tools that touch production. */
export const WATCHED_PATHS = [
  '.claude/settings.json',
  '.githooks/pre-commit',
  // what the snapshot hook runs, and the stamp its gate reads
  'scripts/after-migration-refresh-hook.mjs',
  'scripts/lib/migration-refresh-gate.mjs',
  'scripts/refresh-db-snapshots.mjs',
  'scripts/refresh-db-schema.mjs',
  // the tools that write to or read from production
  'scripts/apply-migration-api.mjs',
  'scripts/db-query.mjs',
  // the database checks and the safety nets themselves
  'scripts/check-prod-migration-drift.mjs',
  'scripts/check-schema-parity.mjs',
  'scripts/check-snapshot-freshness.mjs',
  'scripts/check-index-coverage.mjs',
  'scripts/check-dictionary-coverage.mjs',
  'scripts/check-manual-prod-migrations.mjs',
  'scripts/check-db-load.mjs',
  'scripts/check-agent-automation.mjs',
  'scripts/stack-health.mjs',
  'scripts/lib/supabase-ops.mjs',
  'scripts/stack-health-task.cmd',
  'scripts/stack-health-schedule.ps1',
  'scripts/stack-health-dashboard.mjs',
  'scripts/lib/stack-health-dashboard.html',
];

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * Commits in the window that touched a watched path, and watched paths edited but uncommitted now.
 * @returns {{ commits: { hash: string, date: string, subject: string, files: string[] }[], uncommitted: string[] }}
 */
export function automationChanges({ hours = 24, since, until } = {}) {
  const commits = [];
  let log = '';
  const window = since ? [`--since=${since}`, ...(until ? [`--until=${until}`] : [])] : [`--since=${hours} hours ago`];
  try {
    log = git(['log', ...window, '--name-only', '--format=%x01%h%x02%ad%x02%s', '--date=format:%Y-%m-%d %H:%M', '--', ...WATCHED_PATHS]);
  } catch { /* not a git checkout — report nothing rather than fail the health check */ }
  for (const block of log.split('\x01').filter((b) => b.trim())) {
    const [head, ...files] = block.split('\n').map((s) => s.trim()).filter(Boolean);
    const [hash, date, subject] = head.split('\x02');
    commits.push({ hash, date, subject, files: files.filter((f) => WATCHED_PATHS.includes(f)) });
  }
  let uncommitted = [];
  try {
    uncommitted = git(['status', '--porcelain', '--', ...WATCHED_PATHS]).split('\n').filter(Boolean).map((l) => l.slice(3));
  } catch { /* ignore */ }
  return { commits, uncommitted };
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  const hours = Number((process.argv.find((a) => a.startsWith('--hours=')) ?? '--hours=24').split('=')[1]) || 24;
  const { commits, uncommitted } = automationChanges({ hours });
  console.log(`Agent automation + database checks — changes in the last ${hours} h`);
  if (!commits.length && !uncommitted.length) console.log('  none');
  for (const c of commits) console.log(`  ${c.date}  ${c.hash}  ${c.subject}\n      ${c.files.join(', ')}`);
  for (const f of uncommitted) console.log(`  uncommitted: ${f}`);
}
