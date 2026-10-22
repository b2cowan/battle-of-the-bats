import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  BLURB_NOT_LIVE, BLURB_TOO_LONG, TRYOUT_BLURB_MAX, blurbFromBody, bornYearsFromBody, previousBlurbOf,
} from '../../lib/program-year-patch.ts';
import { seasonPhrase } from '../../lib/season-phrase.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 4c-2, PART A — the admin side's server rules and the pieces around them: what the season PATCH accepts
 * (birth years, the "From the club" blurb), the season phrase, "Start from last season's words", and the roll that writes
 * the new season's pair one year later. The pair's own rule (shapes, cut-offs, held reasons) is club-stage4c2.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const NOW = 2026;
const stored = { from: null, to: null };

describe('the season PATCH takes birth years (words A15–A17, K8)', () => {
  it('a body that names neither year does not touch them', () => {
    assert.equal(bornYearsFromBody({ name: 'x' }, stored, NOW), null);
  });
  it('takes numbers or text, trimmed; empty is no limit on that side', () => {
    assert.deepEqual(bornYearsFromBody({ bornFromYear: 2012, bornToYear: 2013 }, stored, NOW), { years: { from: 2012, to: 2013 } });
    assert.deepEqual(bornYearsFromBody({ bornFromYear: ' 2012 ', bornToYear: '' }, stored, NOW), { years: { from: 2012, to: null } });
    assert.deepEqual(bornYearsFromBody({ bornFromYear: null, bornToYear: null }, stored, NOW), { years: { from: null, to: null } });
  });
  it('a side left out of the body keeps what the season has', () => {
    assert.deepEqual(bornYearsFromBody({ bornToYear: 2014 }, { from: 2013, to: 2013 }, NOW), { years: { from: 2013, to: 2014 } });
  });
  it('refuses what is not a four-digit year', () => {
    for (const bad of ['13', 'abc', '20131', 2013.5, 99, '12 34']) {
      assert.deepEqual(bornYearsFromBody({ bornFromYear: bad }, stored, NOW), { error: 'Use a four-digit year, like 2013, to save it.' }, String(bad));
    }
  });
  it('refuses a year after this calendar year', () => {
    assert.deepEqual(bornYearsFromBody({ bornToYear: 2031 }, stored, NOW), { error: 'A birth year can’t be after 2026.' });
    assert.ok('years' in bornYearsFromBody({ bornToYear: 2026 }, stored, NOW)!);
  });
  it('refuses the earlier year second — on the years, the database’s own check (the strict date rule is the browser’s)', () => {
    assert.deepEqual(bornYearsFromBody({ bornFromYear: 2013, bornToYear: 2012 }, stored, NOW), { error: 'Put the earlier year first to save it.' });
    // the same year twice is the database's to allow (a one-year team); the browser holds it off January 1
    assert.ok('years' in bornYearsFromBody({ bornFromYear: 2013, bornToYear: 2013 }, stored, NOW)!);
  });
});

describe('the "From the club" blurb (words E10, E11)', () => {
  it('is trimmed, and empty is none', () => {
    assert.deepEqual(blurbFromBody('  Fee is $40.  '), { text: 'Fee is $40.' });
    assert.deepEqual(blurbFromBody('   '), { text: null });
    assert.deepEqual(blurbFromBody(null), { text: null });
  });
  it('holds exactly 500 and refuses 501, in the copy doc’s words', () => {
    assert.deepEqual(blurbFromBody('a'.repeat(TRYOUT_BLURB_MAX)), { text: 'a'.repeat(TRYOUT_BLURB_MAX) });
    assert.deepEqual(blurbFromBody('a'.repeat(TRYOUT_BLURB_MAX + 1)), { error: 'The text under From the club can be up to 500 characters.' });
    assert.equal(BLURB_TOO_LONG, 'The text under From the club can be up to 500 characters.');
  });
  it('the count is of what is stored: surrounding spaces do not count against it', () => {
    assert.deepEqual(blurbFromBody(`  ${'a'.repeat(TRYOUT_BLURB_MAX)}  `), { text: 'a'.repeat(TRYOUT_BLURB_MAX) });
  });
  it('a value that is not text is refused, not stored', () => {
    assert.ok('error' in blurbFromBody(42 as unknown));
    assert.ok('error' in blurbFromBody({ x: 1 } as unknown));
  });
  it('the not-live refusal has its words', () => {
    assert.equal(BLURB_NOT_LIVE, 'Only the team’s current season can be changed.');
  });
});

describe('the season route wires both rules (the live-season check the sign-up switch uses, and the cap)', () => {
  const src = readFileSync(new URL('../../app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/route.ts', import.meta.url), 'utf8');
  it('the blurb is checked for length and for the live season before it is stored', () => {
    const at = src.indexOf("'tryoutDescription' in body");
    assert.ok(at > 0);
    const block = src.slice(at, at + 900);
    assert.match(block, /blurbFromBody\(body\.tryoutDescription\)/);
    assert.match(block, /await liveSeason\(\)/);
    assert.equal(src.match(/getActiveRepProgramYear\(team\.id\)/g)?.length, 1, 'the live season is read once, lazily, and shared');
    assert.match(block, /live\.id !== programYear\.id/);
    assert.match(block, /status: 409/);
  });
  it('the GET works out the first-game and tryout-day figures only when asked (?include=)', () => {
    const get = src.slice(0, src.indexOf('export const PATCH'));
    assert.match(get, /include\.has\('firstGame'\)/);
    assert.match(get, /include\.has\('tryoutDays'\)/);
    assert.match(get, /\.neq\('status', 'cancelled'\)/);
    assert.match(get, /\.gte\('starts_at', zonedWallClockToUtc\(tournamentToday\(\), '00:00'\)/);
  });
  it('the years go through the shared check, and org scoping is untouched', () => {
    assert.match(src, /bornYearsFromBody\(body,/);
    assert.match(src, /team\.orgId !== ctx!\.org\.id/);
    assert.match(src, /ctx!\.role !== 'owner' && ctx!\.role !== 'admin'/);
  });
});

describe('a season’s name in a sentence (Convention 3)', () => {
  it('drops a trailing "Season" in any case and says the lower-case word', () => {
    assert.equal(seasonPhrase('2027 Season'), '2027 season');
    assert.equal(seasonPhrase('2027 season'), '2027 season');
    assert.equal(seasonPhrase('Spring'), 'Spring season');
    assert.equal(seasonPhrase('Spring Season'), 'Spring season');
    assert.equal(seasonPhrase('  Fall 2027  SEASON '), 'Fall 2027 season');
  });
  it('a name that is only the word reads "season"; a word that merely contains it is left alone', () => {
    assert.equal(seasonPhrase('Season'), 'season');
    assert.equal(seasonPhrase(''), 'season');
    assert.equal(seasonPhrase('Preseason'), 'Preseason season');
  });
});

describe('"Start from last season’s words" (Ask 10)', () => {
  const s = (id: string, year: number, createdAt: string, tryoutDescription: string | null) => ({ id, year, createdAt, tryoutDescription });
  const now = s('now', 2027, '2027-01-01', null);
  it('is the previous season’s words when it had some', () => {
    assert.equal(previousBlurbOf([s('a', 2026, '2026-01-01', ' Fee is $40. '), now], now), 'Fee is $40.');
  });
  it('is nothing (no door) when the previous season had none — an older season’s words do not count', () => {
    assert.equal(previousBlurbOf([s('a', 2025, '2025-01-01', 'old words'), s('b', 2026, '2026-01-01', ''), now], now), null);
    assert.equal(previousBlurbOf([now], now), null);
  });
  it('a later season is never "last season"', () => {
    assert.equal(previousBlurbOf([s('z', 2028, '2028-01-01', 'next year'), now], now), null);
  });
});

describe('Start next season writes the new season’s pair one year later (Ask 4 A)', () => {
  const src = readFileSync(new URL('../../lib/rep-season-rollover.ts', import.meta.url), 'utf8');
  it('rolls the closing season’s pair through the one rule and marks it carried only when a side was set', () => {
    assert.match(src, /rollBornYears\(\{ from: currentSeason\.bornFromYear \?\? null, to: currentSeason\.bornToYear \?\? null \}\)/);
    assert.match(src, /born_from_year: rolledYears\.from/);
    assert.match(src, /born_to_year: rolledYears\.to/);
    assert.match(src, /born_years_carried: bornCarried/);
    assert.match(src, /bornCarried = rolledYears\.from != null \|\| rolledYears\.to != null/);
  });
  it('rides the season’s own insert (one statement), so a failed roll leaves no half-written pair', () => {
    const insert = src.slice(src.indexOf(".from('rep_program_years')"), src.indexOf('.select(\'id\')'));
    assert.match(insert, /born_years_carried/);
  });
});
