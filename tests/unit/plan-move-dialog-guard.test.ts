/**
 * The move window after the Premium → Club review (Plan & billing Stage 4b Part 3). One window serves the Club band move,
 * the Rep Teams team-cap offer AND the Premium coach starting a club, so each Premium-only behaviour is held to `inPlace`
 * and each shared behaviour keeps what the band move always did. Source reads: the window's states are pinned by what the
 * code says, not by a browser.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { isInPlaceReturn, isPremiumToClub } from '../../lib/workspace-upgrade.ts';

const dialog = readCode('components/billing/PlanMoveDialog.tsx');

describe('the move window', () => {
  it('only a Premium owner moving onto a Club band is the in-place upgrade', () => {
    assert.equal(isPremiumToClub('team', 'club'), true);
    assert.equal(isPremiumToClub('team', 'club_large'), true);
    assert.equal(isPremiumToClub('club', 'club_large'), false, 'a band move is not an upgrade');
    assert.equal(isPremiumToClub('team', 'league'), false);
    assert.equal(isPremiumToClub(null, 'club'), false);
    assert.equal(isInPlaceReturn(new URLSearchParams('inPlace=club&success=1')), true);
    assert.equal(isInPlaceReturn(new URLSearchParams('inPlace=other')), false);
  });

  it('choosing the cycle already chosen is a no-op, never a spinner with nothing to end it', () => {
    // GST/HST Stage 2 Part 3: a new cycle only changes the question; the figures show they are loading until its answer lands.
    assert.match(dialog, /onClick=\{\(\) => \{ if \(value !== cycle\) setCycle\(value\); \}\}/);
    assert.doesNotMatch(dialog, /setCycle\(value\)[^\n]*setState\(\{ status: 'loading' \}\)/);
  });

  it('a declined or failed charge says what the server said, not that the provider was unreachable', () => {
    assert.match(dialog, /case 'stripe_error': return refusal\.error \|\| W\.clubUpgrade\.paymentProvider;/);
  });

  it('a band move keeps its figures on screen when confirming fails; only the Premium window swaps in a refusal', () => {
    assert.match(dialog, /if \(inPlace\) setState\(\{ status: 'refused'[^]*?\n\s*else setFailure\(d\.error \?\? W\.errors\.move\);/);
  });

  it('a second try after a lost answer finishes on the setup screen instead of saying "not a move"', () => {
    assert.match(dialog, /inPlace && d\.code === 'not_a_move'[^]*?window\.location\.replace\(inPlaceReturnPath\(org\.slug\)\)/);
  });

  it('once the move is accepted the window stays busy, so it cannot be closed onto the old billing page', () => {
    assert.match(dialog, /accepted = true;[^]*?if \(inPlace\) leaving\.current = true;[^]*?onMoved\(/);
  });

  it('a missing checkout quote has a Check again door, and a band move keeps the old "contact" refusal', () => {
    assert.match(dialog, /refusal\.code === 'no_live_subscription' \? inPlace && !quote :/);
  });

  it('the Premium-only foot sentence, focus rule and form kind never reach the band move', () => {
    assert.match(dialog, /const foot = !inPlace \? undefined :/);
    assert.match(dialog, /openOn=\{inPlace \? 'panel' : 'field'\}/);
    assert.match(dialog, /kind=\{inPlace \? 'form' : 'question'\}/);
  });
});
