import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { PLAN_BILLING_PROFILES } from '../../lib/plan-billing-profile.ts';
import { readSource, filesUnder } from './_source-code.ts';

const labels = Object.values(PLAN_CONFIG).map(p => p.label).sort((a, b) => b.length - a.length);
const items = new Set(Object.values(PLAN_BILLING_PROFILES).flatMap(p => [...p.included.billing, ...p.included.article]));

/** Inspect actual literals/JSX, never comments, identifiers, or internal plan keys. */
function authoredFacts(code: string): string[] {
  const source = ts.createSourceFile('billing.tsx', code, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const lines = code.split(/\r?\n/);
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isStringLiteral(node) || ts.isJsxText(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim();
      const hasLabel = labels.some(label => {
        const at = text.indexOf(label);
        return at >= 0 && !/[A-Za-z]/.test(text[at - 1] ?? '') && !/[A-Za-z]/.test(text[at + label.length] ?? '');
      });
      if (hasLabel || /\$\s*\d/.test(text) || items.has(text)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
        // Exact-line exception, with a written reason, for genuinely quoted/external text only.
        if (!/\/\/\s*billing-copy-ok:\s*\S.{7,}/.test(lines[line] ?? '')) found.push(text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found.sort();
}

const screenFiles = () => filesUnder('components/billing', '.tsx').concat([
  'app/[orgSlug]/coaches/billing/page.tsx',
  'app/[orgSlug]/admin/org/billing/page.tsx',
  'components/admin/kit/club/BillingKit.tsx',
  'components/admin/kit/club/PlanMoveDialog.tsx',
  'app/[orgSlug]/admin/tournaments/settings/subscription/page.tsx',
]);

describe('billing screens take plan facts and included items from their data source', () => {
  it('rejects a hand-typed plan name, price and included item in new billing source', () => {
    assert.ok(authoredFacts('<p>Tournament Plus</p>').length);
    assert.ok(authoredFacts('<p>$39 CAD / month</p>').length);
    assert.ok(authoredFacts('<p>Venue management</p>').length);
    assert.ok(authoredFacts('const price = `$39 / month`;').length);
    assert.ok(authoredFacts('const s = `Move to Club ${name}`;').length);
    assert.deepEqual(authoredFacts('// Tournament Plus costs $39\nconst key = "tournament_plus"; <p>{profile.config.label}{W.price(amount, cycle)}</p>'), []);
    assert.deepEqual(authoredFacts('const quote = "Club"; // billing-copy-ok: external quoted reference'), []);
    assert.ok(authoredFacts('const quote = "Club"; // billing-copy-ok:').length, 'an annotation without a reason is not an exception');
  });

  it('guards every billing surface without a legacy literal exception', () => {
    for (const file of screenFiles()) {
      const found = authoredFacts(readSource(file));
      assert.deepEqual(found, [], `${file}: take plan names/prices/included items from the registry/words module`);
    }
  });
});
