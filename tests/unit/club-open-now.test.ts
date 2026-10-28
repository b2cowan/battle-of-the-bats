import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clubOpenNowRows } from '../../lib/club-open-now.ts';
import type { ClubTryoutTeam } from '../../lib/club-tryouts.ts';
import type { LeagueSeason } from '../../lib/types.ts';

/**
 * A CLUB'S OPEN NOW LIST, shaped once for the club home and the tournament Overview's host card (Public tournament pages
 * Stage 2, Ask 4 / Ask B). Moved unchanged out of the club home's loader; these cases pin what the home printed before
 * the move, so the host card shows exactly the home's list.
 */

const TODAY = '2026-10-28';
const href = (p: string) => `/lakeshore${p}`;
// Sign-up "open" reads the real clock, so open seasons span it: opened long ago, closing far ahead.
const season = (over: Partial<LeagueSeason>): LeagueSeason => ({
  id: 's1', name: 'Fall house league', slug: 'fall', status: 'registration_open',
  registrationOpenAt: '2020-01-01T00:00Z', registrationCloseAt: null, registrationClosedAt: null, ...over,
} as LeagueSeason);
const tryoutTeam = (name: string, state: 'open' | 'notOpenYet' | 'closed'): ClubTryoutTeam => ({
  name, slug: name.toLowerCase().replace(/\s+/g, '-'), groupId: null,
  season: { id: `y-${name}`, name: '2027', year: 2027 }, bornYears: {} as ClubTryoutTeam['bornYears'], sport: null,
  standing: { state, upcoming: [], heldDays: [] } as unknown as ClubTryoutTeam['standing'],
});
const none = { teams: [], groups: [] };

describe('Open now: the club home\'s list, shared with the host card', () => {
  it('nothing open: an empty list (the card then says the club runs programs all year)', () => {
    assert.deepEqual(clubOpenNowRows([], none, TODAY, href), []);
  });
  it('a season taking sign-ups is a row to its page; a closed one or a draft is not', () => {
    const rows = clubOpenNowRows([
      season({}),
      season({ id: 's2', slug: 'spring', status: 'registration_closed' }),
      season({ id: 's3', slug: 'summer', status: 'draft' }),
    ], none, TODAY, href);
    assert.deepEqual(rows.map(r => [r.key, r.href, r.title, r.sub]), [['league-s1', '/lakeshore/league/fall', 'Fall house league', null]]);
  });
  it('a closing day ahead is said, with the year when it is not this one; a season with one sorts first', () => {
    const rows = clubOpenNowRows([
      season({ id: 'a', name: 'No deadline' }),
      season({ id: 'b', name: 'Far', registrationCloseAt: '2099-06-01T23:59Z' }),
    ], none, TODAY, href);
    assert.deepEqual(rows.map(r => r.title), ['Far', 'No deadline']);
    assert.match(rows[0].sub ?? '', /^Sign up by .*2099/);
    assert.equal(rows[0].deadline, '2099-06-01');
  });
  it('one team\'s tryouts open: its own row after the league rows; two teams: one door to the Tryouts page', () => {
    const one = clubOpenNowRows([season({})], { teams: [tryoutTeam('U13 Gold', 'open')], groups: [] }, TODAY, href);
    assert.deepEqual(one.map(r => r.key), ['league-s1', 'tryout-y-U13 Gold']);
    assert.equal(one[1].href, '/lakeshore/teams/u13-gold/tryouts');
    assert.equal(one[1].title, 'U13 Gold tryouts');
    const two = clubOpenNowRows([], { teams: [tryoutTeam('U13 Gold', 'open'), tryoutTeam('U15 Gold', 'notOpenYet')], groups: [] }, TODAY, href);
    assert.deepEqual(two.map(r => [r.key, r.href]), [['tryouts', '/lakeshore/tryouts']]);
  });
});
