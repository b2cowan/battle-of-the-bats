import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { readCode, readSource, filesUnder } from './_source-code.ts';
import { BILLING_TAX_WORDS } from '../../lib/billing-tax.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';

/**
 * GST/HST Stage 2 Part 4 (build prompt docs/projects/active/GST_HST_STAGE2_PART4_BUILD_PROMPT.md; owner ruling T4,
 * 2026-10-31): prices are tax-exclusive, so every price a buyer is quoted before Stripe's own page says "plus applicable
 * taxes". A screen that quoted a bare price would show one amount while Stripe charges another (plan §7).
 *
 * The guard reads `lib/plan-billing-words.ts` as code: every word in `PLAN_BILLING_WORDS` whose text quotes a price must
 * carry `PLUS_TAX` (or the one sentence `PRICES_PLUS_TAX`), or sit on the short list below with its reason. A new
 * price sentence added without the phrase fails the build here, naming the word.
 */

/** Deliberately bare, with the reason. Keep it short: a new entry is a decision, not a way past the guard. */
const BARE_ON_PURPOSE: Record<string, string> = {
  'coachUpsell.normally': 'rides a "Free through" price: nothing is charged yet, so there is nothing to tax',
  'founding.priceHelp': 'under the "Free through" Founding price (a waived price, not a charge)',
  'founding.body': 'names the waived price of a free Founding Season',
  'move.chargeChanged': 'the amount due today as Stripe worked it out, tax already in it',
  'clubUpgrade.amount': 'a figure in a window that shows the tax rows and Due today beneath it',
  'clubUpgrade.renewal': 'a figure; the move window sets "plus applicable taxes" under it (Part 3)',
};

/** A word quotes a price when its code builds one: a price helper, a formatted amount, or a "CAD /" period. */
const QUOTES_A_PRICE = /formatPriceAmount\(|coachMonthlyPrice\(|\bcents\(|\bpaidPrice\(|\bprice\(|CAD \/|\$\{(?:price|amount)\}/;
const CARRIES_THE_PHRASE = /\bPLUS_TAX\b|\bPRICES_PLUS_TAX\b/;

/** Every leaf word of `PLAN_BILLING_WORDS`, as `section.word` → its code (comments gone). */
function leafWords(code: string): Map<string, string> {
  const source = ts.createSourceFile('plan-billing-words.ts', code, ts.ScriptTarget.Latest, true);
  const words = new Map<string, string>();
  let root: ts.ObjectLiteralExpression | null = null;
  source.forEachChild(function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'PLAN_BILLING_WORDS' && node.initializer) {
      let init: ts.Expression = node.initializer;
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
      if (ts.isObjectLiteralExpression(init)) root = init;
    }
    node.forEachChild(find);
  });
  assert.ok(root, 'lib/plan-billing-words.ts: PLAN_BILLING_WORDS was not found; this guard reads it');
  (function walk(object: ts.ObjectLiteralExpression, prefix: string) {
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) continue; // shorthand props are the figure helpers (price, paidPrice, charge)
      const key = `${prefix}${property.name.getText(source)}`;
      if (ts.isObjectLiteralExpression(property.initializer)) walk(property.initializer, `${key}.`);
      else words.set(key, property.initializer.getText(source));
    }
  })(root!, '');
  return words;
}

const priced = (code: string) => [...leafWords(code)].filter(([, text]) => QUOTES_A_PRICE.test(text));

describe('every price a buyer is quoted says "plus applicable taxes" (T4)', () => {
  const code = readCode('lib/plan-billing-words.ts');

  it('the phrase and the one sentence have one source', () => {
    assert.equal(BILLING_TAX_WORDS.plusTax, 'plus applicable taxes');
    assert.equal(BILLING_TAX_WORDS.pricesPlusTax, `Prices are ${BILLING_TAX_WORDS.plusTax}.`);
    assert.match(code, /const PLUS_TAX = BILLING_TAX_WORDS\.plusTax;/);
    assert.match(code, /const PRICES_PLUS_TAX = BILLING_TAX_WORDS\.pricesPlusTax;/);
  });

  it('each word in plan-billing-words that quotes a price carries the phrase, or is bare on purpose', () => {
    const missing = priced(code).filter(([key, text]) => !CARRIES_THE_PHRASE.test(text) && !(key in BARE_ON_PURPOSE)).map(([key]) => key);
    assert.deepEqual(missing, [], `lib/plan-billing-words.ts: ${missing.join(', ')} quote a price without PLUS_TAX. ` +
      'Add `${PLUS_TAX}` after the price, or (a button, a free or waived price, a taxed total) add it to BARE_ON_PURPOSE with the reason.');
  });

  it('the bare list names only words that still quote a price without the phrase', () => {
    const words = new Map(priced(code));
    const stale = Object.keys(BARE_ON_PURPOSE).filter(key => !words.has(key) || CARRIES_THE_PHRASE.test(words.get(key)!));
    assert.deepEqual(stale, [], `BARE_ON_PURPOSE: ${stale.join(', ')} no longer quote a bare price; take them off the list`);
  });

  it('the guard finds a bare price and a stale exception (mutate-and-fail)', () => {
    const bare = code.replace('`${formatPriceAmount(amount)} ${PLUS_TAX} will be charged', '`${formatPriceAmount(amount)} will be charged');
    assert.notEqual(bare, code, 'the chosenBody sentence this check mutates has moved; point the check at it again');
    assert.ok(priced(bare).some(([key, text]) => key === 'founding.chosenBody' && !CARRIES_THE_PHRASE.test(text)));
    // A word that builds a price from a helper is found however it is spelled.
    assert.ok(priced('export const PLAN_BILLING_WORDS = { a: { b: (n: number) => `${price(n, "monthly")}.` } } as const;').length === 1);
  });

  it('the sentences read as ruled (drawing tab 7)', () => {
    assert.equal(W.founding.chosenBody(2190, 'Visa ending 4242').startsWith('$2,190 plus applicable taxes will be charged to Visa ending 4242 on '), true);
    assert.equal(W.change.pricesPlusTax, 'Prices are plus applicable taxes.');
    assert.equal(W.founding.pricesPlusTax, 'Prices are plus applicable taxes.');
    assert.equal(W.plan.fromPrice(219), 'From $219 CAD / month plus applicable taxes');
    assert.equal(W.plan.fromPrice(0), 'Free');
    assert.match(W.coachUpsell.shelf(false), /plus applicable taxes\.$/);
    assert.doesNotMatch(W.coachUpsell.shelf(true), /applicable taxes/, 'a Free-through price has nothing to tax');
  });
});

describe('the phrase is never typed as a literal outside its source', () => {
  it('app/, components/ and lib/ take it from BILLING_TAX_WORDS', () => {
    const files = ['app', 'components', 'lib'].flatMap(dir => [...filesUnder(dir, '.ts'), ...filesUnder(dir, '.tsx')])
      .filter(file => file.replace(/\\/g, '/') !== 'lib/billing-tax.ts');
    const typed = files.filter(file => /plus applicable taxes/i.test(readCode(file)));
    assert.deepEqual(typed, [], `${typed.join(', ')}: type the phrase as BILLING_TAX_WORDS.plusTax (lib/billing-tax.ts), one spelling`);
    assert.match(readSource('lib/billing-tax.ts'), /plusTax: 'plus applicable taxes'/);
  });
});
