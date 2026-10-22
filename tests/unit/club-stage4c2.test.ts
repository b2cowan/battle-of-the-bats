import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JAN_1,
  cutoffFor,
  cleanCutoffs,
  cutoffWords,
  bornLine,
  bornMeta,
  bornHint,
  divisionBornHint,
  checkBornYears,
  bornShowable,
  bornMatchesYear,
  rollBornYears,
  bornYearChoices,
  oneYearPlaces,
  parseBornParam,
  storedCutoffs,
} from '../../lib/born-years.ts';
import { pastYearHint, pastYearsMentioned } from '../../lib/past-year-hint.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BIRTH YEARS, ONE RULE (Club Tier Stage 4c-2 Part A; drawings ruled 2026-10-22, Asks 4–7 + round 2's club cut-off per
 * sport; words CLUB_TIER_STAGE4C2_COPY.md A, B, C12, D). Every surface calls lib/born-years.ts; nothing formats a born
 * line by hand. With cut-off M/D the first box is the year of the FROM-date (M/D of that year); the second is the year of
 * the TO-date, the day before M/D, dated in the typed year (Jan 1 → Dec 31; Sep 1 → Aug 31).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SEP_1 = { m: 9, d: 1 };
const y = (from: number | null, to: number | null) => ({ from, to });

describe('a sport’s cut-off: absent is January 1, read through the sport id', () => {
  it('reads the normalized sport, and anything missing or malformed is January 1', () => {
    assert.deepEqual(cutoffFor({ softball: SEP_1 }, 'Softball'), SEP_1);
    assert.deepEqual(cutoffFor({ softball: SEP_1 }, ' SOFTBALL '), SEP_1);
    assert.deepEqual(cutoffFor({ softball: SEP_1 }, 'baseball'), JAN_1);
    assert.deepEqual(cutoffFor(null, 'softball'), JAN_1);
    assert.deepEqual(cutoffFor({ softball: { m: 2, d: 29 } }, 'softball'), JAN_1, 'no Feb 29');
    assert.deepEqual(cutoffFor({ softball: { m: '9', d: 1 } }, 'softball'), JAN_1);
    assert.deepEqual(cutoffFor({ softball: SEP_1 }, null), SEP_1, 'a blank sport is the legacy softball');
  });

  it('cleans a stored map: January 1 is written as absent, a bad date is refused', () => {
    assert.deepEqual(cleanCutoffs({ softball: SEP_1, baseball: { m: 1, d: 1 } }), { softball: SEP_1 });
    assert.equal(cleanCutoffs({ softball: { m: 4, d: 31 } }), null);
    assert.equal(cleanCutoffs({ softball: { m: 2, d: 29 } }), null);
    assert.equal(cleanCutoffs([]), null);
  });

  it('says the date long and short', () => {
    assert.equal(cutoffWords(SEP_1), 'September 1');
    assert.equal(cutoffWords(JAN_1), 'January 1');
    assert.equal(cutoffWords(SEP_1, 'short'), 'Sep 1');
  });
});

describe('what families read: every shape, both cut-offs (copy D1–D5)', () => {
  it('January 1', () => {
    assert.equal(bornLine(y(2012, 2013), JAN_1), 'Born 2012–2013');
    assert.equal(bornLine(y(2013, 2013), JAN_1), 'Born 2013');
    assert.equal(bornLine(y(2012, null), JAN_1), 'Born 2012 or later');
    assert.equal(bornLine(y(null, 2008), JAN_1), 'Born 2008 or earlier');
    assert.equal(bornLine(y(null, null), JAN_1), null, 'nothing at all — never "Born —" or "All ages"');
  });

  it('September 1: the boxes sit inside dates; the to-date alone is said as the day after it', () => {
    assert.equal(bornLine(y(2013, 2015), SEP_1), 'Born Sep 1, 2013 – Aug 31, 2015');
    assert.equal(bornLine(y(2013, 2014), SEP_1), 'Born Sep 1, 2013 – Aug 31, 2014', 'one band');
    assert.equal(bornLine(y(2013, null), SEP_1), 'Born on or after Sep 1, 2013');
    assert.equal(bornLine(y(null, 2014), SEP_1), 'Born before Sep 1, 2014');
    assert.equal(bornLine(y(null, null), SEP_1), null);
  });

  it('the day before a cut-off is computed, a leap year included', () => {
    assert.equal(bornLine(y(2014, 2016), { m: 3, d: 1 }), 'Born Mar 1, 2014 – Feb 29, 2016');
    assert.equal(bornLine(y(2014, 2015), { m: 3, d: 1 }), 'Born Mar 1, 2014 – Feb 28, 2015');
    assert.equal(bornLine(y(2014, 2016), { m: 8, d: 15 }), 'Born Aug 15, 2014 – Aug 14, 2016');
  });

  it('the same year twice off January 1 is unshowable (C12): no line, and it says so', () => {
    assert.equal(bornShowable(y(2013, 2013), SEP_1), false);
    assert.equal(bornLine(y(2013, 2013), SEP_1), null);
    assert.equal(bornShowable(y(2013, 2013), JAN_1), true);
  });

  it('in the tryout meta the line is lower-case after the dot', () => {
    assert.equal(bornMeta(y(2012, 2013), JAN_1), 'born 2012–2013');
    assert.equal(bornMeta(y(null, 2014), SEP_1), 'born before Sep 1, 2014');
    assert.equal(bornMeta(y(null, null), JAN_1), null);
  });
});

describe('the hint under the boxes (copy A4–A11, B3, C12b)', () => {
  it('says what families see; the "leave a box empty" sentence only while both are empty', () => {
    assert.equal(bornHint(y(null, null), JAN_1), 'Families see no birth years yet. Leave a box empty for no limit on that side.');
    assert.equal(bornHint(y(2012, 2013), JAN_1), 'Families see “Born 2012–2013”.');
    assert.equal(bornHint(y(2013, null), SEP_1), 'Families see “Born on or after Sep 1, 2013”.');
  });

  it('the division window names the division', () => {
    assert.equal(divisionBornHint(y(2014, 2015), JAN_1), 'Families see “Born 2014–2015” beside this division.');
    assert.equal(divisionBornHint(y(null, null), JAN_1), 'Families see no birth years for this division. Leave a box empty for no limit on that side.');
  });
});

describe('the checks hold a value with its reason, never save it (copy A15–A18)', () => {
  const NOW = 2026;
  it('a clean pair saves, either box may be empty', () => {
    assert.deepEqual(checkBornYears('2012', '2013', JAN_1, NOW), { ok: true, years: y(2012, 2013) });
    assert.deepEqual(checkBornYears(' 2012 ', '', JAN_1, NOW), { ok: true, years: y(2012, null) });
    assert.deepEqual(checkBornYears('', '', SEP_1, NOW), { ok: true, years: y(null, null) });
    assert.deepEqual(checkBornYears('2013', '2013', JAN_1, NOW), { ok: true, years: y(2013, 2013) });
    assert.deepEqual(checkBornYears('2026', '2026', JAN_1, NOW), { ok: true, years: y(2026, 2026) }, 'this year is fine');
  });

  it('not a four-digit year', () => {
    for (const bad of ['13', '20133', '2o13', '1850', '2013.5']) {
      assert.deepEqual(checkBornYears(bad, '', JAN_1, NOW), { ok: false, held: 'Use a four-digit year, like 2013, to save it.' }, bad);
    }
  });

  it('a year after this calendar year', () => {
    assert.deepEqual(checkBornYears('2025', '2027', JAN_1, NOW), { ok: false, held: 'A birth year can’t be after 2026.' });
  });

  it('the earlier one second — on the years for January 1, on the DATES for any other cut-off', () => {
    assert.deepEqual(checkBornYears('2014', '2012', JAN_1, NOW), { ok: false, held: 'Put the earlier year first to save it.' });
    assert.deepEqual(checkBornYears('2013', '2013', SEP_1, NOW), {
      ok: false, held: 'Aug 31, 2013 comes before Sep 1, 2013. Make the second year later to save it.',
    });
    assert.deepEqual(checkBornYears('2014', '2013', SEP_1, NOW), {
      ok: false, held: 'Aug 31, 2013 comes before Sep 1, 2014. Make the second year later to save it.',
    });
  });
});

describe('Born in: one calendar year against a range (overlap; an open side matches every year beyond it)', () => {
  it('January 1', () => {
    assert.equal(bornMatchesYear(y(2012, 2013), JAN_1, 2012), true);
    assert.equal(bornMatchesYear(y(2012, 2013), JAN_1, 2014), false);
    assert.equal(bornMatchesYear(y(2012, null), JAN_1, 2019), true);
    assert.equal(bornMatchesYear(y(null, 2008), JAN_1, 1990), true);
    assert.equal(bornMatchesYear(y(null, 2008), JAN_1, 2009), false);
  });

  it('a team with no years, or an unshowable pair, is in every list', () => {
    assert.equal(bornMatchesYear(y(null, null), JAN_1, 2015), true);
    assert.equal(bornMatchesYear(y(2013, 2013), SEP_1, 2001), true);
  });

  it('a September club: two teams can match one year, and the dates say which', () => {
    const u13 = y(2012, 2014); // Sep 1, 2012 – Aug 31, 2014
    const u11 = y(2014, 2016); // Sep 1, 2014 – Aug 31, 2016
    assert.equal(bornMatchesYear(u13, SEP_1, 2014), true);
    assert.equal(bornMatchesYear(u11, SEP_1, 2014), true);
    assert.equal(bornMatchesYear(u11, SEP_1, 2013), false);
  });

  it('the year list is every year a place names, newest first; open sides add only their own year', () => {
    assert.deepEqual(bornYearChoices([y(2012, 2013), y(2015, null), y(null, null), y(null, 2010)], JAN_1, 2026), [2015, 2013, 2012, 2010]);
    assert.deepEqual(bornYearChoices([y(2012, 2014)], SEP_1, 2026), [2014, 2013, 2012]);
    assert.deepEqual(bornYearChoices([y(null, null)], JAN_1, 2026), [], 'nothing to pick: no pill');
  });

  it('the address carries the pick, and a junk value is no pick', () => {
    assert.equal(parseBornParam('2015'), 2015);
    assert.equal(parseBornParam('15'), null);
    assert.equal(parseBornParam(undefined), null);
    assert.equal(parseBornParam(['2015', '2016']), 2015);
  });
});

describe('Start next season: one year later; an empty box stays empty', () => {
  it('rolls each side', () => {
    assert.deepEqual(rollBornYears(y(2012, 2013)), y(2013, 2014));
    assert.deepEqual(rollBornYears(y(2012, null)), y(2013, null));
    assert.deepEqual(rollBornYears(y(null, null)), y(null, null));
  });
});

describe('moving a sport off January 1 (C12): the one-year places it would hide', () => {
  it('counts the places whose two years are the same, only when the new date is not January 1', () => {
    const places = [y(2013, 2013), y(2012, 2013), y(null, null), y(2014, 2014)];
    assert.equal(oneYearPlaces(places, SEP_1), 2);
    assert.equal(oneYearPlaces(places, JAN_1), 0);
  });
});

describe('the past-year hint skips birth years (Ask 11)', () => {
  const NOW = 2026;
  it('a year with "born" or "birth" around it is not flagged', () => {
    for (const text of [
      'Open to players born 2012 and 2013.',
      'Players born in 2012–2013 may try out.',
      'For 2012 and 2013 birth years.',
      'Born 2012 or 2013, U13.',
      'Birth year 2011 only.',
    ]) {
      assert.deepEqual(pastYearsMentioned(text, NOW), [], text);
      assert.equal(pastYearHint(text, NOW), null, text);
    }
  });

  it('still flags a past year that is not a birth year, beside one that is', () => {
    assert.deepEqual(pastYearsMentioned('Born 2012 and 2013. Fees as in 2025.', NOW), [2025]);
    // /review 2026-10-22: sharing a sentence with "born" is not enough — 2025 here is a stale season.
    assert.deepEqual(pastYearsMentioned('Tryouts for 2025 are for players born in 2012 and 2013.', NOW), [2025]);
    assert.deepEqual(pastYearsMentioned('Our 2019 birthday party was a hit.', NOW), [2019], '"birthday" is not a birth year');
    assert.deepEqual(pastYearsMentioned('Players born between 2010, 2011 and 2012.', NOW), []);
    assert.equal(pastYearHint('Our 2024 champions return.', NOW), 'Mentions 2024 — still true?');
  });

  it('the founding-year skip still holds', () => {
    assert.deepEqual(pastYearsMentioned('Founded in 1998.', NOW), []);
  });
});

describe('the stored cut-off map: one parser for every organization mapper', () => {
  it('an object is itself; null, a missing column, an array or a scalar is no cut-offs', () => {
    const map = { softball: { m: 9, d: 1 } };
    assert.equal(storedCutoffs(map), map);
    for (const raw of [null, undefined, [], 'x', 5]) assert.deepEqual(storedCutoffs(raw), {});
  });
});
