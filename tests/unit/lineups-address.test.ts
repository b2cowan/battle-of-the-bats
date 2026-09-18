import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  lineupsHref, lineupTemplateHref, parseLineupsSection, LINEUPS_SECTIONS,
} from '../../lib/lineups-address.ts';

/**
 * One room, two tabs (the Lineups hub brought level with the Practice plans room, 2026-09-18):
 * the hub's addresses. The bare address IS the Games landing; Templates is `?section=`; the
 * template editor is a drill-in of its own. Never a year, and never the old `?tab=` form.
 */
const base = '/uat-test-org/coaches/teams/3127a094';

describe('lineupsHref', () => {
  it('the landing is the bare address — never ?section=games', () => {
    assert.equal(lineupsHref(base), `${base}/lineups`);
    assert.equal(lineupsHref(base, 'games'), `${base}/lineups`);
  });
  it('the template library is a tab on ?section=', () => {
    assert.equal(lineupsHref(base, 'templates'), `${base}/lineups?section=templates`);
  });
  it('the tab order is Games then Templates', () => {
    assert.deepEqual([...LINEUPS_SECTIONS], ['games', 'templates']);
  });
  it('the template editor is a page under the room', () => {
    assert.equal(lineupTemplateHref(base, 'abc-123'), `${base}/lineups/templates/abc-123`);
    assert.equal(lineupTemplateHref(base, 'new'), `${base}/lineups/templates/new`);
  });
  it('no address carries a year, and none carries the retired ?tab= key', () => {
    for (const s of LINEUPS_SECTIONS) {
      assert.doesNotMatch(lineupsHref(base, s), /year=/);
      assert.doesNotMatch(lineupsHref(base, s), /[?&]tab=/);
    }
  });
});

describe('parseLineupsSection', () => {
  it('reads the two tabs and lands everything else on Games', () => {
    assert.equal(parseLineupsSection('templates'), 'templates');
    assert.equal(parseLineupsSection('games'), 'games');
    assert.equal(parseLineupsSection(null), 'games');
    assert.equal(parseLineupsSection(undefined), 'games');
    assert.equal(parseLineupsSection('Templates'), 'games', 'case-sensitive, like every other hub');
    for (const s of LINEUPS_SECTIONS) assert.equal(parseLineupsSection(s), s, 'the parser reads its own list');
  });
});
