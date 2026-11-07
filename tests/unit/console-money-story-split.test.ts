import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { refundSplitWords } from '../../lib/console-money-story.ts';
import { readCode } from './_source-code.ts';

/**
 * GST/HST Stage 3 Part 4 (owner 2026-11-06, undrawn state 4 as recommended): the Story's console refund adds its tax split when the
 * credit note's record exists; a dispute keeps Stripe's amount and says it includes tax; a refund with no note says nothing more.
 */
describe('the Story’s refund and dispute lines carry the tax split', () => {
  it('a credit note with tax reads "$44.25 + $5.75 tax"; one with no tax says nothing (never "+ $0.00 tax")', () => {
    assert.equal(refundSplitWords({ amountBeforeTaxCents: 4425, taxCents: 575, currency: 'cad' }), '$44.25 + $5.75 tax');
    assert.equal(refundSplitWords({ amountBeforeTaxCents: 5000, taxCents: 0, currency: 'cad' }), '');
  });

  it('the Story reads the split from OUR record of the note, read only, by the note id the refund keeps; a failed read leaves the line as it was', () => {
    const story = readCode('lib/platform-story.ts');
    assert.match(story, /async function creditNoteSplits/);
    assert.match(story, /from\('platform_credit_note_tax_records'\)\.select\('stripe_credit_note_id, amount_before_tax_cents, tax_total_cents, currency'\)/);
    assert.match(story, /\.in\('stripe_credit_note_id', /, 'matched by the note id (write-once on the refund), never by printed number');
    assert.doesNotMatch(story, /platform_credit_note_tax_records'\)\s*\.(insert|update|upsert|delete)/);
    assert.match(story, /catch \(err\)[\s\S]{0,200}story credit note read failed/);
    // A refund with no credit note still says "no credit note" and nothing else.
    assert.match(story, /: 'no credit note'\}/);
  });

  it('a dispute says its amount includes tax, and only when it has an amount', () => {
    const story = readCode('lib/platform-story.ts');
    assert.match(story, /const taxed = cents === null \? '' : DISPUTE_TAX_WORDS;/);
  });
});
