/**
 * The player page's tabs have an ADDRESS (hub F13, 2026-09-13), and every deep link that predates
 * the tabs — `?section=development&view=…` from the Skills & Goals hub, Insights, the layout sweep,
 * the marketing shots and the help articles — must keep landing on the right tab without a change
 * to its producer. This pins the mapping.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_PLAYER_TAB, PLAYER_TABS, playerTabHref, resolvePlayerTab, tabForSection } from '../../lib/coach-player-tabs.ts';

const params = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) });

describe('the five tabs', () => {
  it('are Details · This season · Skills & Goals · Notes · Family & paperwork, in that order, Details first', () => {
    assert.deepEqual(PLAYER_TABS.map(t => t.id), ['details', 'season', 'skills', 'notes', 'family']);
    assert.equal(DEFAULT_PLAYER_TAB, 'details');
    assert.equal(PLAYER_TABS[2].label, 'Skills & Goals');
  });
});

describe('resolvePlayerTab', () => {
  it('an explicit ?tab= wins', () => {
    assert.equal(resolvePlayerTab(params({ tab: 'notes', section: 'development' })), 'notes');
  });
  it('a bare address opens Details', () => {
    assert.equal(resolvePlayerTab(params({})), 'details');
  });
  it('an unknown tab falls back to the section, then the default', () => {
    assert.equal(resolvePlayerTab(params({ tab: 'nope', section: 'safety' })), 'family');
    assert.equal(resolvePlayerTab(params({ tab: 'nope' })), 'details');
  });
  it('every existing ?section= producer keeps landing on the tab that holds it', () => {
    // playerDevelopmentHref (Skills & Goals hub, Insights, help, marketing shots) — always section=development
    assert.equal(resolvePlayerTab(params({ section: 'development', view: 'results' })), 'skills');
    assert.equal(tabForSection('development'), 'skills');
    // the roster's prompts
    assert.equal(resolvePlayerTab(params({ section: 'guardian' })), 'family');
    assert.equal(resolvePlayerTab(params({ section: 'player' })), 'details');
    // the glance tiles
    for (const s of ['attendance', 'playing-time', 'awards', 'dues']) assert.equal(tabForSection(s), 'season');
    for (const s of ['safety', 'guardians', 'documents']) assert.equal(tabForSection(s), 'family');
    assert.equal(tabForSection('about'), 'notes');
    assert.equal(tabForSection('nope'), null);
  });
});

describe('playerTabHref', () => {
  const base = '/club/coaches/teams/T1/roster/P1';
  it('names the tab, carries a section, keeps the way back, drops nothing else in', () => {
    assert.equal(playerTabHref(base, 'season'), `${base}?tab=season`);
    assert.equal(playerTabHref(base, 'family', { section: 'guardian' }), `${base}?tab=family&section=guardian`);
    assert.equal(playerTabHref(base, 'skills', { returnTo: '/club/coaches/teams/T1/development' }),
      `${base}?tab=skills&return=%2Fclub%2Fcoaches%2Fteams%2FT1%2Fdevelopment`);
  });
});
