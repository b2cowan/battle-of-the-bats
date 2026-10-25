import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JAN_1 } from '../../lib/born-years.ts';
import {
  EVEN_AGES, ODD_AGES, ageGroupsFoot, ageGroupsWarnings, ageLabel, detectNameStyle, isOddAge, nextGroupName, parseAgeName, restyleName,
  type AgeGroupRow,
} from '../../lib/house-league-age-groups.ts';

/** Club Tier 9b-1, Part 2: the Add age groups window's rules (copy §3). */
const Y = 2026;
const row = (name: string, from = '', to = '', capacity = '12', price = '165'): AgeGroupRow =>
  ({ key: name, group: name.split(' ')[0], name, from, to, capacity, price });

describe('nextGroupName: a second division for one age takes the next letter (9b·13)', () => {
  it('the first is the group itself, then B, C', () => {
    assert.equal(nextGroupName('U10', []), 'U10');
    assert.equal(nextGroupName('U10', ['U10']), 'U10 B');
    assert.equal(nextGroupName('U10', ['U10', 'U10 B']), 'U10 C');
    assert.equal(nextGroupName('u10', ['U10 A']), 'u10 B');
    assert.equal(nextGroupName('U12', ['U10', 'U10 B']), 'U12');
  });
});

describe('name style: U12 and 12U are one age written two ways', () => {
  it('labels an age in either style', () => {
    assert.equal(ageLabel(12, 'pre'), 'U12');
    assert.equal(ageLabel(12, 'suf'), '12U');
  });
  it('the quick picks: evens first, odds behind More ages, nothing in both', () => {
    assert.deepEqual([...EVEN_AGES], [6, 8, 10, 12, 14, 16, 18]);
    assert.deepEqual([...ODD_AGES], [7, 9, 11, 13, 15, 17]);
    assert.ok(isOddAge(13) && !isOddAge(12));
  });
  it('reads the age, the style and the letter out of a name; anything else is not an age', () => {
    assert.deepEqual(parseAgeName('U12'), { age: 12, style: 'pre', letter: '' });
    assert.deepEqual(parseAgeName('12U'), { age: 12, style: 'suf', letter: '' });
    assert.deepEqual(parseAgeName('u12 b'), { age: 12, style: 'pre', letter: 'B' });
    assert.deepEqual(parseAgeName('12U B'), { age: 12, style: 'suf', letter: 'B' });
    assert.equal(parseAgeName('Open'), null);
    assert.equal(parseAgeName('U12 Girls'), null);
    assert.equal(parseAgeName('Spring U12'), null);
  });
  it('a switch keeps the age and the letter, and leaves a name that is not an age alone', () => {
    assert.equal(restyleName('U12', 'suf'), '12U');
    assert.equal(restyleName('U12 B', 'suf'), '12U B');
    assert.equal(restyleName('12U C', 'pre'), 'U12 C');
    assert.equal(restyleName('Open', 'suf'), 'Open');
    assert.equal(restyleName('U12 Girls', 'suf'), 'U12 Girls');
  });
  it('a season already written one way sets the style; none to read means no answer', () => {
    assert.equal(detectNameStyle(['12U', '14U B']), 'suf');
    assert.equal(detectNameStyle(['U12', 'U14']), 'pre');
    assert.equal(detectNameStyle(['U12', '14U']), 'pre');
    assert.equal(detectNameStyle(['Open', 'Mixed']), null);
    assert.equal(detectNameStyle([]), null);
  });
  it('a second division for one age takes the next letter in either style', () => {
    assert.equal(nextGroupName('12U', ['12U']), '12U B');
    assert.equal(nextGroupName('12U', ['12U', '12U B']), '12U C');
  });
});

describe('ageGroupsFoot: the first missing thing, in order', () => {
  it('nothing tapped', () => {
    assert.equal(ageGroupsFoot([], JAN_1, Y).desk, 'Tap the age groups you run.');
  });
  it('birth years first, named for one or two, counted for three', () => {
    assert.equal(ageGroupsFoot([row('U8', '2019', '2020'), row('U14')], JAN_1, Y).desk, '2 new divisions · U14 still needs its birth years');
    assert.equal(ageGroupsFoot([row('U14'), row('U16')], JAN_1, Y).desk, '2 new divisions · U14 and U16 still need their birth years');
    assert.equal(ageGroupsFoot([row('U12'), row('U14'), row('U16'), row('U8', '2019', '2020')], JAN_1, Y).phone, '4 new · 3 still need birth years');
  });
  it('then size, then price; ready says only what it will make', () => {
    assert.equal(ageGroupsFoot([row('U14', '2012', '2013', '')], JAN_1, Y).desk, '1 new division · U14 still needs a size');
    assert.equal(ageGroupsFoot([row('U14', '2012', '2013', '12', '')], JAN_1, Y).desk, '1 new division · U14 still needs a price');
    const ready = ageGroupsFoot([row('U14', '2012', '2013', '12', '0')], JAN_1, Y);
    assert.equal(ready.missing, null);
    assert.equal(ready.desk, '1 new division');
  });
  it('an early-bird amount is optional, and when typed it can’t top the price', () => {
    const withEarly = (early: string) => ({ ...row('U14', '2012', '2013', '12', '165'), earlyPrice: early });
    assert.equal(ageGroupsFoot([withEarly('')], JAN_1, Y).missing, null);
    assert.equal(ageGroupsFoot([withEarly('145')], JAN_1, Y).missing, null);
    assert.equal(ageGroupsFoot([withEarly('165')], JAN_1, Y).missing, null);
    assert.equal(ageGroupsFoot([withEarly('170')], JAN_1, Y).desk, '1 new division · U14 has an early-bird amount above the price');
    assert.equal(ageGroupsFoot([withEarly('-1')], JAN_1, Y).desk, '1 new division · U14 has an early-bird amount that isn’t dollars and cents');
    assert.equal(ageGroupsFoot([withEarly('1.234')], JAN_1, Y).missing, 'early');
    assert.equal(ageGroupsFoot([{ ...row('U14', '2012', '2013', '12', '0'), earlyPrice: '5' }], JAN_1, Y).missing, 'early');
  });
  it('a name used twice blocks (a family picks by name)', () => {
    assert.equal(ageGroupsFoot([row('U10', '2016', '2017')], JAN_1, Y, ['U10']).missing, 'name');
  });
});

describe('ageGroupsWarnings: gaps and partial overlaps, never the deliberate A and B pair', () => {
  it('a missing year between groups is a gap', () => {
    assert.deepEqual(ageGroupsWarnings([row('U8', '2019', '2020'), row('U12', '2015', '2016')], [], JAN_1, Y),
      ['No division takes children born in 2017–2018. A child born then won’t fit any division.']);
  });
  it('a partial overlap is said; identical years are not', () => {
    assert.deepEqual(ageGroupsWarnings([row('U10', '2016', '2017'), row('U12', '2015', '2016')], [], JAN_1, Y),
      ['U10 and U12 both take 2016. A child born then can choose either.']);
    assert.deepEqual(ageGroupsWarnings([row('U10 B', '2016', '2017')], [{ name: 'U10', born: { from: 2016, to: 2017 } }], JAN_1, Y), []);
  });
});
