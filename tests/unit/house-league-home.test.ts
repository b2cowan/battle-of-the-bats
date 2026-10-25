import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { seasonChecklist, seasonDates, seasonFactsLine, seasonNoteLine, type SeasonFacts } from '../../lib/house-league-season.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9a, PART 3 — HOUSE LEAGUE'S HOME (owner 9a·1, Q14; frame A; words HOUSE_LEAGUE_STAGE9A_COPY.md §1, §3).
 *   1. The row's words: one line of facts, a second line only when it says something true, the checklist's three steps.
 *   2. The screen: grouped (Running now · Getting ready · Past seasons shelf), whole-row links, no status buttons, no
 *      "U10" chip, Create season through the gate, on the kit.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TODAY = '2026-10-24';
const base: SeasonFacts = {
  status: 'active', seasonStartDate: '2026-05-31', seasonEndDate: '2026-08-30', sport: 'Softball',
  divisionCount: 2, activeRegistrationCount: 14, teamCount: 6, spotCount: 26,
};

describe('1 · the row’s words (copy §1)', () => {
  it('dates read once with the year at the end, both years when they differ', () => {
    assert.equal(seasonDates(base), 'May 31 – Aug 30, 2026');
    assert.equal(seasonDates({ seasonStartDate: '2026-11-01', seasonEndDate: '2027-02-28' }), 'Nov 1, 2026 – Feb 28, 2027');
    assert.equal(seasonDates({ seasonStartDate: null, seasonEndDate: null }), null);
  });
  it('a running season counts players and teams; a season taking sign-ups counts spots', () => {
    assert.equal(seasonFactsLine(base), 'May 31 – Aug 30, 2026 · Softball · 2 divisions · 14 players · 6 teams');
    assert.equal(seasonFactsLine({ ...base, status: 'registration_open', activeRegistrationCount: 5, spotCount: 38, divisionCount: 3 }),
      'May 31 – Aug 30, 2026 · Softball · 3 divisions · 5 of 38 spots taken');
    assert.equal(seasonFactsLine({ ...base, status: 'registration_open', spotCount: null, activeRegistrationCount: 1 }),
      'May 31 – Aug 30, 2026 · Softball · 2 divisions · 1 player');
    assert.equal(seasonFactsLine({ ...base, status: 'draft', seasonStartDate: null, seasonEndDate: null, divisionCount: 0 }),
      'Dates not set · Softball · 0 divisions');
  });
  it('the second line names a door only for someone who has it', () => {
    const f = { ...base, registrationFee: 150 };
    assert.equal(seasonNoteLine(f, true, TODAY), 'Past its end date: complete it from the season page');
    assert.equal(seasonNoteLine(f, false, TODAY), 'Past its end date');
    assert.equal(seasonNoteLine({ ...f, status: 'registration_closed' }, true, TODAY), 'Registration is closed. Start the season from its page.');
    assert.equal(seasonNoteLine({ ...f, status: 'registration_closed' }, false, TODAY), 'Registration is closed.');
    assert.equal(seasonNoteLine({ ...f, seasonEndDate: '2026-12-30' }, true, TODAY), null, 'playing now says nothing more');
    assert.equal(seasonNoteLine({ ...f, status: 'completed' }, true, TODAY), null);
  });
  it('a close date that passed is said as passed (F08: the dates do not run the form until 9b-1)', () => {
    const open = { ...base, status: 'registration_open', registrationFee: 150 };
    assert.equal(seasonNoteLine({ ...open, registrationCloseAt: '2026-08-01' }, true, TODAY), 'Registration was set to close Aug 1, 2026');
    assert.equal(seasonNoteLine({ ...open, registrationCloseAt: '2026-12-01' }, true, TODAY), 'Registration closes Dec 1, 2026');
  });
  it('a draft season counts what is left of its checklist', () => {
    const draft = { ...base, status: 'draft', registrationFee: null, spotCount: null };
    assert.equal(seasonNoteLine(draft, true, TODAY), '2 things to do before registration can open');
    assert.equal(seasonNoteLine({ ...draft, registrationFee: 0, spotCount: 26 }, true, TODAY), 'Ready to open registration');
  });
});

describe('1b · the checklist before Open registration (9a·4, copy §3)', () => {
  it('three steps: divisions with sizes, the dates, the fee (0 is free)', () => {
    const steps = seasonChecklist({ seasonStartDate: null, seasonEndDate: null, divisionCount: 1, spotCount: null, registrationFee: null });
    assert.deepEqual(steps.map(s => [s.key, s.done]), [['divisions', false], ['dates', false], ['fee', false]]);
    assert.equal(steps[0].line, 'Add a division, and give each one its number of spots');
    const done = seasonChecklist({ seasonStartDate: '2027-05-31', seasonEndDate: '2027-08-30', divisionCount: 1, spotCount: 14, registrationFee: 0 });
    assert.ok(done.every(s => s.done));
    assert.deepEqual(done.map(s => s.line), ['1 division · 14 spots', 'May 31 – Aug 30, 2027', 'Free']);
    assert.match(seasonChecklist({ ...{ seasonStartDate: null, seasonEndDate: null, divisionCount: 0, spotCount: null }, registrationFee: 165 })[2].line, /^\$165\.00 per player$/);
  });
});

describe('2 · the screen (frame A)', () => {
  const home = readCode('app/[orgSlug]/admin/house-league/page.tsx');
  it('groups by what is happening: Running now, Getting ready only when it has a season, Past seasons a closed shelf', () => {
    assert.match(home, /<ClubSection title="Running now" list>/);
    assert.match(home, /\{ready\.length > 0 && \(\s*<ClubSection title="Getting ready" list>/);
    assert.match(home, /useState\(false\)[\s\S]*aria-expanded=\{pastOpen\}/, 'the shelf starts closed');
    assert.match(home, /No season is running right now\./);
  });
  it('each row is a whole link, with no status buttons and no division chip (status changes ask, in the season)', () => {
    assert.match(home, /<ClubRow[\s\S]*as="link"/);
    assert.doesNotMatch(home, /method: 'PATCH'|NEXT_TRANSITION|Mark complete|divisionBadge/);
  });
  it('the waiting count is the amber pill alone, said in words', () => {
    assert.match(home, /aria-label=\{toReviewLabel\(s\.pendingReviewCount\)\}/);
  });
  it('Create season asks, through the gate, and the dead fee switch is not in it (S1·b)', () => {
    assert.match(home, /canRun \? \(/);
    const dialog = readCode('components/admin/kit/club/CreateLeagueSeasonDialog.tsx');
    assert.match(dialog, /<KitDialog/);
    assert.doesNotMatch(dialog, /autoGenerateFees|Auto-generate fee entries/);
  });
  it('the home is on the kit: no old stylesheet, no kit-style patches', () => {
    assert.doesNotMatch(home, /house-league\.module\.css|useKitStyle|hasCapability|userRole/);
  });
});
