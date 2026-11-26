import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  fieldPartName,
  isLegalMask,
  legalMasks,
  maskOf,
  partFactor,
  partMasks,
  partsOverlap,
  partWords,
  samePlace,
  sectionRange,
  sectionsOf,
  splitFieldWords,
  splitLabel,
  splitReadWords,
  STORABLE_MASKS,
} from '../../lib/field-parts.ts';

describe('field-parts — the storage table (plan §5, mig 541)', () => {
  it('legal masks per split, whole first', () => {
    assert.deepEqual([...legalMasks(1)], [0]);
    assert.deepEqual([...legalMasks(2)], [0, 3, 12]);
    assert.deepEqual([...legalMasks(4)], [0, 3, 12, 1, 2, 4, 8]);
    assert.deepEqual([...partMasks(4)], [3, 12, 1, 2, 4, 8]);
    assert.equal(legalMasks(4).length, 7, 'seven options on a quartered field (round 2 Ask 2 A)');
  });

  it('B–C (6) and 15 are never legal; a side is never legal on a field not split', () => {
    for (const s of [1, 2, 4] as const) {
      assert.equal(isLegalMask(6, s), false);
      assert.equal(isLegalMask(15, s), false);
    }
    assert.equal(isLegalMask(3, 1), false);
    assert.equal(isLegalMask(1, 2), false, 'a quarter is not a part of a two-sided field');
    assert.equal(isLegalMask(3, 2), true);
    assert.equal(isLegalMask(3, 4), true);
  });

  it('reads stored values safely', () => {
    assert.equal(sectionsOf(2), 2);
    assert.equal(sectionsOf('4'), 4);
    assert.equal(sectionsOf(3), 1);
    assert.equal(sectionsOf(null), 1);
    assert.equal(maskOf(6), 0, 'an impossible mask reads as the whole field (safe)');
    assert.equal(maskOf(undefined), 0);
    assert.equal(maskOf(12), 12);
  });
});

describe('field-parts — overlap', () => {
  it('the whole field meets every part', () => {
    for (const m of STORABLE_MASKS) assert.equal(partsOverlap(0, m), true, `0 vs ${m}`);
    assert.equal(partsOverlap(null, 3), true, 'a reader carrying no mask reads the whole field');
  });
  it('a part meets the parts that share a quarter, and only those', () => {
    assert.equal(partsOverlap(3, 12), false, 'side A beside side B');
    assert.equal(partsOverlap(1, 3), true, 'quarter A beside quarters A–B');
    assert.equal(partsOverlap(1, 2), false, 'quarter A beside quarter B');
    assert.equal(partsOverlap(2, 3), true);
    assert.equal(partsOverlap(4, 3), false, 'quarter C beside quarters A–B');
    assert.equal(partsOverlap(12, 8), true);
  });
  it('agrees with the database range for every pair', () => {
    for (const a of STORABLE_MASKS) for (const b of STORABLE_MASKS) {
      const [al, ah] = sectionRange(a);
      const [bl, bh] = sectionRange(b);
      assert.equal(partsOverlap(a, b), al < bh && bl < ah, `${a} vs ${b}`);
    }
  });
  it('samePlace compares the field first', () => {
    assert.equal(samePlace({ facilityId: 'f1', sectionMask: 3 }, { facilityId: 'f1', sectionMask: 12 }), false);
    assert.equal(samePlace({ facilityId: 'f1', sectionMask: 3 }, { facilityId: 'f1' }), true);
    assert.equal(samePlace({ facilityId: 'f1' }, { facilityId: 'f2' }), false);
    assert.equal(samePlace({ facilityId: null }, { facilityId: null }), false, 'no field on either side is not this rule');
  });
});

describe('field-parts — size', () => {
  it('whole 1, a side or half ½, a quarter ¼', () => {
    assert.equal(partFactor(0), 1);
    assert.equal(partFactor(3), 0.5);
    assert.equal(partFactor(12), 0.5);
    assert.equal(partFactor(4), 0.25);
    assert.equal(partFactor(null), 1);
  });
});

describe('field-parts — the words (working words)', () => {
  it('a part says its size', () => {
    assert.equal(partWords(0, 2), null);
    assert.equal(partWords(3, 2), 'side A');
    assert.equal(partWords(12, 2), 'side B');
    assert.equal(partWords(3, 4), 'quarters A–B');
    assert.equal(partWords(12, 4), 'quarters C–D');
    assert.equal(partWords(4, 4), 'quarter C');
    assert.equal(partWords(8, 4), 'quarter D');
  });
  it('a past booking the split no longer offers reads in quarter words', () => {
    assert.equal(partWords(3, 1), 'quarters A–B');
    assert.equal(partWords(1, 2), 'quarter A');
  });
  it('field and split names', () => {
    assert.equal(fieldPartName('Field 2', 3, 2), 'Field 2 side A');
    assert.equal(fieldPartName('Field 1', 3, 2, ', '), 'Field 1, side A');
    assert.equal(fieldPartName('Field 1', 0, 4), 'Field 1');
    assert.equal(splitFieldWords('Field 1', 2), 'Field 1 in two sides');
    assert.equal(splitFieldWords('Field 1', 4), 'Field 1 in four quarters');
    assert.equal(splitFieldWords('Field 1', 1), 'Field 1');
    assert.equal(splitLabel(1), 'Not split');
    assert.equal(splitLabel(2), 'Two sides');
    assert.equal(splitLabel(4), 'Four quarters');
    assert.equal(splitReadWords(4), 'Four quarters, A to D');
    assert.equal(splitReadWords(2), 'Two sides, A and B');
    assert.equal(splitReadWords(1), null);
  });
});

describe('field-parts — stays client-safe and matches the migration', () => {
  it('imports nothing', () => {
    const src = readFileSync(new URL('../../lib/field-parts.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /^\s*import\s/m);
  });
  it('the migration carries the same legal lists and ranges', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/541_a_field_splits_into_parts.sql', import.meta.url), 'utf8');
    assert.match(sql, /when 2 then p_mask in \(0, 3, 12\)/);
    assert.match(sql, /when 4 then p_mask in \(0, 1, 2, 4, 8, 3, 12\)/);
    for (const m of [1, 2, 4, 8, 3, 12]) {
      const [lo, hi] = sectionRange(m);
      assert.match(sql, new RegExp(`when ${m} +then int4range\\(${lo}, ${hi}\\)`), `range for ${m}`);
    }
  });
});
