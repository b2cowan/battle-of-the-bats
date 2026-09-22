import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupWeekDays, pickTodayRow, sheetOrder, weekEmptyLine } from '../../lib/coach-schedule-phone.ts';

/**
 * The Schedule on a phone (phone re-evaluation stage 2, owner rulings 2026-09-21) — the pure
 * decisions behind C1 (the list opens on today), C2 (a week without blanks) and C3 (the sheet by
 * the clock), each pinned on the case that would otherwise be argued again.
 */
describe('C1 — which row the list opens on (the DAY decides, never the instant)', () => {
  const season = ['2026-04-04', '2026-05-19', '2026-09-18', '2026-09-20', '2026-09-25', '2026-10-27'];

  it('a game that started earlier today is still today\'s row', () => {
    // The row's day key is the club-local day; the clock has moved past its start and it is
    // still the first row on or after today.
    assert.equal(pickTodayRow(season, '2026-09-20'), 3);
  });
  it('a day with nothing on it opens on the next event', () => {
    assert.equal(pickTodayRow(season, '2026-09-21'), 4);
  });
  it('a season with every event behind it opens on its last row', () => {
    assert.equal(pickTodayRow(season, '2026-12-01'), 5);
  });
  it('a season that has not started opens on its first row', () => {
    assert.equal(pickTodayRow(season, '2026-01-01'), 0);
  });
  it('an empty list has no row', () => {
    assert.equal(pickTodayRow([], '2026-09-20'), -1);
  });
});

describe('C2 — a week without blanks', () => {
  const week = (flags: boolean[]) => {
    const labels = ['Mon 14', 'Tue 15', 'Wed 16', 'Thu 17', 'Fri 18', 'Sat 19', 'Sun 20'];
    return flags.map((hasEvents, i) => ({ key: `2026-09-${14 + i}`, label: labels[i], hasEvents }));
  };

  it('a run of empty days is one line, labelled first – last with an en dash', () => {
    const groups = groupWeekDays(week([false, false, false, false, true, false, true]));
    assert.deepEqual(groups, [
      { kind: 'empty', from: '2026-09-14', to: '2026-09-17', label: 'Mon 14 – Thu 17' },
      { kind: 'day', key: '2026-09-18' },
      { kind: 'empty', from: '2026-09-19', to: '2026-09-19', label: 'Sat 19' },
      { kind: 'day', key: '2026-09-20' },
    ]);
    assert.ok(groups[0].kind === 'empty' && groups[0].label.includes('\u2013'), 'the dash is an en dash');
  });
  it('a single empty day names just the day', () => {
    const groups = groupWeekDays(week([true, false, true, true, true, true, true]));
    assert.deepEqual(groups[1], { kind: 'empty', from: '2026-09-15', to: '2026-09-15', label: 'Tue 15' });
  });
  it('a week with nothing is one line for the whole week', () => {
    const groups = groupWeekDays(week([false, false, false, false, false, false, false]));
    assert.deepEqual(groups, [{ kind: 'empty', from: '2026-09-14', to: '2026-09-20', label: 'Mon 14 – Sun 20' }]);
  });
  it('a full week has no quiet line', () => {
    const groups = groupWeekDays(week([true, true, true, true, true, true, true]));
    assert.equal(groups.length, 7);
    assert.ok(groups.every(g => g.kind === 'day'));
  });
  it('the quiet line is one sentence, spelled once', () => {
    assert.equal(weekEmptyLine('Mon 14 – Thu 17'), 'Mon 14 – Thu 17 · nothing scheduled');
  });
});

describe('C3 — the sheet by the clock', () => {
  it('an upcoming game leads with the tabs', () => {
    assert.equal(sheetOrder({ started: false, hasScore: false }), 'tabs-first');
  });
  it('a started, unscored game leads with the score door — the one moment the score is the job', () => {
    assert.equal(sheetOrder({ started: true, hasScore: false }), 'score-first');
  });
  it('a finished game leads with its scoreline', () => {
    assert.equal(sheetOrder({ started: true, hasScore: true }), 'score-first');
  });
  it('a score typed before the start still leads — the sheet has nowhere else to put a scoreline', () => {
    assert.equal(sheetOrder({ started: false, hasScore: true }), 'score-first');
  });
});
