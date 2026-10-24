/** Manual local documentation build; no server, hooks, network or deployment. */
import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve('docs/projects/archive');
const progress = JSON.parse(fs.readFileSync(path.join(base, 'BOOKKEEPING_PROGRESS.json'), 'utf8'));
const plan = fs.readFileSync(path.join(base, 'REVENUE_ACCOUNTING_BOOKKEEPING_PLAN.md'), 'utf8');
const brief = fs.readFileSync(path.join(base, 'REVENUE_ACCOUNTING_BOOKKEEPING_PM_BRIEF.md'), 'utf8');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inline = value => esc(value).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${/^(https?:)/.test(url) || /^[A-Za-z0-9_./-]+\.(md|json|html|csv)(#[A-Za-z0-9_-]+)?$/.test(url) ? url : '#'}">${label}</a>`).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
function markdown(md) {
  let out = '', list = false;
  const end = () => { if (list) { out += '</ul>'; list = false; } };
  const lines = md.split(/\r?\n/);
  const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(v => v.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { end(); continue; }
    if (line.startsWith('|') && /^\|(?:\s*:?-+:?\s*\|)+$/.test((lines[i + 1] ?? '').trim())) {
      end();
      out += '<div class="table-wrap"><table><thead><tr>' + cells(line).map(v => '<th scope="col">' + inline(v) + '</th>').join('') + '</tr></thead><tbody>';
      i++;
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        i++;
        out += '<tr>' + cells(lines[i]).map(v => '<td>' + inline(v) + '</td>').join('') + '</tr>';
      }
      out += '</tbody></table></div>';
    } else if (/^#{1,3} /.test(line)) {
      end();
      const [, hashes, text] = line.match(/^(#{1,3}) (.*)/);
      out += `<h${hashes.length}>${inline(text)}</h${hashes.length}>`;
    } else if (line.startsWith('> ')) {
      end(); out += '<blockquote>' + inline(line.slice(2)) + '</blockquote>';
    } else if (line.startsWith('- ')) {
      if (!list) { out += '<ul>'; list = true; }
      out += '<li>' + inline(line.slice(2)) + '</li>';
    } else { end(); out += '<p>' + inline(line) + '</p>'; }
  }
  end(); return out;
}

if (progress.schemaVersion !== 1 || progress.phases.length !== 6) throw new Error('Expected six bookkeeping phases.');
const seen = new Set();
for (const phase of progress.phases) {
  if (!['current', 'expansion'].includes(phase.scope) || !phase.stages.length) throw new Error('Invalid phase.');
  for (const stage of phase.stages) {
    if (seen.has(stage.id) || !stage.id.startsWith(phase.id + '.') || !['done', 'planned', 'in_progress', 'needs_input', 'deferred'].includes(stage.status)) throw new Error('Invalid stage ' + stage.id);
    seen.add(stage.id);
    if ((stage.status === 'deferred') !== (phase.scope === 'expansion')) throw new Error('Invalid deferred scope ' + stage.id);
    if (stage.status === 'done' && (!/^\d{4}-\d{2}-\d{2}$/.test(stage.completedOn ?? '') || !stage.evidence?.length)) throw new Error('Missing completion evidence ' + stage.id);
    for (const evidence of stage.evidence ?? []) {
      const resolved = path.resolve(base, evidence.path.split('#')[0]);
      if (!resolved.startsWith(base + path.sep) || !fs.existsSync(resolved)) throw new Error('Invalid evidence ' + evidence.path);
    }
  }
}
const current = progress.phases.filter(p => p.scope === 'current');
const currentStages = current.flatMap(p => p.stages);
const done = currentStages.filter(s => s.status === 'done').length;
const phaseDone = current.filter(p => p.stages.every(s => s.status === 'done')).length;
const label = s => s.status === 'done' ? 'Complete' : s.status === 'deferred' ? 'Deferred' : s.status === 'in_progress' ? 'In progress' : s.status === 'needs_input' ? 'Needs input' : s.kind === 'gate' ? 'Readiness gate' : 'Stage stub';
const index = progress.phases.map(p => `<details ${p.id === 'B0' ? 'open' : ''}><summary><strong>${esc(p.id)} Â· ${esc(p.title)}</strong><span>${p.scope === 'expansion' ? 'Deferred expansion' : p.stages.filter(s => s.status === 'done').length + ' / ' + p.stages.length + ' verified'}</span></summary><p class="dependency">${esc(p.dependency)}</p><ol class="checklist">${p.stages.map(s => `<li class="stage-row"><input type="checkbox" disabled ${s.status === 'done' ? 'checked' : ''} aria-label="${esc(s.id + ': ' + s.title + '; ' + label(s))}"><span class="code">${esc(s.id)}</span><div><strong>${esc(s.title)}</strong><small>${esc(s.owner)}</small>${s.completedOn ? '<small>Verified ' + esc(s.completedOn) + '</small>' : ''}${s.evidence?.length ? '<div class="evidence">' + s.evidence.map(e => '<a href="' + esc(e.path) + '">' + esc(e.label) + '</a>').join(' ') + '</div>' : ''}</div><span class="state ${esc(s.status)}">${label(s)}</span></li>`).join('')}</ol></details>`).join('');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FieldLogicHQ Â· Internal bookkeeping project</title>
<style>
:root{color-scheme:light;--ink:#152a44;--muted:#56667a;--line:#d4dde5;--blue:#2255a4;--paper:#f5f6f3}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.65 system-ui,sans-serif}main{max-width:1160px;margin:auto;padding:32px 28px 70px}a{color:var(--blue);text-underline-offset:3px}a:focus-visible,summary:focus-visible,button:focus-visible{outline:3px solid #4679db;outline-offset:4px}header{border-top:5px solid #b7d384;padding-top:23px}h1,h2,h3{line-height:1.2}header h1{font:clamp(34px,6vw,56px)/1.1 Georgia,serif;margin:12px 0 18px}header p{max-width:740px}h2{font:30px/1.2 Georgia,serif;margin:30px 0 16px}nav{display:flex;gap:20px;flex-wrap:wrap;padding:17px 0;border-block:1px solid var(--line);margin:25px 0}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:750}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:22px 0}.stat{padding:17px 20px;background:white;border:1px solid var(--line);border-radius:9px}.stat strong{display:block;font:31px/1.2 Georgia,serif}.stat span,small,.note{font-size:12px;color:var(--muted)}.focus{border-left:3px solid var(--blue);padding:12px 17px;background:#eaf0f7}details{background:white;border:1px solid var(--line);border-radius:10px;margin:14px 0;overflow:hidden}summary{display:flex;gap:18px;justify-content:space-between;padding:18px 20px;cursor:pointer}summary span{font-size:12px;white-space:nowrap}.dependency{font-size:12px;color:var(--muted);padding:0 20px}.checklist{list-style:none;padding:0;margin:0}.stage-row{display:grid;grid-template-columns:18px 50px minmax(0,1fr) auto;gap:12px;padding:15px 20px;border-top:1px solid var(--line)}input[type=checkbox]{margin:4px 0 0;accent-color:#247444}.code{font-size:12px;color:var(--blue);font-weight:700}.stage-row strong{font-size:13px}.stage-row small{display:block}.evidence{font-size:12px;margin-top:6px}.state{align-self:start;padding:3px 8px;border-radius:5px;background:#edf1f7;font-size:11px;white-space:nowrap}.state.done{background:#e4f2e7;color:#1b663a}.state.deferred{background:#eceff2;color:#586575}article{background:white;border:1px solid var(--line);border-radius:10px;padding:26px;margin-top:22px}article h1{font:30px/1.2 Georgia,serif}article h2{font-size:25px}article p,article li{font-size:14px}blockquote{margin:14px 0;border-left:3px solid var(--blue);padding:9px 14px;background:#f0f4f8;font-size:12px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:620px;font-size:12px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:12px}th{background:#eaf0f7}footer{margin-top:28px;font-size:12px;color:var(--muted)}@media(max-width:650px){main{padding:20px 16px 45px}.stats{grid-template-columns:1fr}.stage-row{grid-template-columns:18px 43px minmax(0,1fr);gap:8px;padding:14px}.state{grid-column:3;justify-self:start}summary{display:block;padding:15px}summary span{display:block;margin-top:6px}article{padding:20px}nav{gap:12px}}@media print{body{background:white}main{max-width:none;padding:0}nav{display:none}article{border:0;padding:0;break-before:page}details{break-inside:auto}.stage-row{break-inside:avoid}.table-wrap{overflow:visible}table{min-width:0}a{color:black}}
</style></head><body><main>
<header><div class="eyebrow">FieldLogicHQ Â· Parallel project Â· ${esc(progress.updatedOn)}</div><h1>Our books.<br>Built around our workflow.</h1><p>A small private bookkeeping tool for expenses, receipts, Stripe revenue, flexible reports and accountant exports. The expense core can progress while the companion Stripe project resolves production payment details.</p></header>
<nav aria-label="Project sections"><a href="#index">Phase index</a><a href="BOOKKEEPING_B0_SCREEN_DESIGNS.html">B0 screen designs</a><a href="#plan">Full plan</a><a href="#brief">PM brief</a><a href="BOOKKEEPING_BUILD_PROMPT.md">Separate-chat prompt</a><a href="../active/REVENUE_ACCOUNTING_REVIEW.html#index">Stripe project â†—</a></nav>
<section id="index"><h2>Phases and stage ticks</h2><div class="stats"><div class="stat"><strong id="done-count">${done} / ${currentStages.length}</strong><span>Current stages verified</span></div><div class="stat"><strong id="phase-count">${phaseDone} / ${current.length}</strong><span>Current phases complete</span></div><div class="stat"><strong>${seen.size - currentStages.length}</strong><span>Deferred expansion stages</span></div></div><p class="focus">${esc(progress.currentFocus)}</p><p class="note">Generated snapshot. A tick requires dated evidence. Deferred stages remain visible and unticked. Native phase sections expand when opened; print after expanding the sections you want.</p>${index}</section>
<section id="plan"><h2>Custom build and parallel handoff</h2><article>${markdown(plan)}</article></section><section id="brief"><h2>PM brief</h2><article>${markdown(brief)}</article></section><footer>Stopped and archived by owner; the tracker preserves incomplete stages. Canonical tracker: <a href="BOOKKEEPING_PROGRESS.json">BOOKKEEPING_PROGRESS.json</a>. Refresh with node scripts/build-bookkeeping-review.mjs.</footer>
</main></body></html>
`;
fs.writeFileSync(path.join(base, 'BOOKKEEPING_REVIEW.html'), html, 'utf8');
console.log(`Bookkeeping review refreshed: ${progress.phases.length} phases, ${seen.size} stages, ${done} verified, ${seen.size - currentStages.length} deferred.`);
