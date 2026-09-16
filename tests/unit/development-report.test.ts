import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  progressSeries, statedChange, compareWindow, coverageCell, coverageDenominator, COVERAGE_DASH, COVERAGE_ORDER_NOTE,
  progressAxis, xFractions, showOptions, logLine, handoutResultNote, handoutNextReview, describeSeries, scopeLine, developmentReports,
  type ReportDefinition, type ProgressPoint,
} from '../../lib/development-report.ts';
import { averageOf, describeHeadline, headlineMethod, type SessionResult } from '../../lib/measurable-series.ts';
import { formatValue } from '../../lib/measurable-format.ts';
import { formatShortDate } from '../../lib/measurable-format.ts';

/** Dates in expectations go through the ONE formatter the module uses — the assertions are about the words, not the locale. */
const d = formatShortDate;
const AUG4 = d('2026-08-04'), AUG25 = d('2026-08-25'), SEP8 = d('2026-09-08'), AUG1 = d('2026-08-01');

/**
 * Development lifecycle Phase 3 — explain progress (plan §8: the ten chart rules are binding; §16:
 * the range aim drawn properly). Every sentence a report says is derived here, once, so the chart,
 * the answer line, the table and the handout cannot disagree (chart rule 8).
 */

const sprint: ReportDefinition = {
  name: '60-yd sprint', kind: 'test', unit: 'seconds', aim: 'lower', headline: 'best',
  rangeFrom: null, rangeTo: null, method: 'Standing start on the same marked course.',
};
const throwSpeed: ReportDefinition = {
  name: 'Throw speed', kind: 'test', unit: 'mph', aim: 'higher', headline: 'best',
  rangeFrom: null, rangeTo: null, method: null,
};
const legacy: ReportDefinition = {
  name: 'Legacy', kind: 'test', unit: 'reps', aim: 'record', headline: 'last',
  rangeFrom: null, rangeTo: null, method: null,
};
const changeup: ReportDefinition = {
  name: 'Changeup speed', kind: 'test', unit: 'mph', aim: 'range', headline: 'in_range',
  rangeFrom: 62, rangeTo: 68, method: 'Radar gun behind the plate.',
};
const skill: ReportDefinition = {
  name: 'Sets feet before throwing', kind: 'skill', unit: null, aim: 'record', headline: 'last',
  rangeFrom: null, rangeTo: null, method: null,
};

let seq = 0;
const reading = (value: number, recordedOn: string, sessionId: string | null, attemptNo = 1, unit = 'seconds') => ({
  id: `r${++seq}`, value, unit, recordedOn, createdAt: `${recordedOn}T12:00:${String(seq).padStart(2, '0')}Z`, sessionId, attemptNo,
});

/** Avery's sprint, the mockup's own numbers: four sessions, oldest 4 Aug, newest 8 Sep. */
const averySprint = [
  reading(8.40, '2026-08-04', 's1', 1), reading(8.52, '2026-08-04', 's1', 2), reading(8.47, '2026-08-04', 's1', 3),
  reading(8.31, '2026-08-18', 's2', 1), reading(8.25, '2026-08-18', 's2', 2),
  reading(8.10, '2026-08-25', 's3', 1), reading(8.18, '2026-08-25', 's3', 2), reading(8.14, '2026-08-25', 's3', 3),
  reading(8.12, '2026-09-08', 's4', 1), reading(8.05, '2026-09-08', 's4', 2), reading(8.20, '2026-09-08', 's4', 3),
];

describe('progressSeries — one object behind the chart, the answer line and the table', () => {
  it('draws the headline per session, oldest → newest, with every attempt as a mark', () => {
    const s = progressSeries(averySprint, sprint, { show: 'headline', compare: 'season' });
    assert.equal(s.points.length, 4);
    assert.deepEqual(s.points.map(p => p.row.recordedOn), ['2026-08-04', '2026-08-18', '2026-08-25', '2026-09-08']);
    assert.deepEqual(s.points.map(p => p.value), [8.40, 8.25, 8.10, 8.05]);
    assert.deepEqual(s.points[0].marks.map(m => m.value), [8.40, 8.52, 8.47]);
    assert.equal(s.points[0].marks[0].inRange, null, 'a directional test has no band');
    assert.equal(s.unit, 'seconds');
  });

  it('switched to the average, the line follows the average and the marks do not move', () => {
    const s = progressSeries(averySprint, sprint, { show: 'average', compare: 'season' });
    assert.deepEqual(s.points.map(p => p.value), [8.463, 8.28, 8.14, 8.123]);
    assert.deepEqual(s.points[3].marks.map(m => m.value), [8.12, 8.05, 8.20]);
    assert.equal(s.lineWord, 'average of attempts');
  });

  it('the answer line reads the latest headline on its date, and the change since the first', () => {
    const s = progressSeries(averySprint, sprint, { show: 'headline', compare: 'season' });
    assert.equal(s.answer?.value, '8.05 seconds');
    assert.equal(s.answer?.on, '2026-09-08');
    assert.equal(s.change, `0.35 seconds lower since ${AUG4}`);
  });

  it('a range test\'s line is the average, in-band marks are filled, and the label is attempts in range', () => {
    const rows = [
      reading(60, '2026-08-25', 'c1', 1, 'mph'), reading(70, '2026-08-25', 'c1', 2, 'mph'), reading(61, '2026-08-25', 'c1', 3, 'mph'),
      reading(66, '2026-09-08', 'c2', 1, 'mph'), reading(70, '2026-09-08', 'c2', 2, 'mph'), reading(64, '2026-09-08', 'c2', 3, 'mph'),
    ];
    const s = progressSeries(rows, changeup, { show: 'headline', compare: 'season' });
    // The average to one decimal more than its whole-number attempts carry (stage 4, G3) — 63.7, not 63.667.
    assert.deepEqual(s.points.map(p => p.value), [63.7, 66.7]);
    assert.deepEqual(s.points[1].marks.map(m => m.inRange), [true, false, true]);
    assert.deepEqual(s.points.map(p => p.label), ['0 of 3 in range', '2 of 3 in range']);
    assert.deepEqual(s.band, { from: 62, to: 68 });
    assert.equal(s.answer?.value, '2 of 3 in range');
    assert.equal(s.change, `moved into the range since ${AUG25} (0 of 3)`);
    assert.equal(s.lineWord, 'average of attempts');
  });

  it('one reading is one point, no line, no change, no fabricated baseline', () => {
    const s = progressSeries([reading(8.41, '2026-08-01', null)], sprint, { show: 'headline', compare: 'season' });
    assert.equal(s.points.length, 1);
    assert.equal(s.change, null);
    assert.equal(s.answer?.value, '8.41 seconds');
    assert.match(scopeLine(s), /1 recorded result/);
    assert.match(scopeLine(s), /a single result is a point, not a change/);
  });

  it('with nothing recorded the series is empty and says nothing', () => {
    const s = progressSeries([], sprint, { show: 'headline', compare: 'season' });
    assert.equal(s.points.length, 0);
    assert.equal(s.answer, null);
    assert.equal(s.change, null);
  });

  it('the table rows and the points are the SAME rows (chart rule 8)', () => {
    const s = progressSeries(averySprint, sprint, { show: 'headline', compare: 'last-two' });
    assert.equal(s.points.length, 2);
    assert.deepEqual(s.points.map(p => p.row.key), ['session:s3', 'session:s4']);
    assert.deepEqual(s.points.map(p => p.row.values.length), [3, 3]);
  });
});

describe('statedChange — words, never a verdict (chart rule 4)', () => {
  /** A point as progressSeries builds one: the row behind it, and what the line draws. */
  const pt = (value: number, recordedOn: string, extra: { inRange?: number; attempts?: number; average?: number } = {}): ProgressPoint => ({
    value, label: '', marks: [],
    row: {
      key: recordedOn, recordedOn, values: Array(extra.attempts ?? 1).fill(value),
      headline: extra.inRange ?? value, average: extra.average ?? value,
    } as unknown as SessionResult,
  });
  it('lower is arithmetic in the unit, dated from the first point', () => {
    assert.equal(statedChange(pt(8.40, '2026-08-04'), pt(8.05, '2026-09-08'), sprint, 'seconds'), `0.35 seconds lower since ${AUG4}`);
  });
  it('higher is arithmetic too — never "worse", never "better"', () => {
    assert.equal(statedChange(pt(8.05, '2026-08-04'), pt(8.40, '2026-09-08'), sprint, 'seconds'), `0.35 seconds higher since ${AUG4}`);
    assert.equal(statedChange(pt(48, '2026-08-04'), pt(51, '2026-09-08'), throwSpeed, 'mph'), `3 mph higher since ${AUG4}`);
  });
  it('unchanged says so', () => {
    assert.equal(statedChange(pt(8.2, '2026-08-04'), pt(8.2, '2026-09-08'), sprint, 'seconds'), `unchanged since ${AUG4}`);
  });
  it('a record-only test states the arithmetic and claims no direction', () => {
    assert.equal(statedChange(pt(10, '2026-08-04'), pt(12, '2026-09-08'), legacy, 'reps'), `2 reps higher since ${AUG4}`);
  });
  it('a range test says moved into / out of the range, or how far the average sits past the band', () => {
    const r = (value: number, on: string, inRange: number) => pt(value, on, { inRange, attempts: 3, average: value });
    assert.equal(statedChange(r(63.7, '2026-08-25', 0), r(66.7, '2026-09-08', 2), changeup, 'mph'), `moved into the range since ${AUG25} (0 of 3)`);
    assert.equal(statedChange(r(66, '2026-08-25', 3), r(65, '2026-09-08', 2), changeup, 'mph'), `3 of 3 in range on ${AUG25}`);
    assert.equal(statedChange(r(66, '2026-08-25', 2), r(71, '2026-09-08', 0), changeup, 'mph'), `moved out of the range since ${AUG25} (2 of 3) · 3 mph above the range`);
    assert.equal(statedChange(r(59, '2026-08-25', 0), r(60.5, '2026-09-08', 0), changeup, 'mph'), '1.5 mph below the range');
    assert.equal(statedChange(r(65, '2026-08-25', 0), r(65, '2026-09-08', 0), changeup, 'mph'), 'attempts either side of the range, none in it');
  });
  it('the same point is no change', () => {
    assert.equal(statedChange(pt(8.4, '2026-08-04'), pt(8.4, '2026-08-04'), sprint, 'seconds'), null);
  });
});

describe('compareWindow — this season or the last two records', () => {
  const pts = [1, 2, 3, 4].map(i => ({ key: `k${i}` }));
  it('the season is every point', () => assert.equal(compareWindow(pts, 'season').length, 4));
  it('last two is the newest two', () => assert.deepEqual(compareWindow(pts, 'last-two').map(p => p.key), ['k3', 'k4']));
  it('fewer than two stays as it is', () => assert.equal(compareWindow(pts.slice(0, 1), 'last-two').length, 1));
});

describe('coverageCell — per metric, that metric\'s own date (F12)', () => {
  const none = { latest: null, latestObservation: null, notAssessedOn: null };
  it('a test with a result reads the headline and its date', () => {
    const c = coverageCell({ ...none, latest: { value: 8.31, unit: 'seconds', recordedOn: '2026-06-10', attempts: 2, inRange: null } }, sprint);
    assert.deepEqual(c, { text: '8.31 seconds (of 2)', on: '2026-06-10', state: 'recorded' });
  });
  it('a range test reads attempts in range', () => {
    const c = coverageCell({ ...none, latest: { value: 66.7, unit: 'mph', recordedOn: '2026-06-10', attempts: 3, inRange: 2 } }, changeup);
    assert.deepEqual(c, { text: '2 of 3 in range', on: '2026-06-10', state: 'recorded' });
  });
  it('an observed skill quotes the latest observation\'s descriptor', () => {
    const c = coverageCell({ ...none, latestObservation: { descriptor: 'With a reminder', note: 'One cue.', observedOn: '2026-06-10' } }, skill);
    assert.deepEqual(c, { text: 'With a reminder', on: '2026-06-10', state: 'recorded' });
    const noDescriptor = coverageCell({ ...none, latestObservation: { descriptor: null, note: 'One cue.', observedOn: '2026-06-10' } }, skill);
    assert.equal(noDescriptor.text, 'One cue.');
  });
  it('not assessed is a state, dated by the session that marked it — and a later result wins over it', () => {
    assert.deepEqual(coverageCell({ ...none, notAssessedOn: '2026-06-10' }, sprint), { text: 'Not assessed', on: '2026-06-10', state: 'not_assessed' });
    const both = coverageCell({ latest: { value: 8.31, unit: 'seconds', recordedOn: '2026-06-10', attempts: 1, inRange: null }, latestObservation: null, notAssessedOn: '2026-05-01' }, sprint);
    assert.equal(both.state, 'recorded');
  });
  it('nothing recorded is ONE dash — the legend under the table says what it means, once (stage 4, G1)', () => {
    assert.deepEqual(coverageCell(none, sprint), { text: COVERAGE_DASH, on: null, state: 'none' });
    assert.deepEqual(coverageCell(none, skill), { text: COVERAGE_DASH, on: null, state: 'none' });
    assert.equal(COVERAGE_DASH, '—');
  });
  it('the count line names the count, the metric and the season; the verb follows the count; the order note is its own words', () => {
    assert.equal(coverageDenominator(4, 6, sprint), '4 of 6 players have a 60-yd sprint result this season');
    assert.equal(coverageDenominator(1, 12, sprint), '1 of 12 players has a 60-yd sprint result this season');
    assert.equal(coverageDenominator(1, 1, skill), '1 of 1 player has a Sets feet before throwing observation this season');
    assert.equal(coverageDenominator(1, 12, 'focus'), '1 of 12 players has a goal being worked on');
    assert.equal(coverageDenominator(0, 12, 'focus'), '0 of 12 players have a goal being worked on');
    assert.equal(COVERAGE_ORDER_NOTE, 'roster order, not a ranking');
  });
});

describe('developmentReports — Practice review only with the schedule grant (one rule for the selector and the rail count)', () => {
  it('three with the grant, two without', () => {
    assert.deepEqual(developmentReports(true), ['coverage', 'progress', 'practices']);
    assert.deepEqual(developmentReports(false), ['coverage', 'progress']);
  });
});

describe('the average prints to one decimal more than its attempts, never more than three (stage 4, G3)', () => {
  it('whole-number attempts read to one decimal; hundredths to thousandths; the cap holds', () => {
    assert.equal(averageOf([60, 70, 61]), 63.7);
    assert.equal(formatValue(averageOf([60, 70, 61])!), '63.7');
    assert.equal(averageOf([8.31, 8.24]), 8.275);
    assert.equal(averageOf([8.12, 8.05, 8.2]), 8.123);
    assert.equal(averageOf([1.2345, 1.2355]), 1.235, 'capped at three decimals');
    assert.equal(averageOf([]), null);
  });
  it('every reader of the average says the same figure — the row, the read-back, the series, the description', () => {
    const rows = [reading(60, '2026-08-25', 'c1', 1, 'mph'), reading(70, '2026-08-25', 'c1', 2, 'mph'), reading(61, '2026-08-25', 'c1', 3, 'mph')];
    const s = progressSeries(rows, changeup, { show: 'headline', compare: 'season' });
    assert.equal(s.points[0].row.average, 63.7);
    assert.match(describeSeries(s, 'Devon').description, /average 63\.7\b/);
    assert.equal(describeHeadline([60, 70, 61], sprint), 'Best of 3 attempts · 60 · 70 · 61 · average 63.7');
    assert.equal(headlineMethod(s.points[0].row, sprint), 'best of 3 attempts · avg 63.7');
  });
});

describe('handoutNextReview — a past date never prints as a promise (stage 4, G5)', () => {
  it('prints a date that is today or later, and nothing for a date that has passed or no date', () => {
    assert.equal(handoutNextReview('2026-06-24', '2026-09-15'), null);
    assert.equal(handoutNextReview('2026-09-15', '2026-09-15'), '2026-09-15');
    assert.equal(handoutNextReview('2026-09-29', '2026-09-15'), '2026-09-29');
    assert.equal(handoutNextReview(null, '2026-09-15'), null);
    assert.equal(handoutNextReview(undefined, '2026-09-15'), null);
  });
});

describe('progressAxis — a narrowed scale with labelled ticks, stable for the same data (chart rule 5)', () => {
  it('bounds the marks and the line with nice ticks', () => {
    const a = progressAxis([8.40, 8.52, 8.47, 8.05, 8.12, 8.20], null);
    assert.ok(a.min <= 8.05 && a.max >= 8.52);
    assert.ok(a.ticks.length >= 2 && a.ticks.length <= 6);
    assert.equal(a.ticks[0], a.min);
    assert.equal(a.ticks[a.ticks.length - 1], a.max);
    assert.deepEqual(progressAxis([8.40, 8.52, 8.47, 8.05, 8.12, 8.20], null), a, 'deterministic');
  });
  it('a range test keeps the whole band on the scale', () => {
    const a = progressAxis([70, 70.5], { from: 62, to: 68 });
    assert.ok(a.min <= 62 && a.max >= 70.5);
  });
  it('one value still has a scale around it', () => {
    const a = progressAxis([8.4], null);
    assert.ok(a.min < 8.4 && a.max > 8.4);
  });
});

describe('xFractions — actual calendar time on x (chart rule 2)', () => {
  it('spaces points by elapsed days, not by index', () => {
    const x = xFractions(['2026-08-04', '2026-08-18', '2026-09-08']);
    assert.equal(x[0], 0);
    assert.equal(x[2], 1);
    assert.ok(Math.abs(x[1] - 14 / 35) < 1e-9);
  });
  it('a single point sits in the middle; two on one day share it', () => {
    assert.deepEqual(xFractions(['2026-08-04']), [0.5]);
    assert.deepEqual(xFractions(['2026-08-04', '2026-08-04']), [0.5, 0.5]);
  });
});

describe('showOptions — the two the mockup draws; Last only when the test leads with it', () => {
  it('a best-headline test offers Best attempt and Average of attempts', () => {
    assert.deepEqual(showOptions(sprint).map(o => o.label), ['Best attempt', 'Average of attempts']);
  });
  it('a last-headline (legacy) test offers Last attempt and Average', () => {
    assert.deepEqual(showOptions(legacy).map(o => o.label), ['Last attempt', 'Average of attempts']);
  });
  it('a range test has no choice — the line is the average', () => {
    assert.deepEqual(showOptions(changeup), []);
  });
  it('an average-headline test has one option, so no selector', () => {
    assert.deepEqual(showOptions({ ...sprint, headline: 'average' }).map(o => o.id), ['average']);
  });
});

describe('the handout reads the same rows', () => {
  it('one line per session in the log, with the attempts behind the headline', () => {
    const s = progressSeries(averySprint, sprint, { show: 'headline', compare: 'season' });
    const latest = s.points[3].row;
    assert.equal(logLine(latest, sprint), `${SEP8} · best 8.05 of 3 (8.12 · 8.05 · 8.2)`);
    assert.equal(handoutResultNote(latest, sprint), 'Best of 3 attempts that day (8.12 · 8.05 · 8.2). Standing start on the same marked course.');
  });
  it('a range session says attempts in range; a single reading says only its value', () => {
    const c = progressSeries([reading(66, '2026-09-08', 'c2', 1, 'mph'), reading(70, '2026-09-08', 'c2', 2, 'mph'), reading(64, '2026-09-08', 'c2', 3, 'mph')], changeup, { show: 'headline', compare: 'season' });
    assert.equal(logLine(c.points[0].row, changeup), `${SEP8} · 2 of 3 in range (66 · 70 · 64)`);
    const single = progressSeries([reading(8.41, '2026-08-01', null)], sprint, { show: 'headline', compare: 'season' });
    assert.equal(logLine(single.points[0].row, sprint), `${AUG1} · 8.41 seconds`);
    assert.equal(handoutResultNote(single.points[0].row, sprint), 'Standing start on the same marked course.');
    assert.equal(handoutResultNote(single.points[0].row, throwSpeed), null);
  });
});

describe('describeSeries — the chart\'s accessible sentence', () => {
  it('names the player, the test, what the line follows and every point', () => {
    const s = progressSeries(averySprint, sprint, { show: 'headline', compare: 'last-two' });
    const d = describeSeries(s, 'Avery');
    assert.equal(d.title, 'Avery’s 60-yd sprint, best attempt per result, in seconds');
    assert.ok(d.description.includes(`${AUG25}: 8.1 seconds (3 attempts: 8.1, 8.18, 8.14); ${SEP8}: 8.05 seconds (3 attempts: 8.12, 8.05, 8.2)`), d.description);
    assert.match(d.description, /Dates are spaced by elapsed time/);
  });
  it('the scope line counts results and attempts and states the aim — never the method (owner, 2026-09-14: a method change keeps the series, so "same method throughout" is not knowable)', () => {
    const s = progressSeries(averySprint, sprint, { show: 'headline', compare: 'season' });
    assert.equal(scopeLine(s), '4 recorded results · 11 attempts · lower is the aim');
    const t = progressSeries([reading(48, '2026-06-01', null, 1, 'mph'), reading(51, '2026-06-15', null, 1, 'mph')], throwSpeed, { show: 'headline', compare: 'season' });
    assert.equal(scopeLine(t), '2 recorded results · higher is the aim');
    const c = progressSeries([reading(66, '2026-09-08', 'c2', 1, 'mph'), reading(70, '2026-09-08', 'c2', 2, 'mph')], changeup, { show: 'headline', compare: 'season' });
    assert.equal(scopeLine(c), '1 recorded result · 2 attempts · aim: 62–68 mph · a range has no “best” · a single result is a point, not a change');
  });
});
