import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stripTeamNamePrefix, mastheadSeasonLabel } from '../../lib/coach-season-label.ts';

describe('stripTeamNamePrefix', () => {
  it('strips a whole-word leading team name', () => {
    assert.equal(stripTeamNamePrefix('Riverdale Ridge 12U 2026', 'Riverdale Ridge 12U'), '2026');
    assert.equal(stripTeamNamePrefix('Blue Jays — Fall 2026', 'Blue Jays'), 'Fall 2026');
  });

  it('never strips a partial-word prefix ("Jay" does not mangle "Jays 2026")', () => {
    assert.equal(stripTeamNamePrefix('Jays 2026', 'Jay'), 'Jays 2026');
  });

  it('keeps the name when stripping would leave nothing', () => {
    assert.equal(stripTeamNamePrefix('Blue Jays', 'Blue Jays'), 'Blue Jays');
  });

  it('is safe on empty/null input', () => {
    assert.equal(stripTeamNamePrefix(null, 'Team'), '');
    assert.equal(stripTeamNamePrefix('2026', null), '2026');
  });
});

describe('mastheadSeasonLabel', () => {
  it('a bare-year name renders "<year> season" exactly as the masthead always has', () => {
    assert.equal(mastheadSeasonLabel('2026', 'Riverdale Ridge 12U', 2026), '2026 season');
  });

  it('a named season renders verbatim — including "2026 Season", the case that defeated the old guard', () => {
    assert.equal(mastheadSeasonLabel('2026 Season', 'Riverdale Ridge 12U', 2026), '2026 Season');
    assert.equal(mastheadSeasonLabel('Fall Ball 2026', 'Riverdale Ridge 12U', 2026), 'Fall Ball 2026');
  });

  it('a team-prefixed bare year still reads as the plain year line', () => {
    assert.equal(mastheadSeasonLabel('Riverdale Ridge 12U 2026', 'Riverdale Ridge 12U', 2026), '2026 season');
  });

  it('the word "season" can never be doubled: no code path appends to a non-bare name', () => {
    const out = mastheadSeasonLabel('2026 Season', 'Any Team', 2026);
    assert.equal(out, '2026 Season');
    assert.ok(!/season season/i.test(out ?? ''));
  });

  it('falls back to the year when there is no name, and to null when there is nothing', () => {
    assert.equal(mastheadSeasonLabel(null, 'Team', 2026), '2026 season');
    assert.equal(mastheadSeasonLabel('', 'Team', null), null);
  });
});
