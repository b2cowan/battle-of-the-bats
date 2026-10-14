import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { namePremiumTeamsFirst, type LivePortal } from '../../lib/premium-team-labels';

/**
 * The register picker offered a coach his Premium team under last season's free-team name, so he made
 * a second team (production, 2026-10-13). These pin what fixes it: the portal's CURRENT name, Premium
 * teams first, only the portal's own twin renamed, and a canceled portal's team left exactly as it was.
 */

type Team = { id: string; name: string; teamWorkspaceId: string | null };
const team = (id: string, name: string, teamWorkspaceId: string | null = null): Team => ({ id, name, teamWorkspaceId });
const portal = (name: string | null, twinId: string | null): LivePortal => ({ name, twinId });

describe('namePremiumTeamsFirst', () => {
  it('offers a live portal’s team under the portal’s current name, not the free team’s', () => {
    const { teams, portalTeamIds } = namePremiumTeamsFirst(
      [team('free-1', 'Milton Bats U13 White', 'ws-1')],
      new Map([['ws-1', portal('Milton Bats U13 Purple', 'free-1')]]),
    );
    assert.equal(teams[0].name, 'Milton Bats U13 Purple');
    assert.equal(teams[0].id, 'free-1', 'the id the registration links to is unchanged');
    assert.deepEqual(portalTeamIds, ['free-1']);
  });

  it('lists Premium teams ahead of free teams, keeping each group’s own order', () => {
    const { teams } = namePremiumTeamsFirst(
      [team('a', 'Old free team'), team('b', 'Twin B', 'ws-b'), team('c', 'Another free'), team('d', 'Twin D', 'ws-d')],
      new Map([['ws-b', portal('Portal B', 'b')], ['ws-d', portal('Portal D', 'd')]]),
    );
    assert.deepEqual(teams.map(t => t.name), ['Portal B', 'Portal D', 'Old free team', 'Another free']);
  });

  it('renames only the portal’s own twin: a second free team with the same back-link stays an ordinary team', () => {
    const { teams, portalTeamIds } = namePremiumTeamsFirst(
      [team('stale', 'Old copy', 'ws-1'), team('twin', 'Twin', 'ws-1')],
      new Map([['ws-1', portal('Portal', 'twin')]]),
    );
    assert.deepEqual(teams.map(t => [t.id, t.name]), [['twin', 'Portal'], ['stale', 'Old copy']]);
    assert.deepEqual(portalTeamIds, ['twin'], 'never two identical rows');
  });

  it('with no twin recorded yet, the earliest back-linked team stands in (the one the portal adopts)', () => {
    const { teams, portalTeamIds } = namePremiumTeamsFirst(
      [team('first', 'First', 'ws-1'), team('second', 'Second', 'ws-1')],
      new Map([['ws-1', portal('Portal', null)]]),
    );
    assert.deepEqual(teams.map(t => t.name), ['Portal', 'Second']);
    assert.deepEqual(portalTeamIds, ['first']);
  });

  it('leaves a canceled portal’s free team alone: own name, own place, no tag', () => {
    const input = [team('a', 'Free A'), team('b', 'Was Premium', 'ws-canceled')];
    const { teams, portalTeamIds } = namePremiumTeamsFirst(input, new Map());
    assert.deepEqual(teams, input);
    assert.deepEqual(portalTeamIds, []);
  });

  it('keeps the twin’s name when the portal’s name is missing or blank, but still tags it and lists it first', () => {
    for (const name of [null, '   ']) {
      const { teams, portalTeamIds } = namePremiumTeamsFirst(
        [team('a', 'Free A'), team('b', 'Twin name', 'ws-b')],
        new Map([['ws-b', portal(name, 'b')]]),
      );
      assert.deepEqual(teams.map(t => t.name), ['Twin name', 'Free A'], String(name));
      assert.deepEqual(portalTeamIds, ['b']);
    }
  });

  it('does not change the teams it was given, and copes with none', () => {
    const input = [team('a', 'Twin', 'ws-a')];
    namePremiumTeamsFirst(input, new Map([['ws-a', portal('Portal', 'a')]]));
    assert.equal(input[0].name, 'Twin');
    assert.deepEqual(namePremiumTeamsFirst([], new Map()), { teams: [], portalTeamIds: [] });
  });
});
