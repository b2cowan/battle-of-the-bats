import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEXT_SEASON_DAYS, START_FROM_WORDS as W, bornShiftYears, broughtList, bumpedName, checklistPrints, dateShiftDays,
  datesMoved, honouredBring, markedLines, moveBornYears, movedDates, optionLine, readStartedFrom, shiftStamp, startName,
  startPrints, startedLine, type PrintDivision, type PrintSeason, type StartSource, type StartedFrom,
} from '../../lib/house-league-start-from';

/**
 * Start next season (House League 9f-2): the pure decision. The s15 table of the 9f drawings
 * (`HOUSE_LEAGUE_STAGE9F_DRAWINGS.html`, tab 5) is pinned row for row, and every §14.1 string verbatim.
 */

const draft2027: StartSource = {
  id: 'src', name: 'Draft Test 2027', status: 'completed',
  seasonStartDate: '2027-05-01', seasonEndDate: '2027-08-28',
  registrationOpenAt: '2027-03-01T08:00:00Z', registrationCloseAt: '2027-04-16T23:59:00Z', earlyBirdUntil: '2027-03-15',
};
const fallBall: StartSource = { ...draft2027, id: 'live', name: 'Fall Ball 2027', status: 'active' };

describe('the s15 table: 52 weeks, same weekday, time kept', () => {
  const moved = movedDates(draft2027, dateShiftDays(draft2027));
  test('all five dates', () => {
    assert.equal(dateShiftDays(draft2027), NEXT_SEASON_DAYS);
    assert.deepEqual(moved, {
      seasonStartDate: '2028-04-29', seasonEndDate: '2028-08-26',
      registrationOpenAt: '2028-02-28T08:00:00Z', registrationCloseAt: '2028-04-14T23:59:00Z', earlyBirdUntil: '2028-03-13',
    });
  });
  test('every date keeps its weekday', () => {
    const wd = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).getUTCDay();
    for (const k of Object.keys(moved) as (keyof typeof moved)[]) {
      assert.equal(wd(moved[k]!), wd((draft2027 as unknown as Record<string, string>)[k]), k);
    }
  });
  test('all four birth-year pairs move up one', () => {
    const by = bornShiftYears(draft2027, moved);
    assert.equal(by, 1);
    const pairs: [number, number, number, number][] = [[2019, 2020, 2020, 2021], [2017, 2018, 2018, 2019], [2015, 2016, 2016, 2017], [2013, 2014, 2014, 2015]];
    for (const [f, t, nf, nt] of pairs) assert.deepEqual(moveBornYears({ from: f, to: t }, by), { from: nf, to: nt });
    assert.deepEqual(moveBornYears({ from: null, to: 2018 }, by), { from: null, to: 2019 });
  });
});

describe('birth years: year numbers, not elapsed time', () => {
  test('May 1 2027 → Apr 29 2028 is 363 days and still one year', () => {
    assert.equal(bornShiftYears(draft2027, { seasonStartDate: '2028-04-29' }), 1);
  });
  test('two years out moves two', () => {
    assert.equal(bornShiftYears(draft2027, { seasonStartDate: '2029-04-28' }), 2);
  });
  test('never moves down; a live source never moves', () => {
    assert.equal(bornShiftYears(draft2027, { seasonStartDate: '2026-05-01' }), 0);
    assert.equal(bornShiftYears(fallBall, { seasonStartDate: '2028-04-29' }), 0);
  });
  test('no first day on either side: the last day stands in, then one', () => {
    const noFirst = { ...draft2027, seasonStartDate: null };
    assert.equal(bornShiftYears(noFirst, { seasonEndDate: '2028-08-26' }), 1);
    assert.equal(bornShiftYears({ ...draft2027, seasonStartDate: null, seasonEndDate: null }, {}), 1);
  });
});

describe('dates: edits, leap years, live and empty sources', () => {
  test('an edited first day moves the other four by the same gap', () => {
    const shift = dateShiftDays(draft2027, '2028-05-06');
    assert.equal(shift, 371);
    const m = movedDates(draft2027, shift);
    assert.equal(m.seasonEndDate, '2028-09-02');
    assert.equal(m.registrationOpenAt, '2028-03-06T08:00:00Z');
  });
  test('a leap-year source: Feb 29 2028 moves to Feb 27 2029', () => {
    const leap = { ...draft2027, seasonStartDate: '2028-02-29', seasonEndDate: '2028-06-30' };
    assert.deepEqual([movedDates(leap, NEXT_SEASON_DAYS).seasonStartDate, movedDates(leap, NEXT_SEASON_DAYS).seasonEndDate], ['2029-02-27', '2029-06-29']);
  });
  test('a live source: all five arrive empty', () => {
    assert.equal(dateShiftDays(fallBall, '2028-04-29'), null);
    assert.deepEqual(Object.values(movedDates(fallBall, null)), [null, null, null, null, null]);
    assert.equal(datesMoved(fallBall, null), false);
  });
  test('a source with no dates: nothing arrives, nothing moved', () => {
    const none = { ...draft2027, seasonStartDate: null, seasonEndDate: null, registrationOpenAt: null, registrationCloseAt: null, earlyBirdUntil: null };
    assert.equal(datesMoved(none, dateShiftDays(none)), false);
    assert.deepEqual(Object.values(movedDates(none, NEXT_SEASON_DAYS)), [null, null, null, null, null]);
  });
  test('the time suffix is kept as stored, whatever its shape', () => {
    assert.equal(shiftStamp('2027-03-01T08:00:00+00:00', 364), '2028-02-28T08:00:00+00:00');
    assert.equal(shiftStamp(null, 364), null);
    assert.equal(shiftStamp('not a date', 364), null);
  });
});

describe('the name', () => {
  test('one year goes up', () => {
    assert.equal(bumpedName('Draft Test 2027', 1), 'Draft Test 2028');
    assert.equal(bumpedName('2027 Summer', 2), '2029 Summer');
    assert.equal(startName(draft2027), 'Draft Test 2028');
  });
  test('no year, or two, comes in empty', () => {
    assert.equal(bumpedName('Fall Ball', 1), null);
    assert.equal(bumpedName('Winter 2026-2027', 1), null);
    assert.equal(bumpedName('Spring 2026 and 2027', 1), null);
    assert.equal(bumpedName('Team 12027', 1), null);
  });
  test('a January 1 start still gets a new name (52 weeks later is Dec 31 of the same year)', () => {
    const jan = { ...draft2027, name: 'Winter 2027', seasonStartDate: '2027-01-01', seasonEndDate: '2027-03-31' };
    assert.equal(movedDates(jan, NEXT_SEASON_DAYS).seasonStartDate, '2027-12-31');
    assert.equal(startName(jan), 'Winter 2028');
  });
  test('a live source: empty', () => {
    assert.equal(startName(fallBall), '');
  });
});

describe('what comes across', () => {
  test('dependants follow what they hang on', () => {
    assert.deepEqual(honouredBring({ settings: true, ageGroups: false, teams: true, practice: true, coaches: true }),
      { settings: true, ageGroups: false, teams: false, practice: false, coaches: false });
    assert.deepEqual(honouredBring({ ageGroups: true, teams: false, coaches: true }),
      { settings: false, ageGroups: true, teams: false, practice: false, coaches: false });
    assert.deepEqual(honouredBring(null), { settings: false, ageGroups: false, teams: false, practice: false, coaches: false });
  });
  test('the banner list names only what was ticked; practice settings never', () => {
    assert.equal(broughtList({ settings: true, ageGroups: 4, teams: 22, practice: true, coaches: 0 }), 'settings, 4 age groups and 22 team names');
    assert.equal(broughtList({ settings: true, ageGroups: 4, teams: 22, practice: true, coaches: 31 }), 'settings, 4 age groups, 22 team names and 31 coaches');
    assert.equal(broughtList({ settings: false, ageGroups: 1, teams: 1, practice: false, coaches: 1 }), '1 age group, 1 team name and 1 coach');
  });
});

describe('fingerprints: a mark goes once its line is edited', () => {
  const season: PrintSeason = {
    registrationFee: 150, registrationOpenAt: '2028-02-28T08:00:00Z', registrationCloseAt: '2028-04-14T23:59:00Z',
    earlyBirdUntil: '2028-03-13', howToPay: 'E-transfer to treasurer@devleague.ca', waiverText: 'I agree.',
  };
  const divisions: PrintDivision[] = [
    { name: 'U8', capacity: 40, bornFromYear: 2020, bornToYear: 2021, price: 150, earlyPrice: 130 },
    { name: 'U10', capacity: 60, bornFromYear: 2018, bornToYear: 2019, price: 175, earlyPrice: null },
  ];
  const brought = { settings: true, ageGroups: 2, teams: 0, practice: true, coaches: 0 };
  const from: StartedFrom = { sourceId: 'src', sourceName: 'Draft Test 2027', live: false, shiftDays: 364, bornShift: 1, brought, prints: startPrints(season, divisions, brought, 364) };

  test('every line marked as it arrived, whatever shape the database hands back', () => {
    const readBack: PrintSeason = { ...season, registrationFee: '150.00', registrationOpenAt: '2028-02-28T08:00:00+00:00', registrationCloseAt: '2028-04-14T23:59:00+00:00' };
    const rowsBack = [...divisions].reverse().map(d => ({ ...d, price: d.price == null ? null : `${d.price}.00` }));
    assert.deepEqual([...markedLines(from, readBack, rowsBack)].sort(), ['ageGroups', 'dates', 'pay', 'prices', 'waiver']);
  });
  test('editing one line clears only its mark', () => {
    assert.ok(!markedLines(from, { ...season, howToPay: 'Cash' }, divisions).has('pay'));
    assert.ok(markedLines(from, { ...season, howToPay: 'Cash' }, divisions).has('waiver'));
    const bigger = divisions.map((d, i) => (i === 0 ? { ...d, capacity: 50 } : d));
    assert.ok(!markedLines(from, season, bigger).has('ageGroups'));
    assert.ok(markedLines(from, season, bigger).has('prices'));
    assert.ok(!markedLines(from, { ...season, registrationCloseAt: '2028-04-15T23:59:00Z' }, divisions).has('dates'));
    assert.ok(!markedLines(from, season, [...divisions, { ...divisions[0], name: 'U12' }]).has('ageGroups'));
  });
  test('only what came is printed', () => {
    const none = startPrints(season, divisions, { settings: false, ageGroups: 0, teams: 0, practice: false, coaches: 0 }, null);
    assert.deepEqual(none, {});
    const noPay = startPrints({ ...season, howToPay: '  ' }, divisions, brought, null);
    assert.deepEqual(Object.keys(noPay).sort(), ['ageGroups', 'prices', 'waiver']);
  });
  test('the prints are deterministic and differ by content', () => {
    assert.deepEqual(checklistPrints(season, divisions), checklistPrints(season, [...divisions].reverse()));
    assert.notEqual(checklistPrints(season, divisions).pay, checklistPrints({ ...season, howToPay: 'x' }, divisions).pay);
  });
  test('a stored record reads back; a malformed one reads as none', () => {
    assert.deepEqual(readStartedFrom(JSON.parse(JSON.stringify(from))), from);
    assert.equal(readStartedFrom(null), null);
    assert.equal(readStartedFrom({ sourceName: 'x' }), null);
    assert.equal(readStartedFrom('nope'), null);
  });
});

describe('the words, verbatim (§14.1)', () => {
  test('Start from and its list', () => {
    assert.equal(W.label, 'Start from');
    assert.equal(W.blank, 'A blank season');
    assert.equal(W.blankSub, 'Name, sport and dates only.');
    assert.equal(optionLine('Finished', 4, 22), 'Finished · 4 age groups · 22 teams');
    assert.equal(optionLine('Playing now', 1, 0), 'Playing now · 1 age group · 0 teams');
  });
  test('the statement and the owing clause', () => {
    assert.equal(W.left('Draft Test 2027'), 'Draft Test 2027 is left exactly as it was. Its families, payments, games and scores stay with it.');
    assert.equal(W.owes(3, '$525'), '3 players still owe $525 there. That stays on its Money tab.');
    assert.equal(W.owes(1, '$175'), '1 player still owes $175 there. That stays on its Money tab.');
  });
  test('the dates, with the possessive built by possessive()', () => {
    assert.equal(W.dates('Draft Test 2027', 364, false), '52 weeks after Draft Test 2027’s dates, so every day falls on the same weekday. The registration dates and the early price move the same way; check them on the new season’s Overview.');
    assert.equal(W.dates('Draft Test 2027', 364, true), '52 weeks after Draft Test 2027’s dates, on the same weekdays.');
    assert.equal(W.dates('Summer Sessions', 364, true), '52 weeks after Summer Sessions’ dates, on the same weekdays.');
    assert.equal(W.dates('Draft Test 2027', 366, true), '366 days after Draft Test 2027’s dates.');
    assert.equal(W.datesLive('Fall Ball 2027'), 'Fall Ball 2027 isn’t finished, so no dates come across. Set the new season’s own.');
  });
  test('Bring with it', () => {
    assert.equal(W.bringTitle, 'Bring with it');
    assert.equal(W.settings, 'The season’s settings');
    assert.equal(W.ageGroups, 'Age groups');
    assert.equal(W.ageGroupsSub({ name: 'U10', from: 2017, to: 2018 }, 1, false), 'Names, sizes, prices, early prices, notes, games per team and Show standings. Birth years move up one year: U10 becomes born 2018–2019.');
    assert.equal(W.ageGroupsSub(null, 1, true), 'Birth years move up one year.');
    assert.equal(W.ageGroupsSub(null, 2, true), 'Birth years move up two years.');
    assert.equal(W.ageGroupsLive, 'Choose which age groups come across.');
    assert.equal(W.teams, 'Team names and colours');
    assert.equal(W.teamsSub, 'No players. You run the draft again.');
    assert.equal(W.practice, 'Practice length and teams at once');
    assert.equal(W.practiceSub, 'For each age group.');
    assert.equal(W.coaches, 'Coaches');
    assert.equal(W.coachesSub(false), 'Names and emails, on the same teams. Nobody is invited until you publish teams.');
    assert.equal(W.coachesSub(true), 'Invited only when you publish teams.');
  });
  test('always empty and the foot', () => {
    assert.equal(W.empty(false), 'Always starts empty: registrations and payments, ratings, games and scores, practices, emails and notices, and the club’s time. The club gives the new season its time, as it does every season.');
    assert.equal(W.empty(true), 'Always starts empty: registrations, payments, ratings, games, practices, emails and the club’s time.');
    assert.equal(W.foot, 'Families are not emailed.');
  });
  test('the new season: banner and marks', () => {
    const from = { sourceId: 's', sourceName: 'Draft Test 2027', live: false, shiftDays: 364, bornShift: 1, prints: {},
      brought: { settings: true, ageGroups: 4, teams: 22, practice: true, coaches: 0 } };
    assert.equal(startedLine(from, false), 'Started from Draft Test 2027: settings, 4 age groups and 22 team names. Check each line, then open registration.');
    assert.equal(startedLine(from, true), 'Started from Draft Test 2027. Check each line, then open registration.');
    assert.equal(W.markFrom('Draft Test 2027'), 'From Draft Test 2027');
    assert.equal(W.markMoved(364), 'Moved 52 weeks');
    assert.equal(W.ageLineMoved(1), 'birth years moved up one year');
    assert.equal(W.noTime, 'The club hasn’t given this season any time yet.');
    assert.equal(W.noTimeHowAdmin, 'It gives it in the club’s Schedules; games and practices can be made once it has.');
  });
});

describe('the route: this club’s season only, never the free League plan, all or nothing', async () => {
  const { readCode } = await import('./_source-code.ts');
  const route = readCode('app/api/admin/house-league/seasons/route.ts');
  const server = readCode('lib/house-league-start-from-server.ts');
  test('the cap check runs before Start from, and the free League plan is refused', () => {
    assert.ok(route.indexOf('houseLeagueSeasonCap(') < route.indexOf('readStartFromBody('), 'the free plan’s one season is checked first');
    assert.match(route, /if \(startFrom\) \{\s*if \(isFreeFloorLeague\(ctx!\.org\)\) return forbidden\(\);/);
  });
  test('the source is read with this club’s id: a direct request cannot copy another club’s season', () => {
    assert.match(server, /from\('league_seasons'\)\.select\(SEASON_COLS\)\s*\.eq\('id', seasonId\)\.eq\('org_id', orgId\)/);
    assert.match(route, /loadStartSource\(ctx!\.org\.id, startFrom\.seasonId\)/);
  });
  test('a failed step deletes the new season; nothing is written to the source', () => {
    assert.match(server, /catch \(err\) \{[\s\S]*?deleteDraftLeagueSeason\(made\.id, base\.orgId\)[\s\S]*?throw err;/);
    assert.doesNotMatch(server, /\.update\(/, 'the copy never updates a row: the source is only read');
    assert.doesNotMatch(server, /token_hash|invited_at|user_id:/, 'a copied coach carries no invite state');
  });
});
