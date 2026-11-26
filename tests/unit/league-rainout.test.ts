import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RAIN_WORDS as W, RAIN_LINE_MAX, rainLine, shortDivision } from '../../lib/league-rainout.ts';

/**
 * House League 9e-2, what is left of the Rainout since Club Website Stage 2 (the window is Close a place now; 2C retired
 * the old window's pure plan, which only these tests read): the held Rainout's banner and Put all back, and the words and
 * helpers Close a place shares.
 */
const TODAY = '2027-06-17';

describe('the held Rainout (COPY Part C 11.3) and the closed place\'s banner', () => {
  it('the banner, Put all back and its answers', () => {
    assert.equal(W.banner(TODAY, 12, 'postponed'), 'Rainout on Thu, Jun 17: 12 games postponed, waiting to be sent.');
    assert.equal(W.bannerClosure(TODAY, 4, 'postponed'), 'A closed place on Thu, Jun 17: 4 games postponed, waiting to be sent.');
    assert.equal(W.back(12), 'Put all 12 back');
    assert.equal(W.backTitle(12), 'Put all 12 games back?');
    assert.equal(W.backTitle(1), 'Put all 1 game back?');
    assert.equal(W.backKeep('cancelled'), 'Keep them cancelled');
    assert.equal(W.backDone(12), '12 games put back. Nothing was sent.');
    assert.equal(W.errFinished('2027 House League'), '2027 House League has finished, so games can’t be called off.');
  });
  it('the button is one word (K15)', () => {
    assert.equal(W.button, 'Rainout');
  });
});

describe('what Close a place shares', () => {
  it('the line: one line, trimmed, at most what was typed', () => {
    assert.equal(rainLine('  Rain:\n the fields   are closed. '), 'Rain: the fields are closed.');
    assert.equal(rainLine('   '), null);
    assert.equal(rainLine(undefined), null);
    assert.equal(RAIN_LINE_MAX, 120);
  });
  it('the short division name', () => {
    assert.equal(shortDivision('U8 Division'), 'U8');
    assert.equal(shortDivision('U8'), 'U8');
  });
});
