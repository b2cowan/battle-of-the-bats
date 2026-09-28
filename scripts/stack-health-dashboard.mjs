/**
 * stack-health-dashboard.mjs — builds the local stack health dashboard: one self-contained page,
 * `.health/dashboard.html` (gitignored), that opens from file:// in any browser. No server, no
 * libraries, no network.
 *
 *   npm run health:dashboard     rebuild it from .health/ history
 *   npm run health:open          rebuild it and open it in the default browser
 *
 * stack-health.mjs rebuilds it after every recorded (scheduled) run. The page is the template
 * scripts/lib/stack-health-dashboard.html with DATA filled in: every recorded day's metrics (from
 * history.jsonl) and checks (parsed from reports/<day>.md, which are the source of truth for the
 * detail and "what to do" text), the Windows task's state, and whether email alerts are configured
 * (a yes/no; the key itself is never read into the page).
 * Plan: docs/projects/active/STACK_HEALTH_CHECK_PLAN.md §9.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(ROOT, 'scripts', 'lib', 'stack-health-dashboard.html');
const TASK_NAME = 'FieldLogicHQ stack health';
const MAX_DAYS = 60;

/** Parse one day's markdown report (the format stack-health.mjs writes) into checks. */
export function parseReport(md) {
  const checks = [];
  let section = null;
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) {
      section = line.includes('🔴') ? 'red' : line.includes('🟡') ? 'amber' : line.includes('❔') ? 'unknown' : line.includes('✅') ? 'green' : null;
      continue;
    }
    const todo = line.match(/^\s+→ (.*)$/);
    if (todo && checks.length) { checks[checks.length - 1].todo = todo[1]; continue; }
    const flagged = line.match(/^- (🔴|🟡|❔|✅) \*\*(.+?) · (.+?) · (.+?)\*\*: (.*)$/);
    if (flagged) {
      const status = { '🔴': 'red', '🟡': 'amber', '❔': 'unknown', '✅': 'green' }[flagged[1]];
      checks.push({ status, area: flagged[2], env: flagged[3], name: flagged[4], detail: flagged[5] });
      continue;
    }
    const fine = section === 'green' && line.match(/^- (.+?) · (.+?) · (.+?): (.*)$/);
    if (fine) checks.push({ status: 'green', area: fine[1], env: fine[2], name: fine[3], detail: fine[4] });
  }
  return checks;
}

function taskInfo() {
  if (process.platform !== 'win32') return null;
  const ps = `$t = Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue; ` +
    "if (-not $t) { '{\"state\":\"missing\"}' } else { $i = $t | Get-ScheduledTaskInfo; " +
    "@{ state = [string]$t.State; nextRun = $(if ($i.NextRunTime) { $i.NextRunTime.ToString('MMM d, h:mm tt') } else { '' }); " +
    "lastRun = $(if ($i.LastRunTime -and $i.LastRunTime.Year -gt 2000) { $i.LastRunTime.ToString('MMM d, h:mm tt') } else { '' }); " +
    'lastResult = [string]$i.LastTaskResult } | ConvertTo-Json -Compress }';
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'ignore'] });
    const info = JSON.parse(out.trim());
    // house clock style: "7:30 a.m."
    for (const k of ['nextRun', 'lastRun']) if (info[k]) info[k] = info[k].replace(/ AM$/, ' a.m.').replace(/ PM$/, ' p.m.');
    // a task that has never run reports 267011 (SCHED_S_TASK_HAS_NOT_RUN): not a failure
    if (info.lastResult === '267011') info.lastResult = '0';
    return info;
  } catch { return null; }
}

function emailConfigured() {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    const val = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim();
    return Boolean(process.env.HEALTH_RESEND_API_KEY || val('HEALTH_RESEND_API_KEY') || val('RESEND_API_KEY'));
  } catch { return false; }
}

/** Build .health/dashboard.html. Returns its path. */
export function buildDashboard({ healthDir = path.join(ROOT, '.health') } = {}) {
  const historyPath = path.join(healthDir, 'history.jsonl');
  const history = fs.existsSync(historyPath)
    ? fs.readFileSync(historyPath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    : [];
  const days = history.sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_DAYS).map((h) => {
    const reportPath = path.join(healthDir, 'reports', `${h.day}.md`);
    const report = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
    const checks = report ? parseReport(report) : (h.statuses ?? []).map((s) => ({ ...s, detail: '' }));
    return { day: h.day, runAt: h.runAt, overall: h.overall, replay: Boolean(h.replay), metrics: h.metrics ?? {}, checks, report };
  });
  const data = { generatedAt: new Date().toISOString(), task: taskInfo(), emailConfigured: emailConfigured(), days };
  // JSON inside a <script>: escape "<" so no string in the data (query text, commit subjects) can close the tag.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = fs.readFileSync(TEMPLATE, 'utf8').replace('/*__DATA__*/null', () => json);
  fs.mkdirSync(healthDir, { recursive: true });
  const out = path.join(healthDir, 'dashboard.html');
  fs.writeFileSync(out, html, 'utf8');
  return out;
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  const dir = process.argv.find((a) => a.startsWith('--health-dir='))?.split('=').slice(1).join('=');
  const out = buildDashboard(dir ? { healthDir: path.resolve(dir) } : {});
  console.log(`Dashboard: ${out}`);
  if (process.argv.includes('--open')) {
    // Explorer hands the file to the default browser. It exits non-zero even on success, so it is
    // spawned detached rather than awaited.
    const opener = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(opener, [out], { detached: true, stdio: 'ignore' }).unref();
  }
}
