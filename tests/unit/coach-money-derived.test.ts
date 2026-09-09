/**
 * ⚠⚠ ONE ROW, ONE SOURCE (COACH_MONEY_IN_TAXONOMY_PLAN §4.1).
 *
 * Fundraisers and sponsors already report their own actuals and player rebates depend on them, so a
 * row those already answer for must refuse a typed income record — otherwise the same dollar is
 * counted twice and the season reads better than it is. These tests state where a derived total
 * lands and which rows are therefore closed to typing, because both answers are the kind a later
 * "surely we can just put it on the first line" reverses.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  placeDerivedActual, whyIncomeIsRefused, type DerivedClaim,
} from '../../lib/coach-money-derived.ts';

const FUNDRAISING = 'cat-fundraising';
const DRIVE = 'item-drive';
const MERCH = 'item-merch';


function claim(over: Partial<DerivedClaim> = {}): DerivedClaim {
  return {
    source: 'fundraiser',
    categoryId: FUNDRAISING, categoryName: 'Fundraising',
    itemId: DRIVE, itemName: 'Fundraising drive',
    ...over,
  };
}

describe('placeDerivedActual — as deep as the plan actually agrees, and no deeper', () => {
  it('lands on the ITEM when every claiming line names the same one', () => {
    const at = placeDerivedActual([claim(), claim({ categoryName: 'Fundraising' })]);
    assert.equal(at.categoryId, FUNDRAISING);
    assert.equal(at.itemId, DRIVE);
    assert.equal(at.itemName, 'Fundraising drive');
  });

  it('falls back to the CATEGORY when the lines name two different items', () => {
    /* ⚠ THE HONEST ANSWER, not the convenient one. Nothing links a bottle drive to a budget item,
       so choosing between "Fundraising drive" and "Merchandise sales" for one $1,640 total would be
       confident-and-wrong data a coach could not detect. The visible gap is the nudge. */
    const at = placeDerivedActual([claim(), claim({ itemId: MERCH, itemName: 'Merchandise sales' })]);
    assert.equal(at.categoryId, FUNDRAISING);
    assert.equal(at.itemId, null);
  });

  it('lands nowhere when the lines are spread across categories', () => {
    const at = placeDerivedActual([claim(), claim({ categoryId: 'cat-other', categoryName: 'Events' })]);
    assert.equal(at.categoryId, null);
    assert.equal(at.itemId, null);
  });

  it('lands nowhere when nothing claims it — money raised against no plan at all', () => {
    assert.deepEqual(placeDerivedActual([]), {
      categoryId: null, categoryName: null, itemId: null, itemName: null,
    });
  });

  it('lands nowhere when the claiming lines carry no category (every pre-243 money-in line)', () => {
    // No backfill: lines written before this release name nothing, and must keep working.
    const at = placeDerivedActual([claim({ categoryId: null, categoryName: null, itemId: null, itemName: null })]);
    assert.equal(at.categoryId, null);
  });
});

describe('whyIncomeIsRefused — the WORD decides, not the plan', () => {
  /* ⚠⚠ THIS SUITE REPLACES `derivedIncomeKeys`, WHICH IS DELETED (owner ruling 2026-09-08).
     Those tests pinned a rule that read the season's budget LINES: every claimed pair was closed to
     typing, plus each pool's landing spot, because two fundraising lines in one category put the
     pool in that category's bucket. Careful, and answering the wrong question — it meant the guard
     fired on the team that had BUDGETED a fundraising line and let the identical double count
     through on the team that had not.

     The refusal is structural now: a word whose actual comes from a drive or a sponsor cannot take
     a typed income figure, whatever anybody planned. What follows is that rule, and it is
     deliberately short — a rule with no conditions has no edges to pin. */
  it('refuses a word a drive reports, and names the door', () => {
    const refusal = whyIncomeIsRefused({ name: 'Merchandise sales', actualSource: 'fundraiser' });
    assert.ok(refusal);
    // ⚠ THE SENTENCE POINTS SOMEWHERE. It is practically unreachable from the product — the words
    // are not in the "Other money in" list to pick — so whoever meets it arrived by API or from a
    // stale screen, and "record it elsewhere" without saying where is the least useful moment for
    // vagueness. It must also offer the whole-team route, which is the only way team-raised money
    // can be recorded at all.
    assert.match(refusal!, /Fundraising/);
    assert.match(refusal!, /whole team/);
  });

  it('refuses a word a sponsor reports, and points at the sponsor rather than the drive', () => {
    const refusal = whyIncomeIsRefused({ name: 'Grant', actualSource: 'sponsor' });
    assert.ok(refusal);
    assert.match(refusal!, /sponsor/);
    assert.equal(/whole team/.test(refusal!), false);
  });

  it('allows every typed word — the ordinary case, and the whole of "Other money in"', () => {
    assert.equal(whyIncomeIsRefused({ name: 'Interest', actualSource: 'typed' }), null);
    assert.equal(whyIncomeIsRefused({ name: 'Registration revenue', actualSource: 'typed' }), null);
  });

  it('does not depend on the plan at all — the same word answers the same way for any team', () => {
    /* The defect the claim-based version had: a team with no fundraising budget line saved the
       double count without complaint. There is no team-shaped input left to differ on. */
    assert.deepEqual(
      whyIncomeIsRefused({ name: 'Fundraising drive', actualSource: 'fundraiser' }),
      whyIncomeIsRefused({ name: 'Fundraising drive', actualSource: 'fundraiser' }),
    );
  });
});

describe('the two sources place separately — the legacy fallback', () => {
  it('places each source against its OWN lines rather than merging their claims', () => {
    /* ⚠ Drives and sponsors report two different totals. Merged, a fundraising figure would be
       placed using a sponsorship line's category — precise-looking and wrong.
       ⚠ THIS IS NOW THE FALLBACK, not the rule: since mig 285 each record names the line it is
       raising for and lands there. What still reaches this code is the residue — records written
       before the migration whose season's plan was too ambiguous to link safely. */
    const claims = [
      claim(),
      claim({ source: 'sponsor', categoryId: 'cat-sponsorship', categoryName: 'Sponsorship', itemId: 'item-team-sponsor', itemName: 'Team sponsorship' }),
    ];
    assert.equal(placeDerivedActual(claims.filter(c => c.source === 'fundraiser')).itemId, DRIVE);
    assert.equal(placeDerivedActual(claims.filter(c => c.source === 'sponsor')).itemId, 'item-team-sponsor');
    // Merged they would place nowhere at all, which is what makes the split load-bearing.
    assert.equal(placeDerivedActual(claims).categoryId, null);
  });
});
