import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { championCards, hostCardView, HOST_OPEN_ROWS } from '../../lib/public-host-card.ts';
import type { TierChampion } from '../../lib/champions.ts';

/**
 * THE HOST CARD AND THE CHAMPIONS (Public tournament pages Stage 2 Part 3, plan §5 and §6, Ask 4 / Ask B).
 */
const row = (n: number) => ({ key: `r${n}`, href: `/club/r${n}`, title: `Item ${n}`, sub: n === 1 ? 'Sign up by Nov 1' : null, deadline: null });
const hosted = { kind: 'hosted' as const, name: 'Riverdale Minor Ball Association', href: '/riverdale' };
const base = { host: hosted, openNow: [row(1), row(2)], logoUrl: null, isPreview: false, clubHref: '/riverdale' };

describe('the host card exists only for an organizer with a public club page', () => {
  it('hosted + an answered open-now read: the card, initials when there is no logo', () => {
    const v = hostCardView(base)!;
    assert.equal(v.name, 'Riverdale Minor Ball Association');
    assert.equal(v.initials, 'RM');
    assert.equal(v.href, '/riverdale');
    assert.deepEqual(v.open.map(o => o.title), ['Item 1', 'Item 2']);
  });
  it('a closed or absent club site (the read is null): no card, whatever the door says', () => {
    assert.equal(hostCardView({ ...base, openNow: null }), null);
  });
  it('"Run by" (no door) and no host at all: no card', () => {
    assert.equal(hostCardView({ ...base, host: { kind: 'run', name: 'Riverdale' } }), null);
    assert.equal(hostCardView({ ...base, host: null }), null);
  });
  it('nothing open: the card still stands (it says the club runs teams all year)', () => {
    assert.deepEqual(hostCardView({ ...base, openNow: [] })!.open, []);
  });
  it('lists at most the first few items', () => {
    const v = hostCardView({ ...base, openNow: [row(1), row(2), row(3), row(4), row(5)] })!;
    assert.equal(v.open.length, HOST_OPEN_ROWS);
  });
  it('the organizer\'s admin preview is plain text: no link anywhere on the card', () => {
    const v = hostCardView({ ...base, isPreview: true })!;
    assert.equal(v.href, null);
    assert.ok(v.open.every(o => o.href === null));
  });
});

describe('the champions', () => {
  const champ = (over: Partial<TierChampion>): TierChampion => ({
    division: 'U11', tierLabel: null, isTopTier: true, champion: 'Lightning', runnerUp: 'Pirates', championScore: 7, runnerUpScore: 4, ...over,
  } as TierChampion);

  it('a single bracket: the score and "in the championship"; no division line when there is one division', () => {
    const [c] = championCards([champ({})], false);
    assert.equal(c.division, null);
    assert.equal(c.badge, null);
    assert.equal(c.beat, 'Beat Pirates 7–4 in the championship');
  });
  it('several divisions name the division', () => {
    assert.equal(championCards([champ({})], true)[0].division, 'U11');
  });
  it('tiers carry the shipped badge words; a lower tier is not "the championship"', () => {
    const [top, lower] = championCards([champ({ tierLabel: 'Gold' }), champ({ tierLabel: 'Silver', isTopTier: false, champion: 'Storm' })], true);
    assert.equal(top.badge, 'Gold · Champion');
    assert.equal(lower.badge, 'Silver Champion');
    assert.equal(lower.beat, 'Beat Pirates 7–4');
  });
  it('no loser named: no "Beat" line; no score: the name alone', () => {
    assert.equal(championCards([champ({ runnerUp: null })], false)[0].beat, null);
    assert.equal(championCards([champ({ championScore: null, runnerUpScore: null })], false)[0].beat, 'Beat Pirates in the championship');
  });
});
