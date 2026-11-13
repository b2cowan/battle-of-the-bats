import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { divisionState } from '../../lib/house-league-teams-words.ts';

/**
 * A lock is "stay put", not a deal (owner, 2026-11-12, Board Ready Part 3 walk): a division whose only players on teams
 * are locked is still Not drafted, so Run the draft and its facts window (Locked, Friends) stay reachable. The screen
 * hands divisionState only the players who are on a team and NOT locked.
 */
describe('divisionState', () => {
  it('reads Not drafted until someone is dealt or moved by hand', () => {
    assert.equal(divisionState({ teams: 3, placed: 0, publishedAt: null }), 'notDrafted');
    assert.equal(divisionState({ teams: 3, placed: 1, publishedAt: null }), 'drafted');
  });
  it('keeps No teams and Published ahead of the rest', () => {
    assert.equal(divisionState({ teams: 0, placed: 0, publishedAt: null }), 'noTeams');
    assert.equal(divisionState({ teams: 3, placed: 0, publishedAt: '2026-11-12' }), 'published');
  });
});

describe('the Teams screen', () => {
  const src = readFileSync(join(process.cwd(), 'components/admin/kit/club/league/teams/TeamsScreen.tsx'), 'utf8');
  it('does not count locked players as a draft', () => {
    // ...unless a draft has run: it records a draft team for locked players too, so locking everyone afterwards
    // must not send a drafted division back to Not drafted (and take Publish teams away).
    assert.match(src, /const dealt = placed\.filter\(p => !p\.locked \|\| p\.draftTeamId\)/);
    assert.match(src, /placed: dealt\.length/);
    assert.match(src, /key: 'draft', done: dealt\.length > 0/);
  });
});
