/** Manual artifact refresh. No server, network, deployment, package or hook changes. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const base = path.resolve('docs/projects/active');
const archiveBase = path.resolve('docs/projects/archive');
const progressPath = path.join(base, 'REVENUE_ACCOUNTING_PROGRESS.json');
const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
const file = path.join(base, 'REVENUE_ACCOUNTING_REVIEW.html');
const plan = fs.readFileSync(path.join(base, 'REVENUE_ACCOUNTING_READINESS_PLAN.md'), 'utf8');
const brief = fs.readFileSync(path.join(base, 'REVENUE_ACCOUNTING_READINESS_PM_BRIEF.md'), 'utf8');
const phaseZero = fs.readFileSync(path.join(base, 'REVENUE_ACCOUNTING_PHASE0_REVIEW.md'), 'utf8');
const bookkeeping = fs.readFileSync(path.join(archiveBase, 'REVENUE_ACCOUNTING_BOOKKEEPING_PLAN.md'), 'utf8');
const decisions = plan.split(/\r?\n/).filter(line => /^\| D\d{2} \|/.test(line)).map(line => {
  const [id, question, owner, direction, before] = line.split('|').slice(1, -1).map(v => v.trim());
  const scope = progress.deferredDecisionIds?.includes(id) ? 'expansion' : 'launch';
  return { id, question, owner, direction, before, scope };
});
if (decisions.length !== 25 || new Set(decisions.map(d => d.id)).size !== 25) throw new Error('Expected 25 unique decision items.');
if (progress.schemaVersion !== 3 || progress.phases.length !== 6) throw new Error('Expected six scoped project phases with linked work.');
const statuses = new Set(['done', 'in_progress', 'needs_input', 'planned', 'deferred', 'external']);
const seen = new Set();
for (const phase of progress.phases) {
  if (!phase.stages.length) throw new Error(`Phase ${phase.id} requires stages.`);
  for (const stage of phase.stages) {
    if (seen.has(stage.id) || !stage.id.startsWith(phase.id + '.') || !statuses.has(stage.status)) throw new Error(`Invalid stage ${stage.id}`);
    if (!['launch', 'expansion', 'external'].includes(stage.scope) || (stage.status === 'deferred' && stage.scope !== 'expansion') || ((stage.status === 'external') !== (stage.scope === 'external'))) throw new Error(`Invalid stage scope ${stage.id}`);
    if (stage.scope === 'external') {
      const linked = stage.linkedProject;
      if (!linked?.stageIds?.length || path.basename(linked.progress ?? '') !== 'BOOKKEEPING_PROGRESS.json') throw new Error(`Missing linked project ${stage.id}`);
      const linkedProgressPath = path.resolve(base, linked.progress);
      if (!linkedProgressPath.startsWith(archiveBase + path.sep)) throw new Error(`Linked project must use its archived tracker: ${stage.id}`);
      const linkedProgress = JSON.parse(fs.readFileSync(linkedProgressPath, 'utf8'));
      const linkedIds = new Set(linkedProgress.phases.flatMap(p => p.stages).map(s => s.id));
      if (!linked.stageIds.every(id => linkedIds.has(id))) throw new Error(`Unknown linked stage ${stage.id}`);
    }
    seen.add(stage.id);
    if (stage.status === 'done' && (!/^\d{4}-\d{2}-\d{2}$/.test(stage.completedOn ?? '') || !stage.evidence?.length)) throw new Error(`Completion needs date and evidence: ${stage.id}`);
    for (const evidence of stage.evidence ?? []) {
      if (/^[a-z]+:/i.test(evidence.path)) throw new Error('Stage evidence must be local to the project.');
      const resolved = path.resolve(base, evidence.path.split('#')[0]);
      if ((!resolved.startsWith(base + path.sep) && !resolved.startsWith(archiveBase + path.sep)) || !fs.existsSync(resolved)) throw new Error(`Missing/outside evidence: ${evidence.path}`);
    }
  }
}
const data = JSON.stringify({ asOf: progress.updatedOn, brief, phaseZero, bookkeeping, decisions, progress }).replace(/</g, '\\u003c');
const block = `// BEGIN PROJECT DATA\nconst DATA = ${data};\n// END PROJECT DATA`;
let html = fs.readFileSync(file, 'utf8');
if (html.includes('// BEGIN PROJECT DATA')) html = html.replace(/\/\/ BEGIN PROJECT DATA[\s\S]*?\/\/ END PROJECT DATA/, () => block);
else if (/^const DATA = .*;$/m.test(html)) html = html.replace(/^const DATA = .*;$/m, () => block);
else throw new Error('Artifact data block is missing.');
for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
if (!html.includes('id="index"')) throw new Error('Artifact requires the phase/stage index.');
fs.writeFileSync(file, html, 'utf8');
const completed = progress.phases.flatMap(p => p.stages).filter(s => s.status === 'done').length;
const deferred = progress.phases.flatMap(p => p.stages).filter(s => s.status === 'deferred').length;
console.log(`Review refreshed: ${progress.phases.length} phases, ${seen.size} stages, ${completed} verified, ${deferred} deferred expansion stages, ${decisions.length} decisions; as of ${progress.updatedOn}.`);
