#!/usr/bin/env node
// Owner brief: gathers the FACTS behind the owner's morning page. Read-only, run on demand
// (`node scripts/owner-brief.mjs`); it never runs by itself and touches nothing outside
// `.probe/owner-brief/out/`. How a refresh uses it: docs/agents/ops/OWNER_BRIEF.md.
//
// Nothing here is typed status. Every figure is derived:
//   - project activity      -> git history of the plan files in docs/projects/active
//   - walks owed            -> docs/projects/active/OWNER_QA_LEDGER.md
//   - not yet live          -> origin/master..dev, the release tags, MANUAL_PROD_STEPS.json
//   - roadmap items         -> the tables in docs/agents/strategy/PRODUCT_ROADMAP.md §2
// The registry (OWNER_BRIEF_PROJECTS.json) is THE BOARD (owner ruling 2026-11-17, ONE_BOARD_PLAN.md): the
// only place a project's status is written — goals, lane, phase, now → next, the next action, what it waits on
// and the owner's own steps. Activity, walks owed and production state are still derived, never typed.
// A plan file it does not list still appears, under its file name, flagged "not on the board".
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.probe', 'owner-brief', 'out');
const ACTIVE = 'docs/projects/active';
const REGISTRY = 'docs/agents/strategy/OWNER_BRIEF_PROJECTS.json';
const ROADMAP = 'docs/agents/strategy/PRODUCT_ROADMAP.md';
const LEDGER = `${ACTIVE}/OWNER_QA_LEDGER.md`;
const STEPS = 'supabase/migrations/MANUAL_PROD_STEPS.json';
const QUIET_AFTER_DAYS = 7;
const SHOW_WITHIN_DAYS = 45;
const LEDGER_WINDOW = 90; // newest sections considered; older ones were closed in bulk

const git = (args) => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const todayIso = new Date().toLocaleDateString('en-CA');
const daysSince = (iso) => Math.round((Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86400000);
const base = (p) => p.split('/').pop();

// ---- activity per file, from history ------------------------------------------------------------
function logByFile(extra) {
  const out = new Map(); // basename -> [dates newest first]
  let date = null;
  for (const line of git(`log ${extra} --name-only --format=@%cs -- ${ACTIVE} ${ROADMAP}`).split(/\r?\n/)) {
    if (line.startsWith('@')) { date = line.slice(1); continue; }
    if (!line.trim() || !date) continue;
    const b = base(line.trim());
    if (!out.has(b)) out.set(b, []);
    out.get(b).push(date);
  }
  return out;
}
const touched = logByFile('--since="200 days ago"');
const added = logByFile('--diff-filter=A');

const uncommitted = new Map(); // basename -> 'new' | 'changed'
for (const line of git(`status --porcelain -- ${ACTIVE} ${ROADMAP}`).split(/\r?\n/)) {
  if (!line.trim()) continue;
  const file = line.slice(3).replace(/^"|"$/g, '');
  uncommitted.set(base(file), line.startsWith('??') ? 'new' : 'changed');
}

function fileFacts(b) {
  const dates = touched.get(b) || [];
  const state = uncommitted.get(b) || null;
  let last = dates[0] || null;
  let started = (added.get(b) || []).slice(-1)[0] || null;
  if (state) {
    last = todayIso;
    if (state === 'new' && !started) {
      try { started = fs.statSync(path.join(ROOT, ACTIVE, b)).birthtime.toLocaleDateString('en-CA'); } catch { started = todayIso; }
    }
  }
  return { last, started, week: dates.filter((d) => daysSince(d) <= 7).length, uncommitted: Boolean(state) };
}

// ---- the walk ledger ----------------------------------------------------------------------------
function readWalks() {
  const lines = read(LEDGER).split(/\r?\n/);
  const heads = [];
  lines.forEach((l, i) => { const m = l.match(/^## §(\d+)\s*·\s*(.*)$/); if (m) heads.push({ n: Number(m[1]), i, rest: m[2] }); });
  const recent = heads.slice(-LEDGER_WINDOW);
  // Only explicit markers count. A section with a published walk and no result line is listed as
  // "no result recorded", so a walk that passed but was never written down is visible, not hidden.
  const OWED = /\*\*Result:?\*\*:?\s*(not walked|owed)|NOT YET WALKED/i;
  // The ledger writes a result several ways: "WALKED 2026-11-07 · PASSED 44 of 44", "Walked 2026-11-08, pasted
  // back…", "Result 2026-11-13 — PASSED 38/38", "SUPERSEDED", "Not owed", "accepted it UNWALKED",
  // "Walked ✅ 2026-11-05", "✅ COMPLETE 2026-11-05".
  const DONE = /\b(?:WALKED|Walked) (?:✅ )?\d{4}-\d{2}-\d{2}|✅ COMPLETE \d{4}-\d{2}-\d{2}|PASSED|passed \d+ of \d+|SUPERSEDED|Not owed|closed unwalked|UNWALKED on \d{4}/;
  const walks = [];
  recent.forEach((h, k) => {
    const end = k + 1 < recent.length ? recent[k + 1].i : lines.length;
    const body = lines.slice(h.i, end).join('\n');
    const explicit = OWED.test(body);
    if (!explicit && DONE.test(body)) return;
    if (!explicit && !/[Ww]alk published/.test(body)) return;
    const title = h.rest.split(' — ')[0].replace(/\*\*/g, '').trim();
    const link = (body.match(/https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+/) || [null])[0];
    const published = (body.match(/[Ww]alk published[^\d]{0,12}(\d{4}-\d{2}-\d{2})/) || [null, null])[1];
    const steps = (body.match(/(\d+)\s+(?:steps|checks|boxes)/) || [null, null])[1];
    walks.push({ section: h.n, title, link, published, steps: steps ? Number(steps) : null, paused: /paused/i.test(body), recorded: explicit });
  });
  return walks;
}

// ---- not yet live -------------------------------------------------------------------------------
function readProduction() {
  const tags = git('tag --list "release/*"').split(/\r?\n/).filter(Boolean).sort();
  const lastRelease = (tags[tags.length - 1] || '').replace('release/', '') || null;
  let ahead = null;
  try { ahead = Number(git('rev-list --count origin/master..dev')); } catch { /* no remote ref */ }
  let pendingSteps = null;
  try {
    const steps = JSON.parse(read(STEPS)).migrations || {};
    pendingSteps = Object.values(steps).filter((s) => s && s.prod === 'pending').length;
  } catch { /* leave null */ }
  const dirty = git('status --porcelain').split(/\r?\n/).filter(Boolean).length;
  const since = lastRelease ? `--since="${lastRelease} 00:00"` : '--since="60 days ago"';
  const releases90 = tags.filter((t) => daysSince(t.replace('release/', '')) <= 90).length;
  return { ahead, lastRelease, daysSinceRelease: lastRelease ? daysSince(lastRelease) : null, pendingSteps,
    uncommittedFiles: dirty, releasesLast90Days: releases90, commitsLast7Days: Number(git('rev-list --count --since="7 days ago" dev')), since };
}

// ---- the roadmap tables -------------------------------------------------------------------------
function readRoadmap() {
  const text = read(ROADMAP);
  const start = text.indexOf('\n## 2.');
  const end = text.indexOf('\n## 3.');
  const items = [];
  let horizon = null; let cols = null;
  for (const raw of text.slice(start, end).split(/\r?\n/)) {
    const h = raw.match(/^### (.+?)(?:\s*\((.+)\))?\s*$/);
    if (h) { horizon = { name: h[1].trim(), confidence: (h[2] || '').trim() }; cols = null; continue; }
    if (!raw.startsWith('|') || !horizon) continue;
    const cells = raw.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (!cols) { cols = cells.map((c) => c.toLowerCase()); continue; }
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i] || '']));
    if (!row.item) continue;
    items.push({ id: `r${items.length + 1}`, horizon: horizon.name, confidence: horizon.confidence, track: row.track || '',
      lane: row.lane || '', item: row.item, size: row.size || '', status: row.status || 'Not started', ruled: /yes/i.test(row.ruled || '') });
  }
  return items;
}

// ---- projects -----------------------------------------------------------------------------------
function readProjects(walks) {
  const registry = JSON.parse(read(REGISTRY)).projects;
  const claimed = new Set(registry.flatMap((p) => p.files));
  const projects = registry.map((p) => ({ ...p, auto: false }));
  const planFiles = new Set([...touched.keys(), ...uncommitted.keys()].filter((b) => /_PLAN\.md$/.test(b)));
  // An unregistered plan that has gone quiet shows only while the task list still has an open line
  // for it; otherwise it is finished work, counted as settled and left off the page.
  const openTodo = read('TODO.md').split(/\r?\n/).filter((l) => /^\s*- \[ \]/.test(l)).join('\n');
  let settled = 0;
  for (const b of planFiles) {
    if (claimed.has(b)) continue;
    // A plan moved to the archive is closed; its recent history must not list it as unregistered.
    if (!fs.existsSync(path.join(ROOT, ACTIVE, b))) continue;
    const f = fileFacts(b);
    if (!f.last || daysSince(f.last) > SHOW_WITHIN_DAYS) continue;
    if (daysSince(f.last) > QUIET_AFTER_DAYS && !openTodo.includes(b)) { settled += 1; continue; }
    const name = b.replace(/_PLAN\.md$/, '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    projects.push({ id: b.replace(/_PLAN\.md$/, '').toLowerCase(), name, track: 'product', files: [b], ledger: [], state: 'open', auto: true });
  }
  const out = projects.map((p) => {
    const facts = p.files.map(fileFacts);
    const lasts = facts.map((f) => f.last).filter(Boolean).sort();
    const starts = facts.map((f) => f.started).filter(Boolean).sort();
    const last = lasts[lasts.length - 1] || null;
    const owed = walks.filter((w) => (p.ledger || []).some((key) => w.title.toLowerCase().includes(key.toLowerCase())));
    const quietDays = last ? daysSince(last) : null;
    const isUncommitted = facts.some((f) => f.uncommitted);
    let status = 'moving';
    if (p.state === 'closed') status = 'closed';
    else if (p.state === 'parked') status = 'parked';
    else if (quietDays === null || quietDays > QUIET_AFTER_DAYS) status = owed.length ? 'waiting' : 'quiet';
    return { id: p.id, name: p.name, track: p.track || 'product', status, last, quietDays, started: starts[0] || null,
      commitsThisWeek: facts.reduce((s, f) => s + f.week, 0), uncommitted: isUncommitted, walksOwed: owed.map((w) => w.section),
      parked: p.parked || null, remains: p.remains || '', auto: p.auto,
      goals: p.goals || [], lane: p.lane || null, order: p.order ?? 99, phase: p.phase || null, stage: p.stage || '',
      next: p.next || '', waitsOn: p.waitsOn || [], finishesAfter: p.finishesAfter || [], youOwe: p.youOwe || [],
      state: p.state || 'open', checked: p.checked !== false, roadmap: p.roadmap || [] };
  });
  // what overtook a project that stopped: projects that started after its last activity
  for (const p of out) {
    if (!['quiet', 'waiting', 'parked'].includes(p.status) || !p.last) { p.overtakenBy = []; continue; }
    p.overtakenBy = out.filter((o) => o.id !== p.id && o.started && o.started > p.last && o.status === 'moving')
      .sort((a, b) => b.commitsThisWeek - a.commitsThisWeek).slice(0, 3).map((o) => o.name);
  }
  const rank = { moving: 0, waiting: 1, quiet: 2, parked: 3, closed: 4 };
  readProjects.settled = settled;
  return out.filter((p) => p.last || !p.auto).sort((a, b) => rank[a.status] - rank[b.status] || (a.quietDays ?? 999) - (b.quietDays ?? 999));
}

// ---- the board ----------------------------------------------------------------------------------
// Lanes: now (at most three, the owner's order) · next · later · after (a project whose goals are all "after").
// Two kinds of dependency: waitsOn = the NEXT step cannot start until that project is done (a Now project
// must have none open); finishesAfter = this project cannot FINISH until that one does (sequencing only).
// "Waiting on you" = every owner-only step typed on the board; walks owed come from the ledger, never typed.
// checked: false = not yet truth-checked (ONE_BOARD_PLAN Session 2) — counted, not warned about.
// The board's own rules are printed as warnings, so a broken board shows at the refresh.
const MAX_NOW = 3;
// A project's `roadmap` names the roadmap rows that cover its whole scope; a row's Status must fit the phase.
const ROW_FITS_PHASE = {
  Planning: ['Not started', 'In progress'], Drawing: ['Not started', 'In progress'], 'Asks to rule': ['Not started', 'In progress'],
  Building: ['In progress', 'Built'], 'Walk owed': ['In progress', 'Built'], 'Test owed': ['In progress', 'Built'], 'Ready to release': ['Built'], Live: ['Live'],
  Parked: ['Not started', 'In progress'],
};
function buildBoard(projects, roadmapRows = []) {
  const reg = JSON.parse(read(REGISTRY));
  const goalsDef = reg.goals || [];
  const afterGoals = new Set(goalsDef.filter((g) => g.after).map((g) => g.id));
  const byId = new Map(projects.map((p) => [p.id, p]));
  const isDone = (p) => p.state === 'closed' || p.phase === 'Live';
  const open = projects.filter((p) => !p.auto && p.state !== 'closed' && p.state !== 'parked');
  const laneOf = (p) => {
    if (p.goals.length && p.goals.every((g) => afterGoals.has(g))) return 'after';
    return ['now', 'next', 'later'].includes(p.lane) ? p.lane : 'later';
  };
  const lanes = { now: [], next: [], later: [], after: [] };
  for (const p of [...open].sort((a, b) => a.order - b.order)) lanes[laneOf(p)].push(p.id);
  const warnings = [];
  if (lanes.now.length > MAX_NOW) warnings.push(`${lanes.now.length} projects are in Now; the board allows ${MAX_NOW}.`);
  for (const p of open) {
    if (!p.phase && p.checked) warnings.push(`${p.name} has no phase.`);
    if (p.phase && !(p.phase in ROW_FITS_PHASE) && p.phase !== 'Live') warnings.push(`${p.name} has a phase the board does not know: "${p.phase}".`);
    // "Walk owed" promises a walk to open; the owner's own hands-on test with no walk page is "Test owed".
    if (p.phase === 'Walk owed' && !p.walksOwed.length) warnings.push(`${p.name} reads Walk owed, but no walk is waiting in the ledger (publish it, record its result, or change the phase).`);
    if (!p.goals.length) warnings.push(`${p.name} serves no goal.`);
    for (const g of p.goals) if (!goalsDef.some((d) => d.id === g)) warnings.push(`${p.name} names an unknown goal "${g}".`);
    for (const w of p.waitsOn) {
      const dep = byId.get(w);
      if (!dep) { warnings.push(`${p.name} waits on an unknown project "${w}".`); continue; }
      if (laneOf(p) === 'now' && !isDone(dep)) warnings.push(`${p.name} is in Now but waits on ${dep.name}, which is not done.`);
    }
    for (const w of p.finishesAfter) if (!byId.has(w)) warnings.push(`${p.name} finishes after an unknown project "${w}".`);
    if (laneOf(p) === 'after' && open.some((q) => laneOf(q) !== 'after' && (q.waitsOn.includes(p.id) || q.finishesAfter.includes(p.id))))
      warnings.push(`${p.name} is after launch, but a launch project depends on it.`);
  }
  for (const p of open) for (const item of p.roadmap) {
    const row = roadmapRows.find((r) => r.item === item);
    if (!row) { warnings.push(`${p.name} names a roadmap row that does not exist: "${item}".`); continue; }
    const fits = ROW_FITS_PHASE[p.phase];
    if (fits && !fits.includes(row.status))
      warnings.push(`Roadmap row "${item}" reads ${row.status}, but ${p.name} is at ${p.phase}.`);
  }
  const notOnBoard = projects.filter((p) => p.auto).map((p) => p.name);
  if (notOnBoard.length) warnings.push(`${notOnBoard.length} active plan(s) are not on the board: ${notOnBoard.join(', ')}.`);
  const unchecked = open.filter((p) => !p.checked).map((p) => p.id);
  const waitedOnBy = (id) => open.filter((p) => p.waitsOn.includes(id) || p.finishesAfter.includes(id)).map((p) => p.id);
  const goals = goalsDef.map((g) => {
    const mine = projects.filter((p) => !p.auto && p.goals.includes(g.id));
    return { id: g.id, name: g.name, doneWhen: g.doneWhen || '', after: Boolean(g.after),
      total: mine.length, done: mine.filter(isDone).length, projects: mine.map((p) => p.id) };
  });
  const youOwe = [];
  // A step is a sentence, or { text, url } when there is a real page to act on (a walk, an asks page, a dashboard).
  for (const p of open) for (const step of p.youOwe) {
    const text = typeof step === 'string' ? step : step.text;
    const url = typeof step === 'object' && /^https:\/\//.test(step.url || '') ? step.url : null;
    if (!text) { warnings.push(`${p.name} has a step with no words.`); continue; }
    youOwe.push({ project: p.id, name: p.name, text, url, lane: laneOf(p) });
  }
  const rank = { now: 0, next: 1, later: 2, after: 3 };
  youOwe.sort((a, b) => rank[a.lane] - rank[b.lane]);
  const cards = Object.fromEntries(open.map((p) => [p.id, { blocks: waitedOnBy(p.id) }]));
  return { lanes, goals, youOwe, warnings, cards, unchecked, maxNow: MAX_NOW };
}

// ---- run ----------------------------------------------------------------------------------------
const walks = readWalks();
const production = readProduction();
const roadmap = readRoadmap();
const projects = readProjects(walks);
const board = buildBoard(projects, roadmap);
const count = (list, key) => list.reduce((m, x) => { m[x[key]] = (m[x[key]] || 0) + 1; return m; }, {});
const DONE_STATUS = /^(live|done)$/i;
const horizons = [...new Set(roadmap.map((r) => r.horizon))].map((name) => {
  const rows = roadmap.filter((r) => r.horizon === name);
  const by = (track) => { const t = rows.filter((r) => r.track.toLowerCase() === track); return { total: t.length, live: t.filter((r) => DONE_STATUS.test(r.status)).length, built: t.filter((r) => /^built$/i.test(r.status)).length, inProgress: t.filter((r) => /^in progress$/i.test(r.status)).length }; };
  return { name, confidence: rows[0].confidence, product: by('product'), tech: by('technology') };
});
const meta = { generatedAt: new Date().toISOString(), date: todayIso, production: { ...production, since: undefined },
  projectCounts: count(projects, 'status'), settledNotShown: readProjects.settled || 0, walksOwed: walks.length, horizons };

fs.mkdirSync(OUT, { recursive: true });
const write = (name, obj) => fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(obj, null, 1));
write('meta', meta);
write('projects', { items: projects });
write('roadmap', { items: roadmap });
write('walks', { items: walks });
write('board', board);

// compact summary for the session that writes the day's priorities
const line = (s) => console.log(s);
line(`OWNER BRIEF FACTS ${todayIso}`);
line(`not live: ${production.ahead} changes, ${production.pendingSteps} database steps, last release ${production.lastRelease} (${production.daysSinceRelease}d ago); ${production.uncommittedFiles} uncommitted files; ${production.commitsLast7Days} commits in 7d`);
line(`walks owed (${walks.length}): ${walks.map((w) => `§${w.section}${w.paused ? ' paused' : ''}${w.recorded ? '' : ' (no result recorded)'} ${w.title.slice(0, 34)}`).join(' | ')}`);
line(`projects: ${JSON.stringify(meta.projectCounts)}`);
line(`settled and not shown (quiet, no open task-list line): ${meta.settledNotShown}`);
for (const p of projects) {
  if (p.status === 'closed') continue;
  if (p.status === 'moving' && p.auto && !p.uncommitted && p.commitsThisWeek <= 1) continue; // keep the summary short
  line(`  [${p.status}] ${p.name}${p.auto ? ' (unregistered)' : ''} · last ${p.last ?? 'never'} (${p.quietDays ?? '?'}d) · ${p.commitsThisWeek} this week${p.uncommitted ? ' · uncommitted' : ''}${p.walksOwed.length ? ` · walks §${p.walksOwed.join(' §')}` : ''}`);
}
for (const h of horizons) line(`roadmap ${h.name}: product ${h.product.live}/${h.product.total} live (${h.product.built} built, ${h.product.inProgress} in progress) · tech ${h.tech.live}/${h.tech.total} live (${h.tech.built} built, ${h.tech.inProgress} in progress)`);
for (const lane of ['now', 'next', 'later', 'after']) line(`board ${lane}: ${board.lanes[lane].join(', ') || '—'}`);
for (const g of board.goals) line(`goal ${g.name}: ${g.done} of ${g.total} done`);
line(`waiting on you: ${board.youOwe.length} owner steps, ${walks.length} walks`);
if (board.unchecked.length) line(`not yet truth-checked: ${board.unchecked.join(', ')}`);
for (const w of board.warnings) line(`  ⚠ ${w}`);
line(`wrote ${path.relative(ROOT, OUT)}/{meta,projects,roadmap,walks,board}.json`);
