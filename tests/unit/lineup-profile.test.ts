import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeLineupProfile,
  buildLineupProfileWrite,
  playerPositionPrefs,
  positionStateOf,
  cyclePositionState,
  dropLegacyLineupProfileKeys,
} from '../../lib/lineup-profile.ts';

// Three states per position (owner, 2026-09-12): Best (ranked), Never, or blank = fine. These
// tests pin the round-trip picker payload → columns + profile → reader, and the two guarantees
// the depth-chart three-states plan rests on: a Never always wins, and the retired fourth bucket
// (`canPlay`, "Okay") is ignored on read and never written.

const POS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

describe('normalizeLineupProfile — three states', () => {
  it('returns null for a profile with no signal', () => {
    assert.equal(normalizeLineupProfile({}, POS), null);
    assert.equal(normalizeLineupProfile({ morePreferred: [], never: [], pitcher: null, aSquad: false }, POS), null);
    assert.equal(normalizeLineupProfile(null, POS), null);
  });

  it('ignores a legacy canPlay key on read and never carries it through', () => {
    const out = normalizeLineupProfile({ morePreferred: ['3B'], canPlay: ['2B'], never: ['C'] }, POS);
    assert.deepEqual(out, { morePreferred: ['3B'], never: ['C'], pitcher: null, aSquad: false });
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'canPlay'), false);
  });

  it('a profile whose only content was a canPlay list normalizes to null (nothing to keep)', () => {
    assert.equal(normalizeLineupProfile({ canPlay: ['2B'] }, POS), null);
  });

  it('Never wins over Best 3+', () => {
    const out = normalizeLineupProfile({ morePreferred: ['3B', 'SS'], never: ['SS'] }, POS);
    assert.deepEqual(out?.morePreferred, ['3B']);
    assert.deepEqual(out?.never, ['SS']);
  });

  it('uppercases, dedupes and drops codes outside the sport vocabulary', () => {
    const out = normalizeLineupProfile({ morePreferred: ['ss', 'SS', 'DH', 'lf'], never: ['xx'] }, POS);
    assert.deepEqual(out?.morePreferred, ['SS', 'LF']);
    assert.deepEqual(out?.never, []);
  });
});

describe('buildLineupProfileWrite — picker payload → columns + profile', () => {
  it('splits an ordered Best list into primary / secondary / morePreferred', () => {
    const w = buildLineupProfileWrite({ preferred: ['SS', '2B', '3B', 'LF'], never: ['C'] }, POS, 'P');
    assert.equal(w.primaryPosition, 'SS');
    assert.equal(w.secondaryPosition, '2B');
    assert.deepEqual(w.lineupProfile?.morePreferred, ['3B', 'LF']);
    assert.deepEqual(w.lineupProfile?.never, ['C']);
  });

  it('a canPlay list in the payload (an old client) is ignored — not a Best, not a Never', () => {
    const w = buildLineupProfileWrite({ preferred: ['SS'], canPlay: ['2B'], never: [] } as never, POS, 'P');
    assert.equal(w.primaryPosition, 'SS');
    assert.equal(w.secondaryPosition, null);
    assert.equal(w.lineupProfile, null); // nothing but a Best 1, which lives in the column
  });

  it('a position that is both Best and Never is Never', () => {
    const w = buildLineupProfileWrite({ preferred: ['SS', 'C'], never: ['C'] }, POS, 'P');
    assert.equal(w.primaryPosition, 'SS');
    assert.equal(w.secondaryPosition, null);
    assert.deepEqual(w.lineupProfile?.never, ['C']);
  });

  it('the mound is never a fielding preference', () => {
    const w = buildLineupProfileWrite({ preferred: ['P', 'SS'], never: ['P'] }, POS, 'P');
    assert.equal(w.primaryPosition, 'SS');
    assert.equal(w.lineupProfile, null);
  });
});

describe('playerPositionPrefs — the reader', () => {
  it('merges the columns and the profile into one ordered Best list plus Never; everything else is blank', () => {
    const prefs = playerPositionPrefs({
      primaryPosition: '1B', secondaryPosition: 'C',
      lineupProfile: { morePreferred: ['3B'], never: ['2B', 'SS'], pitcher: null, aSquad: false },
    }, 'P');
    assert.deepEqual(prefs, { preferred: ['1B', 'C', '3B'], never: ['2B', 'SS'] });
    assert.equal(Object.prototype.hasOwnProperty.call(prefs, 'canPlay'), false);
  });

  it('a row the migration has not reached (stray canPlay) still reads, with the stray list ignored', () => {
    const prefs = playerPositionPrefs({
      primaryPosition: '1B', secondaryPosition: null,
      lineupProfile: { morePreferred: [], canPlay: ['3B'], never: [], pitcher: null, aSquad: false } as never,
    }, 'P');
    assert.deepEqual(prefs, { preferred: ['1B'], never: [] });
  });

  it('Never strips a matching Best on read too', () => {
    const prefs = playerPositionPrefs({
      primaryPosition: 'SS', secondaryPosition: 'C',
      lineupProfile: { morePreferred: [], never: ['C'], pitcher: null, aSquad: false },
    }, 'P');
    assert.deepEqual(prefs, { preferred: ['SS'], never: ['C'] });
  });
});

describe('positionStateOf / cyclePositionState — the shared cycle both editors call', () => {
  it('reads best, never and blank correctly', () => {
    const v = { best: ['SS'], never: ['C'] };
    assert.equal(positionStateOf(v, 'SS'), 'best');
    assert.equal(positionStateOf(v, 'C'), 'never');
    assert.equal(positionStateOf(v, '2B'), 'neutral');
  });

  it('cycles blank → best → never → blank', () => {
    let v = { best: [] as string[], never: [] as string[] };
    v = cyclePositionState(v, 'SS');
    assert.deepEqual(v, { best: ['SS'], never: [] });
    v = cyclePositionState(v, 'SS');
    assert.deepEqual(v, { best: [], never: ['SS'] });
    v = cyclePositionState(v, 'SS');
    assert.deepEqual(v, { best: [], never: [] });
  });

  it('appends to the end of an existing Best list, ranking a new position last', () => {
    const v = cyclePositionState({ best: ['C', '1B'], never: [] }, 'SS');
    assert.deepEqual(v.best, ['C', '1B', 'SS']);
  });

  it('accepts a richer value (extra fields) and returns only the two lists', () => {
    const richer = { best: ['SS'], never: [], isPitcher: true, rank: 1, maxInnings: '', aSquad: false };
    const v = cyclePositionState(richer, 'SS');
    assert.deepEqual(v, { best: [], never: ['SS'] });
  });
});

describe('dropLegacyLineupProfileKeys — the DB-read boundary that stops a stray key travelling forward', () => {
  it('passes null through', () => {
    assert.equal(dropLegacyLineupProfileKeys(null), null);
  });

  it('returns a clean profile unchanged (same reference — nothing to strip)', () => {
    const p = { morePreferred: ['3B'], never: [], pitcher: null, aSquad: false };
    assert.equal(dropLegacyLineupProfileKeys(p), p);
  });

  it('strips a stray canPlay key from a legacy row without touching the rest', () => {
    const p = { morePreferred: ['3B'], never: ['C'], pitcher: null, aSquad: true, canPlay: ['2B'] } as never;
    const out = dropLegacyLineupProfileKeys(p);
    assert.deepEqual(out, { morePreferred: ['3B'], never: ['C'], pitcher: null, aSquad: true });
    assert.equal(Object.prototype.hasOwnProperty.call(out, 'canPlay'), false);
  });
});
