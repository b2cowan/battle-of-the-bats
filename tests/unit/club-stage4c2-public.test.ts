import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bornFactsOf,
  bornMenuYears,
  bornPickHref,
  bornPlacesSentence,
  hasBornYears,
  joinSub,
  keepsBornYear,
  resolveBornPick,
  bornPickOf,
} from '../../lib/club-born-public.ts';
import { tryoutSeasonMeta, tryoutsRowSub, type TryoutStanding } from '../../lib/tryout-season.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BIRTH YEARS ON THE CLUB'S PUBLIC PAGES (Club Tier Stage 4c-2 Part A; words CLUB_TIER_STAGE4C2_COPY.md D1–D23). The rule
 * is lib/born-years.ts (pinned by club-stage4c2.test.ts); this pins how the public pages JOIN it: a place's years read under
 * its own sport's cut-off, the Born in menu, the pick in the address, which places a pick keeps, and the count sentence.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SEPT = { softball: { m: 9, d: 1 } };

describe('a place’s born line, read under its sport’s cut-off', () => {
  it('January 1 by default; the club’s own date for the sport it set', () => {
    assert.equal(bornFactsOf({ from: 2012, to: 2013 }, {}, 'softball').line, 'Born 2012–2013');
    assert.equal(bornFactsOf({ from: 2013, to: 2015 }, SEPT, 'softball').line, 'Born Sep 1, 2013 – Aug 31, 2015');
    // The cut-off is per sport: baseball is still on January 1.
    assert.equal(bornFactsOf({ from: 2012, to: 2013 }, SEPT, 'baseball').line, 'Born 2012–2013');
  });
  it('the sport’s mixed casing finds its cut-off', () => {
    assert.equal(bornFactsOf({ from: 2013, to: 2015 }, SEPT, 'Softball').cutoff.m, 9);
  });
  it('lower-case after a dot, and nothing at all with no years', () => {
    assert.equal(bornFactsOf({ from: 2014, to: 2015 }, {}, 'softball').meta, 'born 2014–2015');
    assert.equal(bornFactsOf({ from: null, to: null }, {}, 'softball').line, null);
    assert.equal(bornFactsOf({ from: null, to: null }, {}, 'softball').meta, null);
  });
  it('a pair a cut-off made unshowable says nothing but is still a place with years', () => {
    const f = bornFactsOf({ from: 2013, to: 2013 }, SEPT, 'softball');
    assert.equal(f.line, null);
    assert.equal(hasBornYears(f), true);
  });
  it('the tryout page meta, lower-case after the dot (D9–D11), and a team with none keeps today’s', () => {
    const season = { year: 2027, name: '2027 Season' };
    assert.equal(tryoutSeasonMeta(season, bornFactsOf({ from: 2012, to: 2013 }, {}, 'softball').meta), 'For the 2027 season · born 2012–2013');
    assert.equal(tryoutSeasonMeta(season, null), 'For the 2027 season');
    assert.equal(tryoutSeasonMeta(season), 'For the 2027 season');
    assert.equal(tryoutSeasonMeta({ year: null, name: 'Spring' }, 'born 2012–2013'), 'Spring · born 2012–2013');
  });
  it('a Tryouts row leads with the line (D8); a team with no years starts at the day', () => {
    const day = { startsAt: '2026-09-07T14:00:00.000Z', endsAt: null, status: 'scheduled', location: 'Lions Park', locationAddress: null, fieldNumber: null };
    const standing = { state: 'open', upcoming: [day], heldDays: ['2026-09-07'], last: null, lastDay: null } as TryoutStanding;
    const season = { year: 2027, name: '2027 Season' };
    assert.equal(tryoutsRowSub(standing, season, '2026-09-01', 'Born 2017–2018'), 'Born 2017–2018 · Mon, Sep 7 · Lions Park');
    assert.equal(tryoutsRowSub(standing, season, '2026-09-01', null), 'Mon, Sep 7 · Lions Park');
    assert.equal(tryoutsRowSub(standing, season, '2026-09-01'), 'Mon, Sep 7 · Lions Park');
    const noDays = { ...standing, upcoming: [] } as TryoutStanding;
    assert.equal(tryoutsRowSub(noDays, season, '2026-09-01', 'Born 2017–2018'), 'Born 2017–2018 · For the 2027 season');
  });
});

describe('the Born in menu (D17)', () => {
  const lakeshore = [
    { from: 2012, to: 2013 }, { from: 2014, to: 2015 }, { from: 2011, to: 2011 }, { from: 2013, to: 2013 }, { from: 2015, to: 2015 }, { from: null, to: null },
  ].map(y => bornFactsOf(y, {}, 'softball'));
  it('every year a place names, newest first; a range fills in', () => {
    assert.deepEqual(bornMenuYears(lakeshore, 2026), [2015, 2014, 2013, 2012, 2011]);
  });
  it('no years anywhere, no menu (no pill)', () => {
    assert.deepEqual(bornMenuYears([bornFactsOf({ from: null, to: null }, {}, 'softball')], 2026), []);
    assert.deepEqual(bornMenuYears([], 2026), []);
  });
  it('an open side adds only its own year; a future year is never offered from a range', () => {
    assert.deepEqual(bornMenuYears([bornFactsOf({ from: 2012, to: null }, {}, 'softball'), bornFactsOf({ from: null, to: 2008 }, {}, 'softball')], 2026), [2012, 2008]);
    assert.deepEqual(bornMenuYears([bornFactsOf({ from: 2025, to: 2030 }, {}, 'softball')], 2026), [2026, 2025]);
  });
  it('each place is read under its own cut-off, and an unshowable pair adds nothing', () => {
    const mixed = [bornFactsOf({ from: 2013, to: 2015 }, SEPT, 'softball'), bornFactsOf({ from: 2010, to: 2011 }, SEPT, 'baseball'), bornFactsOf({ from: 2014, to: 2014 }, SEPT, 'softball')];
    assert.deepEqual(bornMenuYears(mixed, 2026), [2015, 2014, 2013, 2011, 2010]);
  });
  it('the pick is read from the address and honoured only while the menu offers the year', () => {
    const menu = [2015, 2014, 2013];
    assert.equal(resolveBornPick('2014', menu), 2014);
    assert.equal(resolveBornPick(['2014', '2013'], menu), 2014);
    assert.equal(resolveBornPick('2030', menu), null);
    assert.equal(resolveBornPick('soon', menu), null);
    assert.equal(resolveBornPick(undefined, menu), null);
    assert.equal(resolveBornPick('2014', []), null);
  });
  it('bornPickOf: the menu the places name and the pick against it, in one call', () => {
    const places = [bornFactsOf({ from: 2014, to: 2015 }, {}, 'softball'), bornFactsOf({ from: null, to: null }, {}, 'softball')];
    assert.deepEqual(bornPickOf(places, '2014', 2026), { menu: [2015, 2014], pick: 2014 });
    assert.deepEqual(bornPickOf(places, '2009', 2026), { menu: [2015, 2014], pick: null });
    assert.deepEqual(bornPickOf([], '2014', 2026), { menu: [], pick: null });
  });
  it('the pick lives in the address; "Any year" is the bare path', () => {
    assert.equal(bornPickHref('/lynx/teams', 2015), '/lynx/teams?born=2015');
    assert.equal(bornPickHref('/lynx/teams', null), '/lynx/teams');
  });
});

describe('what a pick keeps (D18–D22)', () => {
  const teams = {
    fifteen: bornFactsOf({ from: 2012, to: 2013 }, {}, 'softball'),
    thirteen: bornFactsOf({ from: 2014, to: 2015 }, {}, 'softball'),
    sixteen: bornFactsOf({ from: 2011, to: 2011 }, {}, 'softball'),
    open: bornFactsOf({ from: 2012, to: null }, {}, 'softball'),
    development: bornFactsOf({ from: null, to: null }, {}, 'softball'),
  };
  const kept = (year: number | null) => Object.entries(teams).filter(([, f]) => keepsBornYear(f, year)).map(([k]) => k);
  it('no pick keeps everything', () => {
    assert.deepEqual(kept(null), ['fifteen', 'thirteen', 'sixteen', 'open', 'development']);
  });
  it('a year keeps the places that overlap it, an open side matches every year beyond it, and a team with none always stays', () => {
    assert.deepEqual(kept(2015), ['thirteen', 'open', 'development']);
    assert.deepEqual(kept(2013), ['fifteen', 'open', 'development']);
    assert.deepEqual(kept(2011), ['sixteen', 'development']);
  });
  it('a September club keeps both rows for a year two bands share', () => {
    const u13 = bornFactsOf({ from: 2012, to: 2014 }, SEPT, 'softball');
    const u11 = bornFactsOf({ from: 2014, to: 2016 }, SEPT, 'softball');
    assert.equal(keepsBornYear(u13, 2014) && keepsBornYear(u11, 2014), true);
    assert.equal(keepsBornYear(u13, 2015), false);
  });
  it('a pair the cut-off made unshowable stays in every list, as a team with none does', () => {
    assert.equal(keepsBornYear(bornFactsOf({ from: 2013, to: 2013 }, SEPT, 'softball'), 2020), true);
  });
  it('the meta counts places, a team or a division', () => {
    assert.equal(bornPlacesSentence(3, 2015), '3 places for a player born in 2015');
    assert.equal(bornPlacesSentence(1, 2015), '1 place for a player born in 2015');
    assert.equal(bornPlacesSentence(0, 2015), 'No places for a player born in 2015. Pick another year.');
  });
});

describe('the words around a place', () => {
  it('a line made of whatever parts exist', () => {
    assert.equal(joinSub(['Born 2015–2016', '2027 season']), 'Born 2015–2016 · 2027 season');
    assert.equal(joinSub([null, '2027 season']), '2027 season');
    assert.equal(joinSub(['Born 2015–2016', null, 'AAA']), 'Born 2015–2016 · AAA');
    assert.equal(joinSub([null, undefined, false]), null);
  });
});
