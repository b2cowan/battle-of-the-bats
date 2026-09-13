import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicBracketVisible, isPublicPageEnabled, visiblePublicPages, type PublicPageKey } from '../../lib/public-pages.ts';
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
const exhibition = (hidden: PublicPageKey[] = []) => ({
  publicHiddenPages: hidden,
  settings: { format: 'exhibition' as const },
});

describe('an EXHIBITION event has standings and no bracket (2026-09-13)', () => {
  test('Standings follows the organizer, exactly like a normal event', () => {
    assert.equal(isPublicPageEnabled(exhibition(), 'standings'), true,
      'Exhibition has a round robin, so its Standings page is not force-hidden by format');
    assert.equal(isPublicPageEnabled(exhibition(['standings']), 'standings'), false,
      'the existing Hide Standings switch is how a scrimmage day goes table-less (ruling D2)');
    assert.deepEqual(visiblePublicPages(exhibition()).map(p => p.key), visiblePublicPages(roundRobin()).map(p => p.key));
  });

  test('the bracket itself is never visible, whatever the organizer hides — the /review-caught regression', () => {
    // isPublicBracketVisible must check hasPlayoffs FIRST. Exhibition has a round robin, so
    // without that guard this falls to the Standings-visibility branch and reads true by default —
    // letting the direct-URL Playoffs page render "the bracket isn't set yet" on a format that
    // will never set one, and letting a STALE division playoff_config (switching format only
    // deletes games, never playoff_config) resurface a real bracket on the public site.
    assert.equal(isPublicBracketVisible(exhibition()), false);
    assert.equal(isPublicBracketVisible(exhibition(['standings'])), false);
  });

  test('no bracket is ever configured, so the Playoffs tab never appears — the tab rule needs no format branch', () => {
    // The layout passes hasBracket=false because no division carries a playoff config; the tab
    // list must not grow one for an Exhibition whatever the hidden-pages list says.
    assert.ok(!visibleTournamentTabs([], false).some(t => t.key === 'playoffs'));
    assert.ok(!visibleTournamentTabs(['standings'], false).some(t => t.key === 'playoffs'));
  });

  test('an unknown stored style reads as the default, never as the else-branch', () => {
    const odd = { publicHiddenPages: [] as PublicPageKey[], settings: { format: 'jamboree' as unknown as 'exhibition' } };
    assert.equal(isPublicPageEnabled(odd, 'standings'), true);
    assert.equal(isPublicBracketVisible(odd), true);
  });
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
