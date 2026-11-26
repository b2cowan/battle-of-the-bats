import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { placesOfTicks, resolveTicks, tickOptions, ticksOfPlaces, tickValue, type PickableField } from '../../lib/field-parts.ts';
import { rowPlacesWords } from '../../lib/club-schedule-words.ts';

/**
 * NEW SCHEDULE'S TICK LIST WITH A FIELD IN PARTS (Club schedules Stage 2, Session 2B; drawing round 2 tab 3, "with
 * halves", ruled Ask 2 A): a split field offers its parts flat in the row's Facilities list, a place and a place inside it
 * are never both ticked, and the box says it in words.
 */

const F1 = 'f-1', F2 = 'f-2', F3 = 'f-3', F4 = 'f-4', F5 = 'f-5', F6 = 'f-6';
const DOME: PickableField[] = [
  { id: F1, name: 'Field 1', sections: 4 },
  { id: F2, name: 'Field 2', sections: 2 },
  { id: F3, name: 'Field 3', sections: 1 },
  { id: F4, name: 'Field 4', sections: 1 },
  { id: F5, name: 'Field 5', sections: 1 },
  { id: F6, name: 'Field 6', sections: 1 },
];
const ORDER = DOME.map(f => f.id);

describe('the options: a split field offers its parts, flat', () => {
  it('as drawn: seven for a quartered field, three for a two-sided one, a plain name for the rest', () => {
    assert.deepEqual(tickOptions(DOME).map(o => o.label), [
      'Field 1 (whole)', 'Field 1, quarters A–B', 'Field 1, quarters C–D',
      'Field 1, quarter A', 'Field 1, quarter B', 'Field 1, quarter C', 'Field 1, quarter D',
      'Field 2 (whole)', 'Field 2, side A', 'Field 2, side B',
      'Field 3', 'Field 4', 'Field 5', 'Field 6',
    ]);
  });
  it('a field not split keeps its own id as the value; the whole of a split field is its id too', () => {
    const ids = tickOptions(DOME).map(o => o.id);
    assert.ok(ids.includes(F3) && ids.includes(F1) && ids.includes(`${F1}:3`) && ids.includes(`${F2}:12`));
  });
});

describe('a place and a place inside it are never both ticked', () => {
  const whole = tickValue(F1, 0), ab = tickValue(F1, 3), cd = tickValue(F1, 12), a = tickValue(F1, 1), b = tickValue(F1, 2), c = tickValue(F1, 4);
  it('a quarter unticks the whole field and the half it is in', () => {
    assert.deepEqual(resolveTicks([whole], [whole, a]), [a]);
    assert.deepEqual(resolveTicks([ab, cd], [ab, cd, c]), [ab, c]);
  });
  it('a half unticks the whole field and its two quarters, and leaves the other half’s quarters', () => {
    assert.deepEqual(resolveTicks([whole], [whole, ab]), [ab]);
    assert.deepEqual(resolveTicks([a, b, c], [a, b, c, ab]), [c, ab]);
  });
  it('the whole field unticks every part, and another field is never touched', () => {
    assert.deepEqual(resolveTicks([ab, c, F3, tickValue(F2, 3)], [ab, c, F3, tickValue(F2, 3), whole]), [F3, tickValue(F2, 3), whole]);
  });
  it('unticking unticks only that one', () => {
    assert.deepEqual(resolveTicks([ab, c], [c]), [c]);
  });
});

describe('ticks and the row’s places', () => {
  it('each field once, in the venue’s order, with its parts; whole fields name none', () => {
    const p = placesOfTicks([F3, tickValue(F1, 4), tickValue(F1, 3), tickValue(F1, 8), tickValue(F2, 3), tickValue(F2, 12)], ORDER);
    assert.deepEqual(p, { facilityIds: [F1, F2, F3], parts: { [F1]: [3, 4, 8], [F2]: [3, 12] } });
    assert.deepEqual(placesOfTicks([F4, F3], ORDER), { facilityIds: [F3, F4] });
  });
  it('round trip', () => {
    const p = { facilityIds: [F1, F2, F5], parts: { [F1]: [3, 4, 8], [F2]: [3] } };
    assert.deepEqual(placesOfTicks(ticksOfPlaces(p), ORDER), p);
  });
});

describe('the box, in words', () => {
  it('no field in parts: the words it always had', () => {
    assert.equal(rowPlacesWords(DOME, { facilityIds: ORDER }), 'Fields 1–6');
    assert.equal(rowPlacesWords(DOME, { facilityIds: [F1, F2] }), 'Field 1 and Field 2');
  });
  it('the drawing’s answers', () => {
    assert.equal(rowPlacesWords(DOME, { facilityIds: [F1, F2], parts: { [F1]: [1, 2, 4, 8], [F2]: [3, 12] } }), 'Field 1 in four quarters, Field 2 in two sides');
    assert.equal(rowPlacesWords(DOME, { facilityIds: [F1, F2], parts: { [F1]: [3, 4, 8], [F2]: [3, 12] } }), 'Field 1 quarters A–B, C and D, Field 2 in two sides');
    assert.equal(rowPlacesWords([{ id: F1, name: 'Field 1', sections: 2 }, { id: F2, name: 'Field 2', sections: 2 }],
      { facilityIds: [F1, F2], parts: { [F1]: [3, 12], [F2]: [3] } }), 'Field 1 in two sides, Field 2 side A');
    assert.equal(rowPlacesWords(DOME, { facilityIds: [F1], parts: { [F1]: [1, 4] } }), 'Field 1 quarters A and C');
  });
  it('whole fields beside a split one run together as before', () => {
    assert.equal(rowPlacesWords(DOME, { facilityIds: ORDER, parts: { [F2]: [3, 12] } }), 'Field 1, Field 2 in two sides, Fields 3–6');
  });
});
