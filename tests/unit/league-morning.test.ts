import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { leagueMorning, type LeagueMorningInput } from '../../lib/league-morning.ts';
import { readCode } from './_source-code.ts';

/**
 * THE LEAGUE ROLES' "THIS MORNING" (Club Tier Stage 13b, A3; F-NAV-6): the league admin's two tiles and the registrar's three,
 * on the season page, from the figures that page already reads.
 */
const base: LeagueMorningInput = {
  role: 'league_registrar', seasonStatus: 'registration_open', seasonId: 's1',
  summary: { pendingReviewCount: 15, oldestPendingAt: '2026-10-25T14:00:00Z', unplacedCount: 8, waitlistCount: 3 },
  divisions: [
    { name: 'U9 Rookie', capacity: 12, heldCount: 12, waitlistCount: 3 },
    { name: 'U11', capacity: 14, heldCount: 9, waitlistCount: 0 },
  ],
  money: { owing: 1740, owingPlayers: 12 },
  base: '/harbourtown/admin',
};
const keys = (i: Partial<LeagueMorningInput>) => leagueMorning({ ...base, ...i }).map(t => t.key);

describe('who gets a This morning', () => {
  it('the registrar gets three tiles, the league admin two, in the drawn order', () => {
    assert.deepEqual(keys({}), ['review', 'owing', 'waitlist']);
    assert.deepEqual(keys({ role: 'league_admin' }), ['review', 'teams']);
  });
  it('nobody else does: the owner, the admin and a treasurer have the club’s own', () => {
    for (const role of ['owner', 'admin', 'treasurer', null, undefined]) assert.deepEqual(keys({ role }), [], String(role));
  });
  it('a getting-ready or finished season has none', () => {
    for (const seasonStatus of ['draft', 'completed', 'archived']) assert.deepEqual(keys({ seasonStatus }), [], seasonStatus);
    for (const seasonStatus of ['registration_open', 'registration_closed', 'active']) assert.ok(keys({ seasonStatus }).length > 0, seasonStatus);
  });
});

describe('what the tiles say', () => {
  const tile = (key: string, i: Partial<LeagueMorningInput> = {}) => leagueMorning({ ...base, ...i }).find(t => t.key === key)!;

  it('To review shows the full count and the oldest day', () => {
    assert.equal(tile('review').figure, '15');
    assert.equal(tile('review').sub, 'registrations · oldest Oct 25');
  });
  it('Still owing counts players, never families', () => {
    assert.equal(tile('owing').figure, '$1,740');
    assert.equal(tile('owing').sub, '12 players');
  });
  it('Still owing is absent, not greyed, when the reader cannot read the season’s money', () => {
    assert.deepEqual(keys({ money: null }), ['review', 'waitlist']);
  });
  it('Waitlist names the division that is full', () => {
    assert.equal(tile('waitlist').sub, 'U9 Rookie is full');
    const two = [...base.divisions, { name: 'U13', capacity: 10, heldCount: 10, waitlistCount: 1 }];
    assert.equal(tile('waitlist', { divisions: two }).sub, '2 divisions are full');
    assert.equal(tile('waitlist', { divisions: [{ name: 'U9', capacity: 12, heldCount: 5, waitlistCount: 3 }] }).sub, 'waiting for a spot');
  });
  it('Teams counts the players not on a team', () => {
    assert.equal(tile('teams', { role: 'league_admin' }).figure, '8');
    assert.equal(tile('teams', { role: 'league_admin' }).sub, '8 players not on a team');
  });
  it('a quiet morning says so instead of showing a bare zero', () => {
    const calm = { pendingReviewCount: 0, oldestPendingAt: null, unplacedCount: 0, waitlistCount: 0 };
    const tiles = leagueMorning({ ...base, summary: calm, money: { owing: 0, owingPlayers: 0 } });
    assert.ok(tiles.every(t => t.quiet), 'every tile reads quiet');
    assert.deepEqual(tiles.map(t => t.sub), ['nothing waiting', 'nobody owes', 'nothing waiting']);
  });
  it('every tile opens the page that holds its lines', () => {
    const hrefs = Object.fromEntries(leagueMorning(base).map(t => [t.key, t.href]));
    assert.equal(hrefs.review, '/harbourtown/admin/house-league/seasons/s1/registrations?tab=review');
    assert.equal(hrefs.owing, '/harbourtown/admin/house-league/seasons/s1/money');
    assert.equal(hrefs.waitlist, '/harbourtown/admin/house-league/seasons/s1/registrations?tab=waitlist');
  });
});

describe('what A3 does not build', () => {
  it('leaves the club time (13d) and Find a child (13e) out', () => {
    const src = readCode('lib/league-morning.ts') + readCode('components/admin/kit/club/league/LeagueMorning.tsx');
    assert.doesNotMatch(src, /Club time|clubTime|Find a child/);
  });
  it('the season page draws it above the season’s band, for the roles the function allows', () => {
    const page = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx');
    assert.ok(page.indexOf('<LeagueMorning') < page.indexOf('aria-label="This season"'));
  });
});
