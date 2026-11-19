import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findOrderProblems,
  minutesAt,
  newOrderProblems,
  orderEdges,
  orderPairKey,
  orderProblemsById,
  type OrderGame,
} from '../../lib/game-order.ts';
import {
  orderDragReason,
  orderDragReasonForChange,
  orderGameName,
  orderIssuePairs,
  orderIssueWords,
  orderLineForChange,
  orderLineOfReply,
  orderPillWords,
  orderReadWords,
  orderRefusalWords,
  type OrderWordsGame,
} from '../../lib/game-order-words.ts';

const D = '2026-11-21';
const D2 = '2026-11-22';

/** A playoff game in division `u13`, bracket `b1`, 90 min unless told otherwise. */
const g = (id: string, o: Partial<OrderWordsGame> = {}): OrderWordsGame => ({
  id,
  divisionId: 'u13',
  divisionName: 'U13 Boys',
  bracketId: 'b1',
  bracketCode: id.toUpperCase(),
  isPlayoff: true,
  status: 'scheduled',
  date: D,
  time: '09:00',
  durationMinutes: 90,
  homePlaceholder: null,
  awayPlaceholder: null,
  ...o,
});
const pool = (id: string, o: Partial<OrderWordsGame> = {}) =>
  g(id, { isPlayoff: false, bracketId: null, bracketCode: null, matchup: 'Storm vs Aces', ...o });

const pairs = (games: OrderGame[], lengths = {}) => findOrderProblems(games, lengths).map(orderPairKey).sort();
const sf = (t1: string, t2: string) => [g('sf1', { time: t1 }), g('sf2', { time: t2 })];
const fin = (time: string, o: Partial<OrderWordsGame> = {}) =>
  g('fin', { time, awayPlaceholder: 'Winner SF1', homePlaceholder: 'Winner SF2', ...o });
const byId = (games: OrderWordsGame[]) => new Map(games.map(x => [x.id, x]));

describe('game order: the edges', () => {
  it('single elimination: the Final waits for both semifinals', () => {
    assert.deepEqual(orderEdges([...sf('09:00', '09:00'), fin('13:00')]).map(e => `${e.sourceId}>${e.dependentId}:${e.kind}`),
      ['sf1>fin:winner', 'sf2>fin:winner']);
  });

  it('a 3rd Place game waits on the losers', () => {
    const p3 = g('p3', { time: '10:00', awayPlaceholder: 'Loser SF1', homePlaceholder: 'Loser SF2' });
    assert.deepEqual(pairs([...sf('09:00', '09:00'), p3]), ['sf1>p3', 'sf2>p3']);
  });

  it('consolation and placement cascades', () => {
    const games = [
      g('qf1', { time: '09:00' }), g('qf2', { time: '09:00' }),
      g('con1-1', { time: '10:00', awayPlaceholder: 'Loser QF1', homePlaceholder: 'Loser QF2' }),
      g('pl5', { time: '11:00', awayPlaceholder: 'Winner CON1-1', homePlaceholder: 'Seed #8' }),
    ];
    assert.deepEqual(pairs(games), ['con1-1>pl5', 'qf1>con1-1', 'qf2>con1-1']);
  });

  it('double elimination: a cancelled GF2 is neither source nor dependent', () => {
    const gf = g('gf', { time: '09:00', awayPlaceholder: 'Winner WB2-1', homePlaceholder: 'Winner LB3-1' });
    const gf2 = g('gf2', { time: '09:30', awayPlaceholder: 'Winner GF', homePlaceholder: 'Loser GF', status: 'cancelled' });
    assert.deepEqual(pairs([gf, gf2]), []);
    assert.deepEqual(pairs([gf, { ...gf2, status: 'scheduled' }]), ['gf>gf2']);
  });

  it('Gold and Silver both reuse SF1: each Final waits for its own bracket only', () => {
    const games = [
      g('gsf1', { bracketId: 'gold', bracketCode: 'SF1', time: '09:00' }),
      g('ssf1', { bracketId: 'silver', bracketCode: 'SF1', time: '12:00' }),
      g('gfin', { bracketId: 'gold', bracketCode: 'FIN', time: '11:00', awayPlaceholder: 'Winner SF1' }),
    ];
    assert.deepEqual(pairs(games), []);
  });

  it('one bracket per pool reusing codes: no cross-talk', () => {
    const games = [
      g('asf', { bracketId: 'poolA', bracketCode: 'SF1', time: '14:00' }),
      g('bfin', { bracketId: 'poolB', bracketCode: 'FIN', time: '10:00', awayPlaceholder: 'Winner SF1' }),
    ];
    assert.deepEqual(pairs(games), []);
  });

  it('two divisions both with SF1: no cross-talk', () => {
    const games = [
      g('u11sf1', { divisionId: 'u11', bracketCode: 'SF1', time: '14:00' }),
      g('u13fin', { bracketCode: 'FIN', time: '10:00', awayPlaceholder: 'Winner SF1' }),
    ];
    assert.deepEqual(pairs(games), []);
  });

  it('a hand-added game with no bracket id in a tiered division waits for both SF1s (A9)', () => {
    const games = [
      g('gsf1', { bracketId: 'gold', bracketCode: 'SF1', time: '09:00' }),
      g('ssf1', { bracketId: 'silver', bracketCode: 'SF1', time: '09:00' }),
      g('extra', { bracketId: null, bracketCode: 'X1', time: '10:00', awayPlaceholder: 'Winner SF1' }),
    ];
    assert.deepEqual(pairs(games), ['gsf1>extra', 'ssf1>extra']);
  });

  it('a placeholder in lower case with stray spaces is still an edge', () => {
    assert.deepEqual(pairs([g('sf1', { time: '09:00' }), g('fin', { time: '09:30', awayPlaceholder: '  winner sf1 ' })]), ['sf1>fin']);
  });

  it('a code that resolves to nothing is no edge', () => {
    assert.deepEqual(orderEdges([g('fin', { awayPlaceholder: 'Winner SF9' })]), []);
  });
});

describe('game order: pool play (A7)', () => {
  it('a Quarterfinal before the division\'s last pool game ends', () => {
    const games = [pool('p1', { time: '09:00' }), pool('p2', { time: '13:00' }), g('qf1', { time: '14:00' })];
    assert.deepEqual(pairs(games), ['p2>qf1']);
  });

  it('a cancelled pool game holds nothing', () => {
    const games = [pool('p1', { time: '09:00' }), pool('p2', { time: '13:00', status: 'cancelled' }), g('qf1', { time: '14:00' })];
    assert.deepEqual(pairs(games), []);
  });

  it('a playoffs-only division has no pool edge', () => {
    assert.deepEqual(orderEdges([g('qf1'), g('qf2')]), []);
  });

  it('another division\'s pool play is not this one\'s', () => {
    assert.deepEqual(pairs([pool('p1', { divisionId: 'u11', time: '13:00' }), g('qf1', { time: '13:30' })]), []);
  });
});

describe('game order: the judgement (A1)', () => {
  it('equal starts are refused', () => {
    assert.deepEqual(pairs([...sf('09:00', '09:00'), fin('09:00')]), ['sf1>fin', 'sf2>fin']);
  });

  it('a start exactly at the source\'s end is allowed; one minute before is not', () => {
    assert.deepEqual(pairs([...sf('09:00', '09:00'), fin('10:30')]), []);
    assert.deepEqual(pairs([...sf('09:00', '09:00'), fin('10:29')]), ['sf1>fin', 'sf2>fin']);
  });

  it('the old check allowed a Final ten minutes after its Semifinal started; this one does not', () => {
    assert.deepEqual(pairs([g('sf1', { time: '09:00' }), fin('09:10', { homePlaceholder: null })]), ['sf1>fin']);
  });

  it('a source on a later day', () => {
    assert.deepEqual(pairs([g('sf1', { date: D2, time: '09:00' }), fin('18:00', { homePlaceholder: null })]), ['sf1>fin']);
    assert.deepEqual(pairs([g('sf1', { date: D, time: '18:00' }), fin('08:00', { date: D2, homePlaceholder: null })]), []);
  });

  it('a source ending past midnight runs into the next day', () => {
    assert.deepEqual(pairs([g('sf1', { time: '23:30' }), fin('00:30', { date: D2, homePlaceholder: null })]), ['sf1>fin']);
  });

  it('the length chain: the game\'s own, else the division\'s, else the event\'s', () => {
    const games = (len: number | null) => [g('sf1', { time: '09:00', durationMinutes: len }), fin('10:00', { homePlaceholder: null })];
    assert.deepEqual(pairs(games(50)), []);
    assert.deepEqual(pairs(games(null), { divisionMinutes: { u13: 75 } }), ['sf1>fin']);
    assert.deepEqual(pairs(games(null), { divisionMinutes: new Map([['u13', 45]]), eventMinutes: 120 }), []);
    assert.deepEqual(pairs(games(null), { eventMinutes: 120 }), ['sf1>fin']);
    assert.deepEqual(pairs(games(null)), ['sf1>fin']); // the one booking length, 90
  });

  it('no date or time on either side is skipped', () => {
    assert.deepEqual(pairs([g('sf1', { date: null }), fin('09:00', { homePlaceholder: null })]), []);
    assert.deepEqual(pairs([g('sf1'), fin('', { homePlaceholder: null, time: null })]), []);
  });

  it('calendar minutes: a clocks-change day keeps 24 h', () => {
    assert.equal(minutesAt('2026-11-02', '00:00')! - minutesAt('2026-11-01', '00:00')!, 1440);
  });

  it('both games of a pair are marked (A5)', () => {
    const m = orderProblemsById(findOrderProblems([g('sf1', { time: '09:00' }), fin('09:30', { homePlaceholder: null })]));
    assert.deepEqual([...m.keys()].sort(), ['fin', 'sf1']);
  });
});

describe('game order: before and after (A2)', () => {
  const before = [...sf('09:00', '09:00'), fin('09:30')];
  it('an old pair passes when the save leaves it as it was', () => {
    assert.deepEqual(newOrderProblems(before, before), []);
  });
  it('a moved game making a new pair is refused', () => {
    const ok = [...sf('09:00', '09:00'), fin('11:00')];
    const moved = [g('sf1', { time: '10:00' }), g('sf2', { time: '09:00' }), fin('11:00')];
    assert.deepEqual(newOrderProblems(ok, moved).map(orderPairKey), ['sf1>fin']);
  });
  it('a fix passes', () => {
    assert.deepEqual(newOrderProblems(before, [...sf('09:00', '09:00'), fin('11:00')]), []);
  });
  it('a changed default length is judged with the new length (A8)', () => {
    const games = [g('sf1', { time: '09:00', durationMinutes: null }), fin('11:00', { homePlaceholder: null })];
    assert.deepEqual(newOrderProblems(games, games, { divisionMinutes: { u13: 90 } }, { divisionMinutes: { u13: 120 } }), []);
    assert.deepEqual(newOrderProblems(games, games, { divisionMinutes: { u13: 150 } }, { divisionMinutes: { u13: 90 } }).map(orderPairKey), ['sf1>fin']);
  });
  it('reinstating a cancelled game re-judges it', () => {
    const was = [g('sf1', { time: '09:00', status: 'cancelled' }), fin('09:30', { homePlaceholder: null })];
    const now = [{ ...was[0], status: 'scheduled' }, was[1]];
    assert.deepEqual(newOrderProblems(was, now).map(orderPairKey), ['sf1>fin']);
  });
});

describe('game order: the words (tab 6)', () => {
  const words = (games: OrderWordsGame[], before: OrderWordsGame[], opts: Partial<Parameters<typeof orderRefusalWords>[0]> = {}) => {
    const w = orderRefusalWords({ problems: newOrderProblems(before, games), games: byId(games), door: 'game', ...opts });
    return w.lead + w.rest;
  };
  const ok = [...sf('09:00', '13:00'), fin('16:00')];

  it('names games by round', () => {
    assert.equal(orderGameName(g('fin')), 'the Final');
    assert.equal(orderGameName(g('sf2')), 'Semifinal 2');
    assert.equal(orderGameName(g('p3')), 'the 3rd Place game');
    assert.equal(orderGameName(g('fin'), { division: true }), 'the U13 Boys Final');
  });

  it('the game window, editing the waiting game\'s time', () => {
    const moved = [...sf('09:00', '13:00'), fin('14:00')];
    assert.equal(words(moved, ok, { editedId: 'fin' }),
      'Semifinal 2 ends at 2:30 p.m. The Final waits for its winner: start it at 2:30 p.m. or later, or move Semifinal 2 earlier.');
  });

  it('two games feed it', () => {
    const moved = [...sf('11:30', '11:30'), fin('12:00')];
    assert.equal(words(moved, [...sf('11:30', '11:30'), fin('14:00')], { editedId: 'fin' }),
      'The semifinals end at 1:00 p.m. The Final waits for both winners: start it at 1:00 p.m. or later.');
  });

  it('a game that waits on a loser', () => {
    const p3 = (t: string) => g('p3', { time: t, awayPlaceholder: 'Loser SF1' });
    assert.equal(words([g('sf1', { time: '11:30' }), p3('12:00')], [g('sf1', { time: '11:30' }), p3('14:00')], { editedId: 'p3' }),
      'Semifinal 1 ends at 1:00 p.m. The 3rd Place game waits for its loser: start it at 1:00 p.m. or later, or move Semifinal 1 earlier.');
  });

  it('the earlier game is on a later day', () => {
    const moved = [g('sf1', { time: '09:00' }), g('sf2', { date: D2, time: '15:00' }), fin('16:00')];
    assert.equal(words(moved, ok, { editedId: 'sf2', field: 'when' }).startsWith('The Final starts on Sat, Nov 21 at 4:00 p.m.'), true);
    assert.equal(words([...moved.slice(0, 2), fin('16:00')], [moved[0], moved[1], fin('16:00', { date: D2, time: '17:00' })], { editedId: 'fin' }),
      'Semifinal 2 is on Sun, Nov 22 at 3:00 p.m. The Final waits for its winner: move it to that day, 4:30 p.m. or later.');
  });

  it('moving the earlier game later', () => {
    const moved = [g('sf1', { time: '14:00' }), g('sf2', { time: '13:00' }), fin('15:00')];
    assert.equal(words(moved, [g('sf1', { time: '09:00' }), g('sf2', { time: '13:00' }), fin('15:00')], { editedId: 'sf1' }),
      'The Final starts at 3:00 p.m. It waits for Semifinal 1’s winner: start Semifinal 1 by 1:30 p.m., or move the Final later.');
  });

  it('the earlier game\'s length', () => {
    const at = (len: number) => [g('sf1', { time: '09:00' }), g('sf2', { time: '13:30', durationMinutes: len }), fin('15:00')];
    assert.equal(words(at(120), at(90), { editedId: 'sf2', field: 'length' }),
      'The Final starts at 3:00 p.m. At 120 min, Semifinal 2 would end at 3:30 p.m. Keep it to 90 min, or move the Final later.');
  });

  it('changing who plays (Away / Home)', () => {
    const before = [g('sf2', { time: '13:00' }), g('x', { bracketCode: 'X', time: '14:15', awayPlaceholder: 'Seed #1' })];
    const after = [before[0], { ...before[1], awayPlaceholder: 'Winner SF2' }];
    assert.equal(words(after, before, { editedId: 'x', field: 'sources' }),
      'Semifinal 2 ends at 2:30 p.m. This game starts at 2:15 p.m., before Semifinal 2’s winner is known. Pick another game, or change the time.');
  });

  it('pool play: a playoff game too early', () => {
    const before = [pool('p9', { time: '15:45' }), g('qf1', { time: '18:00' })];
    const after = [before[0], { ...before[1], time: '16:00' }];
    assert.equal(words(after, before, { editedId: 'qf1' }),
      'U13 Boys pool play ends at 5:15 p.m. (Storm vs Aces). Quarterfinal 1 waits for the standings: start it at 5:15 p.m. or later.');
  });

  it('pool play: a pool game too late', () => {
    const before = [pool('p9', { date: D, time: '15:00' }), g('qf1', { date: D2, time: '09:00' })];
    const after = [{ ...before[0], date: D2, time: '08:00' }, before[1]];
    assert.equal(words(after, before, { editedId: 'p9' }),
      'Quarterfinal 1 starts at 9:00 a.m. It waits for U13 Boys pool play, so this game has to end by then.');
  });

  it('the rain delay', () => {
    const w = orderRefusalWords({
      problems: newOrderProblems([g('sf2', { time: '13:00' }), fin('16:30', { awayPlaceholder: null })], [g('sf2', { time: '15:30' }), fin('16:30', { awayPlaceholder: null })]),
      games: byId([g('sf2', { time: '15:30' }), fin('16:30', { awayPlaceholder: null })]), door: 'rain-delay',
    });
    assert.equal(w.lead + w.rest, 'Semifinal 2 would end at 5:00 p.m., after the Final starts (4:30 p.m.). Push the Final as well, or push the games by less.');
  });

  it('putting a cancelled game back', () => {
    const before = [g('sf2', { time: '15:00', status: 'cancelled' }), fin('14:15', { awayPlaceholder: null })];
    const after = [{ ...before[0], status: 'scheduled' }, before[1]];
    assert.equal(words(after, before, { door: 'reinstate', editedId: 'sf2' }),
      'Semifinal 2 is at 3:00 p.m. and would end after the Final starts (2:15 p.m.). Move the Final later first, then put Semifinal 2 back.');
  });

  it('the playoff generator, a draft gone stale', () => {
    const before = [g('sf2', { time: '13:00' }), fin('16:00', { awayPlaceholder: null })];
    const after = [{ ...before[0], time: '15:00' }, before[1]];
    assert.equal(words(after, before, { door: 'playoff-draft' }),
      'The schedule changed while you were choosing: this draft starts the Final before Semifinal 2 ends. Make the drafts again.');
  });

  it('the round-robin generator or the import', () => {
    const before = [pool('p1', { time: '14:00' }), g('qf1', { time: '17:00' })];
    const after = [{ ...before[0], time: '16:30' }, before[1]];
    assert.equal(words(after, before, { door: 'pool-draft' }),
      'This draft ends U13 Boys pool play at 6:00 p.m., after Quarterfinal 1 starts (5:00 p.m.). Move the playoffs later first, or end pool play earlier.');
    assert.match(words(after, before, { door: 'import' }), /^This import ends U13 Boys pool play/);
  });

  it('a division\'s default length (A8)', () => {
    const games = [g('sf1', { time: '13:30', durationMinutes: null }), g('sf2', { time: '13:30', durationMinutes: null }), fin('15:00', { durationMinutes: null })];
    const w = orderRefusalWords({
      problems: newOrderProblems(games, games, { divisionMinutes: { u13: 120 } }, { divisionMinutes: { u13: 90 } }),
      games: byId(games), door: 'length-default', length: { minutes: 120, was: 90 }, lengths: { divisionMinutes: { u13: 120 } },
    });
    assert.equal(w.lead + w.rest, 'The U13 Boys Final starts at 3:00 p.m. At 120 min, the semifinals would end at 3:30 p.m. Move the Final first, or keep 90 min.');
  });

  it('a pair with no one edited game (the bracket editor, the rain delay\'s Undo)', () => {
    const before = [g('sf2', { time: '13:00' }), fin('16:00', { awayPlaceholder: null })];
    const after = [before[0], { ...before[1], time: '14:15' }];
    assert.equal(words(after, before, { door: 'pair' }),
      'The Final starts at 2:15 p.m., before Semifinal 2 ends at 2:30 p.m. Move the Final to 2:30 p.m. or later, or move Semifinal 2 earlier.');
  });

  it('two games that would read the same carry their bracket code (walk §544 C1)', () => {
    // Double elimination: round 1 and round 2 of the winners bracket both read "Winners Bracket, Game 1".
    const before = [g('wb2-1', { time: '09:00' }), g('wb3-1', { time: '11:00', awayPlaceholder: 'Winner WB2-1' })];
    const after = [before[0], { ...before[1], time: '09:30' }];
    assert.equal(words(after, before, { door: 'pair' }),
      'Winners Bracket, Game 1 (WB2-1) starts at 9:30 a.m., before Winners Bracket, Game 1 (WB1-1) ends at 10:30 a.m. Move Winners Bracket, Game 1 (WB2-1) to 10:30 a.m. or later, or move Winners Bracket, Game 1 (WB1-1) earlier.');
    const [p] = findOrderProblems(after);
    assert.equal(orderPillWords(p, byId(after), 'wb3-1'), 'Not saved: Winners Bracket, Game 1 (WB1-1) isn’t over by then');
    // Different names stay as they were; a game named beside itself or a non-playoff game is untouched.
    assert.equal(orderGameName(g('sf1'), { other: g('sf2') }), 'Semifinal 1');
    assert.equal(orderGameName(g('wb2-1'), { other: g('wb2-1') }), 'Winners Bracket, Game 1');
    assert.equal(orderGameName(g('wb2-1'), { other: pool('p1') }), 'Winners Bracket, Game 1');
  });

  it('a way out on another day says the day (walk §544 C2)', () => {
    const before = [g('sf2', { date: D2, time: '09:00' }), fin('11:00', { awayPlaceholder: null, date: D2 })];
    const after = [before[0], { ...before[1], date: D, time: '16:00' }];
    assert.equal(words(after, before, { door: 'pair' }),
      'The Final starts on Sat, Nov 21 at 4:00 p.m., before Semifinal 2 ends on Sun, Nov 22 at 10:30 a.m. Move the Final to Sun, Nov 22 at 10:30 a.m. or later, or move Semifinal 2 earlier.');
    const [p] = findOrderProblems(after);
    const dep = orderReadWords(p, byId(after), 'fin');
    assert.equal(dep.lead + dep.rest, 'Out of order. Semifinal 2 ends on Sun, Nov 22 at 10:30 a.m., after this game starts. Move this game to Sun, Nov 22 at 10:30 a.m. or later, or move Semifinal 2 earlier.');
    const src = orderReadWords(p, byId(after), 'sf2');
    assert.equal(src.lead + src.rest, 'Out of order. The Final starts on Sat, Nov 21 at 4:00 p.m., before this game ends. Move this game earlier, or move the Final to Sun, Nov 22 at 10:30 a.m. or later.');
  });

  it('the screens\' sentences: the issue, the read view from both sides, the drag, the pill', () => {
    const games = [g('sf2', { time: '15:00' }), fin('14:15', { awayPlaceholder: null })];
    const [p] = findOrderProblems(games);
    const m = byId(games);
    assert.equal(orderIssueWords(p, m), 'The Final starts at 2:15 p.m., before Semifinal 2 ends at 4:30 p.m.');
    const dep = orderReadWords(p, m, 'fin');
    assert.equal(dep.lead + dep.rest, 'Out of order. Semifinal 2 ends at 4:30 p.m., after this game starts. Move this game to 4:30 p.m. or later, or move Semifinal 2 earlier.');
    const src = orderReadWords(p, m, 'sf2');
    assert.equal(src.lead + src.rest, 'Out of order. The Final starts at 2:15 p.m., before this game ends. Move this game earlier, or move the Final to 4:30 p.m. or later.');
    assert.equal(orderDragReason([p], m, 'fin'), 'Semifinal 2 runs until 4:30 p.m., so the Final can’t go here');
    assert.equal(orderPillWords(p, m, 'fin'), 'Not saved: Semifinal 2 isn’t over by then');
  });

  it('the drag names both semifinals when the Final waits for both (tab 2)', () => {
    const games = [...sf('11:30', '11:30'), fin('15:00')];
    const after = [...games.slice(0, 2), { ...games[2], time: '12:30' }];
    const problems = newOrderProblems(games, after);
    assert.equal(orderDragReason(problems, byId(after), 'fin'), 'The semifinals run until 1:00 p.m., so the Final can’t go here');
    // The earlier game dragged past the Final (tab 2's second band).
    const late = [{ ...games[0], time: '14:00' }, games[1], games[2]];
    assert.equal(orderDragReason(newOrderProblems(games, late), byId(late), 'sf1'), 'The Final starts at 3:00 p.m., so Semifinal 1 can’t go here');
  });

  it('the issue names a day only when the two games are on different days', () => {
    const games = [g('qf2', { date: D2, time: '09:00' }), g('sf1', { date: D, time: '09:00', awayPlaceholder: 'Winner QF2' })];
    const [p] = findOrderProblems(games);
    assert.equal(orderIssueWords(p, byId(games)),
      'Semifinal 1 starts on Sat, Nov 21 at 9:00 a.m., before Quarterfinal 2 ends on Sun, Nov 22 at 10:30 a.m.');
  });

  it('pool play counts once per playoff game in the health issue', () => {
    const games = [pool('p1', { time: '14:00' }), pool('p2', { time: '15:00' }), g('qf1', { time: '15:15' })];
    const all = findOrderProblems(games);
    assert.equal(all.length, 2);
    const issue = orderIssuePairs(all);
    assert.equal(issue.length, 1);
    assert.equal(issue[0].sourceId, 'p2'); // the latest-ending pool game speaks for it
  });

  it('the game window\'s line for a one-game change, and a reply read back into a line', () => {
    const games = [
      { id: 'sf2', divisionId: 'u13', bracketId: 'b1', bracketCode: 'SF2', isPlayoff: true, status: 'scheduled', date: D, time: '15:00', durationMinutes: 90 },
      { id: 'fin', divisionId: 'u13', bracketId: 'b1', bracketCode: 'FIN', isPlayoff: true, status: 'scheduled', date: D, time: '17:00', durationMinutes: 90, homePlaceholder: 'Winner SF2' },
    ];
    const input = { games, divisions: [{ id: 'u13', name: 'U13 Boys' }], teams: [], change: { id: 'fin', time: '14:15' } };
    const line = orderLineForChange(input);
    assert.ok(line);
    assert.equal(line.lead, 'Semifinal 2 ends at 4:30 p.m.');
    assert.equal(line.pill, 'Not saved: Semifinal 2 isn’t over by then');
    assert.equal(orderLineForChange({ ...input, change: { id: 'fin', time: '16:30' } }), null); // exactly at the end
    assert.equal(orderDragReasonForChange(input), 'Semifinal 2 runs until 4:30 p.m., so the Final can’t go here');
    const reply = { error: line.lead + line.rest, lead: line.lead, code: 'game-order' };
    assert.deepEqual(orderLineOfReply(reply), { lead: line.lead, rest: line.rest });
    assert.equal(orderLineOfReply({ error: 'Diamond 2 is taken', code: 'overlap' }), null);
  });

  it('no em dashes (A10)', () => {
    const games = [g('sf2', { time: '15:00' }), fin('14:15', { awayPlaceholder: null })];
    for (const door of ['game', 'pair', 'rain-delay', 'reinstate', 'playoff-draft', 'pool-draft', 'import', 'length-default'] as const) {
      const w = orderRefusalWords({ problems: findOrderProblems(games), games: byId(games), door, editedId: 'fin' });
      assert.equal(/[—–]/.test(w.lead + w.rest), false, door);
    }
  });
});
