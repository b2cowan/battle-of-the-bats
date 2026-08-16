/**
 * WHOSE PICKER A BUDGET ITEM APPEARS IN (mig 240).
 *
 * The item became the NAME of a budget row and the key both reports group on, so the list it is
 * chosen from stopped being decoration. Owner ruling 2026-08-15:
 *
 *   > "custom items are team wide but should be viewable by the club, we shouldn't populate 1
 *   >  team's list with another team."
 *
 * ⚠ THIS IS A LEAK TEST, not a formatting one. The failure it guards against is silent: one team's
 * private vocabulary showing up in another team's picker looks like a longer list, not like a bug,
 * and by the time anyone notices, two teams' plans are written in each other's words.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  budgetItemTier, itemVisibleToTeam, ITEM_TIER_LABEL,
} from '../../lib/coach-budget-items.ts';

const CLUB = 'org-riverdale';
const OTHER_CLUB = 'org-somewhere-else';
const TEAM = 'team-14u';
const OTHER_TEAM = 'team-12u';

const platform = { org_id: null, team_id: null };
const clubItem = { org_id: CLUB, team_id: null };
const teamItem = { org_id: CLUB, team_id: TEAM };
const otherTeamItem = { org_id: CLUB, team_id: OTHER_TEAM };
const otherClubItem = { org_id: OTHER_CLUB, team_id: null };

describe('budgetItemTier', () => {
  it('reads the two ownership columns as three tiers', () => {
    assert.equal(budgetItemTier(platform), 'platform');
    assert.equal(budgetItemTier(clubItem), 'club');
    assert.equal(budgetItemTier(teamItem), 'team');
  });

  it('has a coach-facing name for every tier', () => {
    // A tier with no label would render as blank beside the ones that have them.
    for (const tier of ['platform', 'club', 'team'] as const) {
      assert.ok(ITEM_TIER_LABEL[tier]);
    }
  });
});

describe('itemVisibleToTeam', () => {
  it('shows every team the platform defaults', () => {
    assert.equal(itemVisibleToTeam(platform, CLUB, TEAM), true);
    assert.equal(itemVisibleToTeam(platform, OTHER_CLUB, OTHER_TEAM), true);
  });

  it('shows a club-published item to every team in that club', () => {
    assert.equal(itemVisibleToTeam(clubItem, CLUB, TEAM), true);
    assert.equal(itemVisibleToTeam(clubItem, CLUB, OTHER_TEAM), true);
  });

  it('shows a team its OWN item', () => {
    assert.equal(itemVisibleToTeam(teamItem, CLUB, TEAM), true);
  });

  it('⚠ NEVER shows one team another team\'s item', () => {
    // The whole ruling, in one assertion. If this passes as `true`, one coach's specifics are
    // filling every other coach's list and the tiers have stopped meaning anything.
    assert.equal(itemVisibleToTeam(otherTeamItem, CLUB, TEAM), false);
  });

  it('never shows another club\'s item at any tier', () => {
    assert.equal(itemVisibleToTeam(otherClubItem, CLUB, TEAM), false);
    assert.equal(itemVisibleToTeam({ org_id: OTHER_CLUB, team_id: 'team-theirs' }, CLUB, TEAM), false);
  });

  it('is the same answer for the picker and for the write path', () => {
    // ⚠ The predicate is shared deliberately: a list that OFFERS what a write path REFUSES is the
    // drift it exists to stop, and the two were separate functions once.
    const every = [platform, clubItem, teamItem, otherTeamItem, otherClubItem];
    const visible = every.filter(i => itemVisibleToTeam(i, CLUB, TEAM));
    assert.deepEqual(visible, [platform, clubItem, teamItem]);
  });
});
