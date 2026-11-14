/**
 * Build a prelim walk's results page (the `/prewalk` agent, owner 2026-11-14).
 *
 *   node scripts/prewalk-report.mjs .probe/prewalk/<id>            reads steps.json + results.json there
 *   node scripts/prewalk-report.mjs .probe/prewalk/<id> --partial  build from a run that stopped early (the page says so)
 *
 * Writes <dir>/page/index.html (from scripts/lib/prewalk-report.html), copies the screenshots the steps cite to
 * <dir>/page/shots/, and writes <dir>/page/files.json — the `files` map for publishing the page with its screenshots.
 * A run that stopped early is refused unless --partial: an aborted run is a failure, not a result.
 *
 * Step text may carry <b>, <i>, <em>, <strong> and <code>; anything else is shown as written, never rendered.
 * The template is filled with split/join, never String.replace (a "$" in step text is a replace pattern).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirArg = process.argv[2];
const partial = process.argv.includes('--partial');
if (!dirArg) { console.error('usage: node scripts/prewalk-report.mjs <walk folder> [--partial]'); process.exit(1); }
const dir = path.resolve(dirArg);
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const def = read('steps.json');
const res = read('results.json');
if (!res.complete && !partial) {
  console.error('✗ This run stopped before the end, so there is no result to report. Run it again, or pass --partial to build a page that says so.');
  process.exit(1);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (s) => esc(s).replace(/&lt;(\/?)(b|i|em|strong|code)&gt;/g, '<$1$2>');

function when(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const h = d.getHours();
  return `${date}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

const pageDir = path.join(dir, 'page');
fs.rmSync(pageDir, { recursive: true, force: true });
fs.mkdirSync(path.join(pageDir, 'shots'), { recursive: true });
const files = {};
const tally = { checked: 0, failed: 0, yours: 0, calls: 0 };

const parts = (def.parts ?? []).map((p) => ({
  id: p.id,
  title: p.title ?? '',
  who: p.who ?? '',
  steps: (p.steps ?? []).map((s) => {
    const r = res.steps?.[s.id] ?? { status: 'yours', reason: 'the script did not reach this step', checks: [], shots: [] };
    const kind = s.kind ?? 'step';
    // An owner's call is never a machine tick, whatever the run recorded for it.
    const status = kind === 'call' ? 'yours' : r.status;
    if (kind === 'call') tally.calls += 1; else tally[status] += 1;
    for (const sh of r.shots ?? []) {
      const from = path.join(dir, 'shots', sh.file);
      if (!fs.existsSync(from)) continue;
      fs.copyFileSync(from, path.join(pageDir, 'shots', sh.file));
      files[`shots/${sh.file}`] = `shots/${sh.file}`;
    }
    return {
      id: s.id, kind, who: s.who ?? '', do: rich(s.do), see: rich(s.see ?? ''), options: s.options ?? [],
      status, reason: r.reason ?? '', checks: r.checks ?? [],
      shots: (r.shots ?? []).filter((sh) => files[`shots/${sh.file}`]),
    };
  }),
}));

const code = `${res.head || 'unknown'}${res.build?.head && !res.build.head.startsWith(res.head) ? ` (server built from ${res.build.head.slice(0, 9)})` : ''}`;
const data = {
  key: `${String(def.walk ?? 'walk').replace(/[^A-Za-z0-9]/g, '')}-${res.startedAt}`,
  walk: def.walk ?? 'Walk',
  title: def.title ?? '',
  walkUrl: def.walkUrl ?? '',
  signIn: (def.signIn ?? []).map(rich),
  ranAt: when(res.finishedAt ?? res.startedAt),
  code,
  complete: !!res.complete,
  fixtureNote: res.fixtureNote ?? '',
  writes: res.writes ?? [],
  parts,
};

const template = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib', 'prewalk-report.html'), 'utf8');
// "<" is written as an escape so step text can never close the script tag; U+2028/9 end a line inside a script.
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const BS = String.fromCharCode(92); // a backslash, spelled this way so no tool can drop or decode it
const json = JSON.stringify(data).split("<").join(BS + "u003c").split(LS).join(BS + "u2028").split(PS).join(BS + "u2029");
const title = esc(`${data.walk} Prelim Walk`);
const html = template.split('__PREWALK_TITLE__').join(title).split('__PREWALK_DATA__').join(json);
fs.writeFileSync(path.join(pageDir, 'index.html'), html);
fs.writeFileSync(path.join(pageDir, 'files.json'), JSON.stringify(files, null, 2));

const shotCount = Object.keys(files).length;
console.log(`${data.walk}: ${tally.checked} checked · ${tally.failed} failed · ${tally.yours} left for the owner · ${tally.calls} calls${res.complete ? '' : ' · RUN STOPPED EARLY'}`);
console.log(`Page:  ${path.join(pageDir, 'index.html')}`);
console.log(`Shots: ${shotCount} (publish with root = ${pageDir} and files = the map in page/files.json)`);
if (shotCount > 255) console.log('⚠ More than 255 screenshots: one publish takes at most 255 files — send the rest in a second publish to the same URL.');
