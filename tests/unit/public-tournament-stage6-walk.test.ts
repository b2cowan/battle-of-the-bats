import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const html = readFileSync('docs/projects/active/PUBLIC_TOURNAMENT_STAGE6_WALK.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
const syntax = ts.createSourceFile('walk.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const definitions = syntax.statements.filter(node => ts.isFunctionDeclaration(node)
  || (ts.isVariableStatement(node) && node.declarationList.declarations.every(declaration =>
    ['HOST', 'ORG', 'M', 'RULES', 'DEMO', 'WALKS', 'KEY', 'state', 'WORD'].includes(declaration.name.getText(syntax)))));
function checklist() {
  const summary = { value: '' };
  const storage = new Map<string, string>();
  const context = vm.createContext({ document: { getElementById: () => summary },
    localStorage: { setItem: (key: string, value: string) => storage.set(key, value) },
  });
  vm.runInContext(definitions.map(node => node.getText(syntax)).join('\n'), context);
  vm.runInContext('var PARTS=WALKS.flatMap(function(w){return w.parts;})', context);
  return { context, summary, storage };
}
describe('Stage 6 owner-walk summary executes the published HTML logic', () => {
  it('is valid JavaScript with one fresh, unchecked page of five walks covering all sixteen parts', () => {
    new vm.Script(script);
    const { context } = checklist();
    assert.equal(vm.runInContext('WALKS.length', context), 5);
    assert.equal(vm.runInContext('new Set(PARTS.map(function(p){return p.id;})).size', context), 16);
    assert.equal(vm.runInContext('PARTS.length', context), 16);
    assert.ok(vm.runInContext('PARTS.reduce(function(n,p){return n+p.steps.length;},0) >= 60', context));
    assert.equal(vm.runInContext('Object.keys(state.ticks).length', context), 0);
    assert.match(vm.runInContext('KEY', context), /^qa-435-/);
    assert.match(html, /§435/);
    // The stylesheet's note names the Stage 5 shell it copies; the page and its script must carry none of that walk.
    assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>/g, ''), /qa-432|§432/);
    assert.doesNotMatch(html, /password=/);
  });
  it('reports missing ticks and missing verdicts rather than producing a false pass', () => {
    const { context, summary } = checklist();
    vm.runInContext('buildSummary()', context);
    assert.match(summary.value, /INCOMPLETE/);
    assert.match(summary.value, /NO VERDICT SET/);
    vm.runInContext('PARTS.forEach(function(p){state.verdict[p.id]="pass";});buildSummary()', context);
    assert.match(summary.value, /INCOMPLETE: unperformed steps/);
    assert.match(summary.value, /unticked: A1/);
  });
  it('preserves notes, issues and counts when the user builds the result', () => {
    const { context, summary, storage } = checklist();
    vm.runInContext('PARTS.forEach(function(p){state.verdict[p.id]="pass";p.steps.forEach(function(s,i){state.ticks[p.id+(i+1)]=true;});});state.verdict.L="issue";state.notes.L="Preview unavailable\\nRecord the account scope";save();buildSummary()', context);
    assert.match(summary.value, /Part L[^\n]*\[ISSUE\]/);
    assert.match(summary.value, /Notes: Preview unavailable \/ Record the account scope/);
    assert.doesNotMatch(summary.value, /INCOMPLETE|NO VERDICT SET|unticked:/);
    const counts = [...summary.value.matchAll(/ · checked (\d+) of (\d+)/g)];
    assert.equal(counts.length, 5, 'one count per walk');
    for (const [, done, all] of counts) assert.equal(done, all);
    assert.ok([...storage.values()].some(value => value.includes('Preview unavailable')));
  });
});
