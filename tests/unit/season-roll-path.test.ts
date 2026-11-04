import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bornMovedLine, bornYearsForPath, closesLine, defaultTicked, divisionForMovingUp, divisionHint, nextAgeDivision,
  parseRollChoice, pickCarriedPlayers, rollChoiceLine, rollPlayerChoices, rosterOutcomeLine, theSeason,
  bringAnywayNote, PAST_PLAYER_PICKER_BUILT, ROLL_PATH_REQUIRED, ROLL_CHOOSE_FIRST, ROLL_FACTS_FAILED, ROLL_FACTS_READING,
  rollRequestFields, rollWaitReason, type RollPlayer,
} from '../../lib/season-roll-path.ts';
import { startLead } from '../../lib/club-season-words.ts';

/**
 * Club Tier Stage 14a — "What is the team doing next season?" (drawn + ruled 2026-11-04, Asks 1–3, all A).
 * The roll used to carry every active player AND move the birth years, both paths at once. These pin the
 * window's rules and words, and that the roll and both routes ask the module rather than deciding inline.
 */
const JAN1 = { m: 1, d: 1 };
const SEP1 = { m: 9, d: 1 };
const y = (from: number | null, to: number | null) => ({ from, to });
const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('the age group moves up only when the division starts with an age (Ask 3)', () => {
  it('11U AAA → 12U AAA, and the rest of the name rides along', () => {
    assert.equal(nextAgeDivision('11U AAA'), '12U AAA');
    assert.equal(nextAgeDivision('9u'), '10u');
    assert.equal(nextAgeDivision('11U'), '12U');
  });
  it('U11 → U12, U-11 Girls → U-12 Girls', () => {
    assert.equal(nextAgeDivision('U11'), 'U12');
    assert.equal(nextAgeDivision('U-11 Girls'), 'U-12 Girls');
  });
  it('"11 and under" → "12 and under"', () => {
    assert.equal(nextAgeDivision('11 and under'), '12 and under');
  });
  it('no age first, no guess: Mosquito, AAA, a bare 11, a birth year, an empty box', () => {
    for (const d of ['Mosquito', 'AAA', '11', '2015 Birth Year', '', '   ', null, undefined, 'Under 11']) {
      assert.equal(nextAgeDivision(d), null, String(d));
    }
  });
  it('the box opens on the moved-up division, else the division as it stands', () => {
    assert.equal(divisionForMovingUp('11U AAA'), '12U AAA');
    assert.equal(divisionForMovingUp('Mosquito'), 'Mosquito');
    assert.equal(divisionForMovingUp(null), '');
  });
  it('the hint says where it moved from, or asks for the new name', () => {
    assert.equal(divisionHint('11U AAA'), 'Moved up from 11U AAA. Change it if your league names it differently.');
    assert.match(divisionHint('Mosquito'), /^Change it if/);
  });
});

describe('the first line reads "This closes the 2026 Season." — never "…Season season."', () => {
  it('a name ending in season takes no second one, in any case', () => {
    assert.equal(closesLine('2026 Season'), 'This closes the 2026 Season.');
    assert.equal(closesLine('Spring SEASON'), 'This closes the Spring SEASON.');
    assert.equal(closesLine('Fall 2026'), 'This closes the Fall 2026 season.');
    assert.equal(theSeason('Preseason'), 'the Preseason season', '"Preseason" does not end in the word season');
  });
  it('the club window says it through the same rule', () => {
    assert.match(startLead({ fromName: '2026 Season', fromIsLive: true }), /^This closes the 2026 Season\. /);
    assert.match(startLead({ fromName: 'Fall 2026', fromIsLive: true }), /^This closes the Fall 2026 season\. /);
    assert.match(startLead({ fromName: '2026 Season', fromIsLive: false }), /^The 2026 Season stays closed/);
  });
  it('the coach window no longer hand-writes it, and the stale goals-offer bullet is gone', () => {
    const modal = read('components/coaches/StartNextSeasonModal.tsx');
    assert.doesNotMatch(modal, /This closes the \{currentSeasonName\} season/);
    assert.match(modal, /closesLine\(currentSeasonName\)/);
    assert.doesNotMatch(modal, /will offer to bring their open goals forward/);
    assert.doesNotMatch(modal, /Your active roster comes with you/);
  });
});

describe('birth years follow the path (Ask 1)', () => {
  it('(a) the same players: the years stay, and nothing is marked as moved', () => {
    assert.deepEqual(bornYearsForPath('moving_up', y(2015, 2016)), { years: y(2015, 2016), carried: false });
  });
  it('(b) a new group: one year later, marked moved only when a side was set', () => {
    assert.deepEqual(bornYearsForPath('new_group', y(2015, 2016)), { years: y(2016, 2017), carried: true });
    assert.deepEqual(bornYearsForPath('new_group', y(null, null)), { years: y(null, null), carried: false });
  });
  it('(b)\'s box: "Born 2016–2017 (was 2015–2016)", and nothing for a team with no years', () => {
    assert.deepEqual(bornMovedLine(y(2015, 2016), JAN1), { now: 'Born 2016–2017', was: '(was 2015–2016)' });
    assert.equal(bornMovedLine(y(null, null), JAN1), null);
    assert.deepEqual(bornMovedLine(y(2015, 2016), SEP1), { now: 'Born Sep 1, 2016 – Aug 31, 2017', was: '(was Sep 1, 2015 – Aug 31, 2016)' });
  });
  it('the roll reads the path\'s years and writes them in the season\'s one insert', () => {
    const roll = read('lib/rep-season-rollover.ts');
    assert.match(roll, /bornYearsForPath\(path, \{ from: currentSeason\.bornFromYear \?\? null, to: currentSeason\.bornToYear \?\? null \}\)/);
    assert.doesNotMatch(roll, /rollBornYears\(/, 'the roll must not move the years itself — the path decides');
  });
});

describe('the choice lines, coach and club (the drawing\'s frames)', () => {
  const facts = { division: '11U AAA', born: y(2015, 2016), cutoff: JAN1 };
  it('the coach names the division; the players come or don\'t', () => {
    assert.equal(rollChoiceLine('moving_up', { portal: 'coach', ...facts }), '11U AAA becomes 12U AAA. Your players come with you.');
    assert.equal(rollChoiceLine('new_group', { portal: 'coach', ...facts }), 'Stays 11U AAA. Last season’s players don’t come with the team.');
  });
  it('the club names the birth years, because the club sets them', () => {
    assert.equal(rollChoiceLine('moving_up', { portal: 'club', ...facts }), '11U AAA becomes 12U AAA. Birth years stay 2015–2016.');
    assert.equal(rollChoiceLine('new_group', { portal: 'club', ...facts }), 'Stays 11U AAA. Birth years move to 2016–2017.');
  });
  it('a team with no age division and no birth years still reads as a sentence', () => {
    const bare = { division: null, born: y(null, null), cutoff: JAN1 };
    assert.equal(rollChoiceLine('moving_up', { portal: 'club', ...bare }), 'The players come with the team.');
    assert.equal(rollChoiceLine('new_group', { portal: 'club', ...bare }), 'Last season’s players don’t come with the team.');
    assert.equal(rollChoiceLine('moving_up', { portal: 'coach', ...bare, division: 'Mosquito' }), 'Your players come with you.');
  });
});

describe('who comes (Ask 2): active ticked, inactive at the bottom unticked, call-ups never listed', () => {
  const roster = [
    { id: 'i1', status: 'inactive' }, { id: 'a1', status: 'active' }, { id: 'c1', status: 'callup' }, { id: 'a2', status: 'active' },
  ];
  it('the list leaves call-ups out and puts inactive players last', () => {
    assert.deepEqual(rollPlayerChoices(roster).map(p => p.id), ['a1', 'a2', 'i1']);
  });
  it('only the active players start ticked', () => {
    const players: RollPlayer[] = [
      { id: 'a1', name: 'Maya Chen', number: '7', status: 'active' },
      { id: 'i1', name: 'Jonah Ruiz', number: null, status: 'inactive' },
    ];
    assert.deepEqual(defaultTicked(players), ['a1']);
  });
  it('the server keeps the ticks and names who stayed — never a call-up in either list', () => {
    const out = pickCarriedPlayers(roster, ['a1', 'i1']);
    assert.ok(out.ok);
    assert.deepEqual(out.carried.map(p => p.id), ['a1', 'i1']);
    assert.deepEqual(out.stayed.map(p => p.id), ['a2']);
  });
  it('an unknown id or a call-up refuses the whole pick, rather than dropping a child quietly', () => {
    assert.equal(pickCarriedPlayers(roster, ['a1', 'nope']).ok, false);
    assert.equal(pickCarriedPlayers(roster, ['c1']).ok, false);
  });
  it('nobody ticked is a real answer: nobody comes, everyone listed stays', () => {
    const out = pickCarriedPlayers(roster, []);
    assert.ok(out.ok);
    assert.equal(out.carried.length, 0);
    assert.deepEqual(out.stayed.map(p => p.id), ['a1', 'a2', 'i1']);
  });
  /* ⚠ THE PLAN'S BUILD GATE (Club Tier Stage 14 S2): "a roll never invents a duplicate for a child already on the new
     season". Two halves: the new entry IS the old entry's child (never a fresh one), and one child comes once. The
     database half — an entry inserted with the old child plus its confirmed link mints nothing — is rule 2 of
     tests/sql/org-children-fixture.sql. */
  it('a roll never invents a duplicate: one child comes once, and is not also "stayed"', () => {
    const twice = [
      { id: 'a1', status: 'active', childId: 'k1' }, { id: 'a1b', status: 'active', childId: 'k1' },
      { id: 'i1', status: 'inactive', childId: 'k1' }, { id: 'a2', status: 'active', childId: 'k2' },
    ];
    const out = pickCarriedPlayers(twice, ['a1', 'a1b', 'a2']);
    assert.ok(out.ok);
    assert.deepEqual(out.carried.map(p => p.id), ['a1', 'a2']);
    assert.deepEqual(out.stayed.map(p => p.id), [], 'k1 is coming, so none of its entries "stayed"');
  });
  it('the carried entry is the same child — the roll passes it, never leaves it to the best-effort link', () => {
    const roll = read('lib/rep-season-rollover.ts');
    const call = roll.slice(roll.indexOf('await createRepRosterPlayer({'), roll.indexOf('playerIdMap.set(p.id, created.id)'));
    assert.match(call, /childId: p\.childId,/);
  });
  it('the roll carries the pick, not every active player, and checks it before writing anything', () => {
    const roll = read('lib/rep-season-rollover.ts');
    assert.match(roll, /for \(const p of picked\.carried\)/);
    assert.doesNotMatch(roll, /players\.filter\(p => p\.status === 'active'\)/);
    const pick = roll.indexOf('pickCarriedPlayers(lastRoster');
    const insert = roll.indexOf(".from('rep_program_years')\n      .insert");
    assert.ok(pick > 0 && insert > pick, 'the pick is checked before the new season is inserted');
  });
});

describe('the request: the path is required, in both routes', () => {
  it('no path, no roll — in plain words', () => {
    assert.deepEqual(parseRollChoice({ carryPlayerIds: [] }), { ok: false, error: ROLL_PATH_REQUIRED });
    assert.deepEqual(parseRollChoice({ path: 'both', carryPlayerIds: [] }), { ok: false, error: ROLL_PATH_REQUIRED });
    assert.equal(parseRollChoice(null).ok, false);
  });
  it('the players are a list of ids; duplicates collapse', () => {
    assert.equal(parseRollChoice({ path: 'new_group' }).ok, false);
    assert.equal(parseRollChoice({ path: 'new_group', carryPlayerIds: [3] }).ok, false);
    const ok = parseRollChoice({ path: 'moving_up', carryPlayerIds: ['a', 'a', 'b'] });
    assert.ok(ok.ok);
    assert.deepEqual(ok.carryPlayerIds, ['a', 'b']);
    assert.equal(ok.division, undefined, 'absent leaves the division alone');
  });
  it('the division: trimmed, empty is none, over 30 characters is refused', () => {
    const d = (division: unknown) => parseRollChoice({ path: 'moving_up', carryPlayerIds: [], division });
    const a = d('  12U AAA ');
    assert.ok(a.ok); assert.equal(a.division, '12U AAA');
    const b = d('');
    assert.ok(b.ok); assert.equal(b.division, null);
    assert.equal(d('x'.repeat(31)).ok, false);
    assert.equal(d(12).ok, false);
  });
  it('both season routes parse it and hand the roll the path, the ids and (on (a) only) the division', () => {
    for (const rel of ['app/api/coaches/[orgSlug]/teams/[teamId]/seasons/route.ts', 'app/api/admin/rep-teams/teams/[teamId]/seasons/route.ts']) {
      const src = read(rel);
      assert.match(src, /const choice = parseRollChoice\(body\);/, rel);
      assert.match(src, /path: choice\.path,/, rel);
      assert.match(src, /division: choice\.division,/, rel); // the roll itself writes it on (a) only (next test)
    }
  });
  it('the roll changes the division on (a) only, and never the team\'s name', () => {
    const roll = read('lib/rep-season-rollover.ts');
    assert.match(roll, /if \(path === 'moving_up' && params\.division !== undefined/);
    assert.match(roll, /updateRepTeam\(teamId, \{ division: params\.division \}\)/);
    assert.doesNotMatch(roll, /updateRepTeam\([^)]*name:/);
  });
});

describe('the success view\'s roster line (the only bullet that changed)', () => {
  const jonah = { firstName: 'Jonah', name: 'Jonah Ruiz' };
  it('(a) names who came, as what, and who stayed — the picker\'s clause waits for the picker', () => {
    assert.equal(rosterOutcomeLine({ path: 'moving_up', copied: 13, division: '12U AAA', stayed: [jonah], fromSeasonName: '2026 Season', pickerBuilt: true }),
      '13 players came with the team as 12U AAA. Jonah Ruiz stayed on the 2026 Season. Bring Jonah back from Roster any time.');
    assert.equal(rosterOutcomeLine({ path: 'moving_up', copied: 13, division: '12U AAA', stayed: [jonah], fromSeasonName: '2026 Season', pickerBuilt: false }),
      '13 players came with the team as 12U AAA. Jonah Ruiz stayed on the 2026 Season.');
  });
  it('several stayed: names, then a count; never a guessed pronoun', () => {
    const many = ['Ana Li', 'Sam Park', 'Jo Ng', 'Ty Bo', 'Al Fe'].map(n => ({ firstName: n.split(' ')[0], name: n }));
    const line = rosterOutcomeLine({ path: 'moving_up', copied: 9, division: null, stayed: many, fromSeasonName: '2026 Season', pickerBuilt: true });
    assert.equal(line, '9 players came with the team. Ana Li, Sam Park, Jo Ng and 2 others stayed on the 2026 Season. Bring any of them back from Roster any time.');
    assert.doesNotMatch(line, /\b(him|her|his|hers)\b/);
  });
  it('(b) an empty roster says so', () => {
    assert.equal(rosterOutcomeLine({ path: 'new_group', copied: 0, division: '11U AAA', stayed: [jonah], fromSeasonName: '2026 Season', pickerBuilt: true }),
      'The roster is empty. Add players, open tryouts, or bring back a past player from Roster.');
    assert.equal(rosterOutcomeLine({ path: 'new_group', copied: 0, division: null, stayed: [], fromSeasonName: '2026 Season', pickerBuilt: false }),
      'The roster is empty. Add players or open tryouts.');
  });
  it('(b) with the box ticked never claims an age group moved', () => {
    assert.equal(rosterOutcomeLine({ path: 'new_group', copied: 2, division: '11U AAA', stayed: [], fromSeasonName: '2026 Season' }),
      '2 players came with the team.');
  });
  it('until the past-player picker ships (Stage 14 S3), no sentence points at it', () => {
    assert.equal(PAST_PLAYER_PICKER_BUILT, false, 'S3 flips this in the change that ships the picker');
    assert.equal(bringAnywayNote(), 'Leave this off for a new group.');
    assert.equal(bringAnywayNote(true), 'Leave this off for a new group. You can bring anyone back from the Roster later.');
  });
});

describe('both windows ask, with nothing chosen when they open', () => {
  it('the coach window and the club window start with no path and wait with the reason in the foot', () => {
    for (const rel of ['components/coaches/StartNextSeasonModal.tsx', 'components/admin/kit/club/SeasonDialogs.tsx']) {
      const src = read(rel);
      assert.match(src, /useState<SeasonRollPath \| null>\(null\)/, rel);
      assert.match(src, /rollWaitReason\(path, /, rel);
      assert.match(src, /rollRequestFields\(\{ path, /, rel);
      assert.match(src, /disabled=\{[^}]*!!waitReason\}/, rel);
    }
  });
  it('the shared helpers: the button waits for a path, then for the facts; the request follows the path', () => {
    const facts = { players: [{ id: 'a', name: 'A', number: '1', status: 'active' as const }, { id: 'b', name: 'B', number: null, status: 'inactive' as const }], division: '11U AAA', born: y(2015, 2016), cutoff: JAN1 };
    assert.equal(rollWaitReason(null, facts, false), ROLL_CHOOSE_FIRST);
    assert.equal(rollWaitReason('moving_up', null, true), ROLL_FACTS_FAILED);
    assert.equal(rollWaitReason('moving_up', null, false), ROLL_FACTS_READING);
    assert.equal(rollWaitReason('moving_up', facts, false), null);
    assert.deepEqual(rollRequestFields({ path: 'moving_up', ticked: ['a', 'b'], bringAnyway: true, facts, division: ' 12U AAA ' }),
      { path: 'moving_up', carryPlayerIds: ['a', 'b'], division: '12U AAA' });
    assert.deepEqual(rollRequestFields({ path: 'new_group', ticked: ['a'], bringAnyway: false, facts, division: '12U AAA' }),
      { path: 'new_group', carryPlayerIds: [] });
    assert.deepEqual(rollRequestFields({ path: 'new_group', ticked: [], bringAnyway: true, facts, division: '' }),
      { path: 'new_group', carryPlayerIds: ['a'] });
    // A team with no division sends none; an emptied box sends null (= clear it).
    assert.deepEqual(rollRequestFields({ path: 'moving_up', ticked: [], bringAnyway: false, facts: { ...facts, division: null }, division: 'x' }),
      { path: 'moving_up', carryPlayerIds: [] });
    assert.deepEqual(rollRequestFields({ path: 'moving_up', ticked: [], bringAnyway: false, facts, division: '  ' }),
      { path: 'moving_up', carryPlayerIds: [], division: null });
  });
  it('the club\'s fixed "The roster · the 14 active players" row is gone', () => {
    const src = read('components/admin/kit/club/SeasonDialogs.tsx');
    assert.doesNotMatch(src, /rosterCarryDetail\(/);
  });
});
