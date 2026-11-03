import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RAIN_WORDS as W, rainDays, rainLine, rainList, rainOpenDay, rainPractices, rainSummary, shortDivision,
  type RainGame, type RainSource,
} from '../../lib/league-rainout.ts';

/** House League 9e-2 Part 2: the Rainout window's plan — the days, the list, the counts, the practices, the words. */
const TODAY = '2027-06-17';
// 22:00Z is 6:00 p.m. in Toronto (EDT); 02:00Z the next UTC day is still 10:00 p.m. on the 17th there.
const at = (day: string, hhmmZ = '22:00') => `${day}T${hhmmZ}:00+00:00`;

let n = 0;
const game = (divisionId: string, home: string, away: string, o: Partial<RainGame> = {}): RainGame => ({
  id: `g${++n}`, divisionId, homeTeamId: home, awayTeamId: away, scheduledAt: at(TODAY),
  place: 'Maple Grove Park', field: 'Diamond 1', seen: '2027-06-01T00:00:00.123456+00:00', ...o,
});

/** U10 (4 games, 8 teams), U12 (5 games, 10 teams), U14 (3 games, 6 teams) today; U8 is a draft with 2 games today. */
function source(o: Partial<RainSource> = {}): RainSource {
  n = 0;
  const pair = (d: string, i: number) => [`${d}-t${2 * i + 1}`, `${d}-t${2 * i + 2}`] as const;
  const games: RainGame[] = [
    ...[0, 1, 2, 3].map(i => game('u10', ...pair('u10', i), i % 2 ? { place: 'Riverside', field: 'Diamond 3' } : {})),
    ...[0, 1, 2, 3, 4].map(i => game('u12', ...pair('u12', i))),
    ...[0, 1, 2].map(i => game('u14', ...pair('u14', i), { scheduledAt: at(TODAY, '23:30') })),
    ...[0, 1].map(i => game('u8', ...pair('u8', i))),
    // Another day: 4 games on the 18th; an earlier day's unscored game.
    ...[0, 1, 2, 3].map(i => game('u12', ...pair('u12', i), { scheduledAt: at('2027-06-18') })),
    game('u10', 'u10-t1', 'u10-t2', { scheduledAt: at('2027-06-10') }),
  ];
  const teams = games.flatMap(g => [g.homeTeamId, g.awayTeamId]);
  // One family per team in U10/U12/U14, plus the Okafors (children in U10 and U12) and the Kims (two in U12).
  const families: string[][] = [...new Set(teams.filter(t => !t.startsWith('u8')))].map(t => [t]);
  families.push(['u10-t1', 'u12-t1'], ['u12-t3', 'u12-t4']);
  return {
    today: TODAY,
    divisions: [
      { id: 'u8', name: 'U8 Division', published: false },
      { id: 'u10', name: 'U10 Division', published: true },
      { id: 'u12', name: 'U12 Division', published: true },
      { id: 'u14', name: 'U14 Division', published: true },
    ],
    games,
    practices: [],
    families,
    ...o,
  };
}
const today = (src: RainSource) => src.games.filter(g => g.scheduledAt.startsWith(TODAY));

describe('the Day picker', () => {
  it('lists today and later days with games in a published division, never an earlier day or a draft', () => {
    const src = source();
    assert.deepEqual(rainDays(src), [{ day: TODAY, games: 12 }, { day: '2027-06-18', games: 4 }]);
    assert.equal(rainOpenDay(src), TODAY);
  });
  it('opens on the next day with games when today has none, and on nothing when no day has any', () => {
    const src = source();
    const later = { ...src, games: src.games.filter(g => !g.scheduledAt.startsWith(TODAY)) };
    assert.equal(rainOpenDay(later), '2027-06-18');
    assert.equal(rainOpenDay({ ...src, games: [] }), null);
    assert.deepEqual(rainDays({ ...src, games: [] }), []);
  });
  it('reads the day in the org zone: a 10:00 p.m. game is on its own evening, not the next UTC day', () => {
    const src = source({ games: [game('u10', 'u10-t1', 'u10-t2', { scheduledAt: '2027-06-18T02:00:00+00:00' })] });
    assert.deepEqual(rainDays(src), [{ day: TODAY, games: 1 }]);
  });
});

describe('the day\'s list', () => {
  it('lists each published division in the season\'s order, games by time, and names the draft', () => {
    const list = rainList(source(), TODAY, null);
    assert.deepEqual(list.divisions.map(d => [d.name, d.games.length, d.teams]),
      [['U10 Division', 4, 8], ['U12 Division', 5, 10], ['U14 Division', 3, 6]]);
    assert.deepEqual(list.drafts, ['U8 Division']);
    assert.deepEqual(list.places, ['Maple Grove Park', 'Riverside']);
  });
  it('one place narrows the list', () => {
    const list = rainList(source(), TODAY, 'Riverside');
    assert.deepEqual(list.divisions.map(d => [d.name, d.games.length]), [['U10 Division', 2]]);
  });
  it('a day with none left lists nothing', () => {
    const list = rainList(source(), '2027-06-20', null);
    assert.deepEqual(list, { places: [], divisions: [], drafts: [] });
  });
});

describe('what the press will do', () => {
  it('12 games across 3 divisions: one email per family per division, a family in two divisions counted twice', () => {
    const src = source();
    const s = rainSummary(src, new Set(today(src).filter(g => g.divisionId !== 'u8').map(g => g.id)));
    assert.equal(s.games, 12);
    assert.equal(s.teams, 24);
    assert.equal(s.divisions, 3);
    // 24 single-team families + the Okafors + the Kims; the Okafors are emailed once in U10 and once in U12.
    assert.equal(s.families, 26);
    assert.equal(s.emails, 27);
    assert.equal(s.multi, 1);
    // U12 alone: its 10 teams' families, the Okafors and the Kims, once each.
    assert.equal(rainSummary(src, new Set(today(src).filter(g => g.divisionId === 'u12').map(g => g.id))).emails, 12);
  });
  it('one division: its families only, nobody counted twice', () => {
    const src = source();
    const s = rainSummary(src, new Set(today(src).filter(g => g.divisionId === 'u14').map(g => g.id)));
    assert.deepEqual([s.games, s.teams, s.divisions, s.families, s.emails, s.multi], [3, 6, 1, 6, 6, 0]);
  });
  it('no families on the teams: no emails', () => {
    const src = source({ families: [] });
    const s = rainSummary(src, new Set(today(src).map(g => g.id)));
    assert.equal(s.emails, 0);
    assert.equal(s.families, 0);
  });
  it('nothing ticked: nothing', () => {
    const s = rainSummary(source(), new Set());
    assert.deepEqual([s.games, s.emails, s.divisions], [0, 0, 0]);
  });
});

describe('the day\'s practices (named, never touched)', () => {
  const practices = [
    { scheduledAt: at(TODAY), club: true }, { scheduledAt: at(TODAY), club: true }, { scheduledAt: at(TODAY), club: true },
    { scheduledAt: at(TODAY, '21:00'), club: false }, { scheduledAt: at('2027-06-18'), club: false },
  ];
  it('today: three on the club\'s time, one booked by hand', () => {
    assert.deepEqual(rainPractices(source({ practices }), TODAY), { club: 3, hand: 1 });
  });
  it('another day, and a day with none', () => {
    assert.deepEqual(rainPractices(source({ practices }), '2027-06-18'), { club: 0, hand: 1 });
    assert.equal(rainPractices(source({ practices }), '2027-06-20'), null);
  });
  it('the words say where each changes, and that a hand-booked cancel emails no one', () => {
    assert.equal(W.pracToday, 'Tonight’s practices aren’t changed here.');
    assert.equal(W.pracDay('2027-06-18'), 'Practices on Fri, Jun 18 aren’t changed here.');
    const club = W.pracClub(3);
    assert.equal(club.lead + club.link + club.tail, '3 use the club’s time: change them in the club’s Schedules.');
    const hand = W.pracHand(1);
    assert.equal(hand.lead + hand.link + hand.tail, '1 was booked by hand: change it in Practices. Cancelling it doesn’t email families.');
    assert.equal(W.pracPhone(3, 1),
      'Practices aren’t changed here: 3 use the club’s time (Schedules), 1 was booked by hand (Practices; cancelling it emails no one).');
    assert.equal(W.pracPhone(0, 2), 'Practices aren’t changed here: 2 were booked by hand (Practices; cancelling them emails no one).');
  });
});

describe('the words (COPY Part C)', () => {
  it('the summary, with its singular forms', () => {
    assert.equal(W.sum(12, 24, 3), '12 games, 24 teams, 3 divisions.');
    assert.equal(W.sumMail(214, 208, 3, 6, 24),
      '214 emails to 208 families, sent as 3, one per division. 6 of those families have children in two divisions and get two emails. The 24 teams’ coaches get a copy.');
    assert.equal(W.sumMail(9, 8, 2, 1, 4),
      '9 emails to 8 families, sent as 2, one per division. 1 of those families has children in two divisions and gets two emails. The 4 teams’ coaches get a copy.');
    assert.equal(W.sumOne(88, 88, 10), 'One division: 88 emails to 88 families. The 10 teams’ coaches get a copy.');
    assert.equal(W.sumNone(24), 'No families to email. The coaches of the 24 teams get a copy.');
    assert.equal(W.sumPhone(12, 214, 208, 3, 6), '12 games. 214 emails to 208 families in 3 sends. 6 get two.');
    assert.equal(W.sumCap, 'Doesn’t count toward today’s 3.');
  });
  it('the day, the game and the button', () => {
    assert.equal(W.dayValue(TODAY, TODAY, 12), 'Today · Thu, Jun 17 · 12 games still to play');
    assert.equal(W.dayValue('2027-06-18', TODAY, 1), 'Fri, Jun 18 · 1 game still to play');
    assert.equal(W.gameWhere(at(TODAY, '21:30'), 'Maple Grove Park', 'Diamond 1'), '5:30 p.m. · Maple Grove Park · Diamond 1');
    assert.equal(W.gameWhere(at(TODAY), null, null), '6:00 p.m.');
    assert.equal(W.go('postponed', 12, 214), 'Postpone 12 games and email 214 families');
    assert.equal(W.go('cancelled', 12, 214), 'Cancel 12 games and email 214 families');
    assert.equal(W.go('postponed', 1, 3), 'Postpone 1 game and email 3 families');
    assert.equal(W.go('postponed', 1, 1), 'Postpone 1 game and email 1 family');
    assert.equal(W.go('postponed', 12, null), 'Postpone 12 games');
    assert.equal(W.go('postponed', 12, 0), 'Postpone 12 games');
    assert.equal(W.goPhone('postponed', 12, 214), 'Postpone 12 games, email 214');
    assert.equal(W.draft('U8 Division'), 'U8 Division is a draft, so none of its games are listed.');
    assert.equal(W.draft(shortDivision('U8 Division')), 'U8 is a draft, so none of its games are listed.');
  });
  it('the results', () => {
    assert.equal(W.doneTitle('postponed', 12), '12 games postponed');
    assert.equal(W.doneTitle('cancelled', 1), '1 game cancelled');
    assert.equal(W.doneSent(214, [{ name: 'U10 Division', emails: 74 }, { name: 'U12 Division', emails: 88 }, { name: 'U14 Division', emails: 52 }], 24),
      '214 emails sent (U10 74, U12 88, U14 52). The 24 teams’ coaches have a copy.');
    assert.equal(W.doneSent(88, [{ name: 'U12 Division', emails: 88 }], 10), '88 emails sent. The 10 teams’ coaches have a copy.');
    assert.equal(W.failSome(['U10 Division', 'U12 Division'], 162, ['U14 Division'], 'postponed', 3),
      'U10 and U12 families were emailed (162). The U14 email didn’t go: its 3 postponements are waiting in Changes to send.');
    assert.equal(W.failAll('cancelled', 12), 'No emails went. The 12 cancellations are waiting in Changes to send.');
    assert.equal(W.failAll('postponed', 1), 'No emails went. The 1 postponement is waiting in Changes to send.');
    assert.equal(W.heldBody(12), 'Nobody has been told. The 12 changes are waiting in Changes to send.');
    assert.equal(W.heldBody(1), 'Nobody has been told. The 1 change is waiting in Changes to send.');
    assert.equal(W.banner(TODAY, 12, 'postponed'), 'Rainout on Thu, Jun 17: 12 games postponed, waiting to be sent.');
    assert.equal(W.back(12), 'Put all 12 back');
    assert.equal(W.backTitle(12), 'Put all 12 games back?');
    assert.equal(W.backDone(12), '12 games put back. Nothing was sent.');
  });
  it('the line: one line, trimmed, at most what was typed', () => {
    assert.equal(rainLine('  Rain:\n the fields   are closed. '), 'Rain: the fields are closed.');
    assert.equal(rainLine('   '), null);
    assert.equal(rainLine(undefined), null);
    assert.equal(W.lineCount(96), '96 left');
    assert.equal(W.lineCount(-3), '0 left');
  });
});
