import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicBracketVisible, isPublicPageEnabled, type PublicPageKey } from '../../lib/public-pages.ts';
import { visibleTournamentTabs } from '../../lib/tournament-page-tabs.ts';

/**
 * The public bracket's visibility, and the tab that leads to it.
 *
 * Two rules are being pinned here, and the second one is the bug that prompted the file.
 *
 *  1. **The bracket gives the seeding away**, so an organizer who hid Standings has hidden the
 *     bracket too. That must keep working — it is the privacy guarantee.
 *  2. **A bracket-only event hides Standings by FORMAT, not by choice**, and its bracket is the
 *     entire tournament. Reading the derived "is Standings public?" answer conflated the two, so
 *     the one format most defined by having a bracket was the only one that could never show it:
 *     the page hid itself, and the nav tab matched the page (correctly — nothing dead-ended), so
 *     there was simply no way in at all.
 *
 * The invariant tying them together: **the tab appears exactly when the page renders.** Both read
 * the same predicate, so a link to a wall and a page with no door are equally impossible.
 */

const roundRobin = (hidden: PublicPageKey[] = []) => ({
  publicHiddenPages: hidden,
  settings: { format: 'round_robin_playoffs' as const },
});
const bracketOnly = (hidden: PublicPageKey[] = []) => ({
  publicHiddenPages: hidden,
  settings: { format: 'playoff_only' as const },
});

describe('public bracket visibility', () => {
  test('a normal event shows its bracket, and hiding Standings hides it too', () => {
    assert.equal(isPublicBracketVisible(roundRobin()), true);
    assert.equal(isPublicBracketVisible(roundRobin(['standings'])), false,
      'hiding Standings must take the bracket with it — the bracket IS the seeding');
  });

  test('a BRACKET-ONLY event shows its bracket — the regression this file exists for', () => {
    // Standings is force-hidden for this format…
    assert.equal(isPublicPageEnabled(bracketOnly(), 'standings'), false);
    // …but that must NOT suppress the bracket, which is the whole tournament.
    assert.equal(isPublicBracketVisible(bracketOnly()), true,
      'a bracket-only event could previously never show its bracket at all');
  });

  test('a bracket-only organizer can still hide it — Standings is their only lever', () => {
    assert.equal(isPublicBracketVisible(bracketOnly(['standings'])), false);
  });

  test('hiding an unrelated page never touches the bracket', () => {
    for (const page of ['news', 'teams', 'rules', 'register', 'schedule'] as PublicPageKey[]) {
      assert.equal(isPublicBracketVisible(roundRobin([page])), true, `hiding ${page} hid the bracket`);
      assert.equal(isPublicBracketVisible(bracketOnly([page])), true, `hiding ${page} hid the bracket`);
    }
  });
});

describe('the Playoffs tab follows the bracket, not the Standings tab', () => {
  test('it sits directly after Standings on a normal event', () => {
    const keys = visibleTournamentTabs([], true).map(t => t.key);
    assert.deepEqual(keys, ['news', 'schedule', 'standings', 'playoffs', 'teams', 'rules']);
  });

  test('it still appears when Standings is absent from the list', () => {
    // Exactly the bracket-only shape: the layout strips 'standings' from the nav for that format.
    // An `else`/`continue` here would drop Playoffs along with it — the second half of the bug.
    const keys = visibleTournamentTabs(['standings'], true).map(t => t.key);
    assert.deepEqual(keys, ['news', 'schedule', 'playoffs', 'teams', 'rules']);
  });

  test('no bracket configured means no tab, whatever else is showing', () => {
    assert.ok(!visibleTournamentTabs([], false).some(t => t.key === 'playoffs'));
    assert.ok(!visibleTournamentTabs(['standings'], false).some(t => t.key === 'playoffs'));
  });

  test('it never appears twice, and never displaces another page', () => {
    const keys = visibleTournamentTabs([], true).map(t => t.key);
    assert.equal(keys.filter(k => k === 'playoffs').length, 1);
    for (const page of ['news', 'schedule', 'standings', 'teams', 'rules']) {
      assert.ok(keys.includes(page), `${page} went missing`);
    }
  });
});
