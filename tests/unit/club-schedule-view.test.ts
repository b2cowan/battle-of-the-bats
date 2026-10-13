/**
 * THE CLUB SCHEDULER'S SCREENS — what they lay out, held to the drawings' own numbers (Club Tier Stage 11a, part B; hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11, specimens 4–8, 14, 15). The server decides every share and the bill
 * (part A's tests); these hold what the page DRAWS from what it answered:
 *   · the grid's columns — a week Monday first (C2), or a one-weekday schedule's dates seven at a time (Ask 27);
 *   · the summary line ("12 weeks · 2 lanes · 30 slots a week · 354 slots", "25 Sundays · 6 fields · 12 slots a Sunday ·
 *     300 slots") and the closing row's words;
 *   · a drop's verdict (green · amber · red — the schedule's one refusal, a team twice at once);
 *   · the printed schedule (a section per Sunday, the fields across, "Field 5 · half") and the workbook's totals;
 *   · a phone's Day (owner, 2026-10-12): only the dates with slots, and where it opens.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  closingNote, dropVerdict, facilityNoun, gridColumns, isStale, openingDay, perWeek, ruleBroken, slotDays, stepGrid, summaryLine,
  viewBillSlots, weekCounts, weekShortfalls, weekdayDates, weeksOnScreen, type GenerateSummary, type SlotView,
} from '../../lib/club-schedule-view.ts';
import { pricedMinutes } from '../../lib/club-schedule-bill.ts';
import { clubScheduleDocument, scheduleSheets, sheetNameOf, type DocSlot } from '../../lib/club-schedule-document.ts';
import { defaultRules } from '../../lib/club-schedule-settings.ts';

// ── The grid's columns (Ask 27) ───────────────────────────────────────────────────────────────────

describe('the grid reads a week, or a one-weekday schedule’s dates across (Ask 27)', () => {
  it('a week grid is Monday to Sunday, "Jan 4 – 10, 2027"', () => {
    const c = gridColumns({ startsOn: '2027-01-04', endsOn: '2027-03-28', oneWeekday: null, cursor: '2027-01-06' });
    assert.equal(c.mode, 'week');
    assert.deepEqual(c.days, ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10']);
    assert.equal(c.range, 'Jan 4 – 10, 2027');
    assert.equal(c.canBack, false, 'the first week has no Previous');
    assert.equal(c.canForward, true);
  });
  it('the dome’s Sundays read seven at a time: "Oct 4 – Nov 15, 2026", then on', () => {
    const p = { startsOn: '2026-10-04', endsOn: '2027-03-28', oneWeekday: 7, cursor: '2026-10-04' };
    const c = gridColumns(p);
    assert.equal(c.mode, 'dates');
    assert.deepEqual(c.days, ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15']);
    assert.equal(c.range, 'Oct 4 – Nov 15, 2026');
    const next = gridColumns({ ...p, cursor: stepGrid(p, 1) });
    assert.equal(next.days[0], '2026-11-22');
    assert.ok(next.canBack);
  });
  it('a cursor after the last Sunday (a Saturday end) opens on the LAST seven, never the first (/review)', () => {
    const c = gridColumns({ startsOn: '2026-10-04', endsOn: '2027-03-27', oneWeekday: 7, cursor: '2027-03-24' });
    assert.equal(c.days[c.days.length - 1], '2027-03-21');
    assert.equal(c.canForward, false);
  });
  it('a date off stays a column ("—"), never hidden: Dec 27 is among the 26 Sundays the run holds', () => {
    const all = weekdayDates('2026-10-04', '2027-03-28', 7);
    assert.equal(all.length, 26);
    assert.ok(all.includes('2026-12-27'));
  });
});

// ── The summary and the closing row (specimens 4, 14 step 3) ──────────────────────────────────────

const summary = (over: Partial<GenerateSummary> = {}): GenerateSummary => ({
  weeks: 12, facilities: 2, slots: 354, perWeek: 30, seats: 352, held: 2, heldBy: ['13U AAA'],
  heldWhat: [{ name: '13U AAA', kind: 'tryout' }], targets: [], handedOut: 288, open: 64, kept: 0, notKept: 0, ...over,
});

describe('step 1 counts the time the way the drawings say it', () => {
  it('the lanes: "12 weeks · 2 lanes · 30 slots a week · 354 slots"', () => {
    assert.equal(summaryLine(summary(), null, facilityNoun(['Lane 1', 'Lane 2'], 2)), '12 weeks · 2 lanes · 30 slots a week · 354 slots');
  });
  it('the dome: "25 Sundays · 6 fields · 12 slots a Sunday · 300 slots"', () => {
    const s = summary({ weeks: 25, facilities: 6, slots: 300, perWeek: 12 });
    assert.equal(summaryLine(s, 7, facilityNoun(['Field 1', 'Field 2', 'Field 3', 'Field 4', 'Field 5', 'Field 6'], 6)), '25 Sundays · 6 fields · 12 slots a Sunday · 300 slots');
  });
  it('a facility noun only where the names share one', () => {
    assert.equal(facilityNoun(['Lane 1', 'Lane 2'], 2), 'lanes');
    assert.equal(facilityNoun(['Diamond 2'], 1), 'diamond');
    assert.equal(facilityNoun(['North field', 'Turf'], 2), 'facilities');
  });
  it('the closing row: "64 slots left open. 2 more are held by 13U AAA’s tryout day."', () => {
    assert.deepEqual(closingNote({ summary: summary(), method: 'weekly', percentHundredths: 10000 }),
      { words: '64 slots left open. 2 more are held by 13U AAA’s tryout day.', over: false });
  });
  it('By percentage, all of it: "Nothing left open. 2 of the 354 slots are held by 13U AAA’s tryout day."', () => {
    assert.deepEqual(closingNote({ summary: summary({ open: 0, handedOut: 352 }), method: 'percentage', percentHundredths: 10000 }),
      { words: 'Nothing left open. 2 of the 354 slots are held by 13U AAA’s tryout day.', over: false });
  });
  it('over 100% holds Generate drafts, with the reason in the table', () => {
    assert.deepEqual(closingNote({ summary: summary(), method: 'percentage', percentHundredths: 10500 }), { words: '5% over', over: true });
  });
});

// ── A drop's verdict (specimen 7) ─────────────────────────────────────────────────────────────────

const slot = (key: string, day: string, start: string, end: string, teamIds: string[], over: Partial<SlotView> = {}): SlotView => ({
  id: key, key, venueId: 'v', facilityId: over.facilityId ?? 'lane2', startsAt: `${day}T${start}:00Z`, endsAt: `${day}T${end}:00Z`,
  day, weekday: 3, week: '2027-01-04', startClock: start, endClock: end, prime: true, weight: 1, teamIds, locked: false,
  movedByHand: false, handedBack: null, heldBy: null, clash: false, ...over,
});
const names: Record<string, string> = { t15aa: '15U AA', t16aa: '16U AA', t13: '13U AAA' };
const verdict = (slots: SlotView[], from: SlotView, to: SlotView, teamId: string) =>
  dropVerdict({ slots, from, to, teamId, teamsAtOnce: 1, settings: { rules: defaultRules() }, nameOf: id => names[id] ?? id });

describe('a drop reads green, amber or red — the schedule’s one refusal is a team twice at once', () => {
  const tue = slot('tue8', '2027-01-05', '20:00', '21:00', ['t15aa'], { weekday: 2 });
  const wedOpen = slot('wed8', '2027-01-06', '20:00', '21:00', []);
  it('onto an open slot: green, "open"', () => {
    assert.deepEqual(verdict([tue, wedOpen], tue, wedOpen, 't15aa'), { kind: 'free', reason: 'open' });
  });
  it('onto another team’s slot: a swap, green', () => {
    const wed = slot('wed8', '2027-01-06', '20:00', '21:00', ['t16aa']);
    assert.deepEqual(verdict([tue, wed], tue, wed, 't15aa'), { kind: 'free', reason: 'swaps with 16U AA' });
  });
  it('onto a time the team already has elsewhere: red, said in words, and it springs back', () => {
    const wedOther = slot('wed8b', '2027-01-06', '20:00', '21:00', ['t15aa'], { facilityId: 'lane1' });
    assert.deepEqual(verdict([tue, wedOpen, wedOther], tue, wedOpen, 't15aa'), { kind: 'bad', reason: '15U AA would be in two slots at once.' });
  });
  it('onto a slot a booking holds: amber, it still drops (across programs a clash warns)', () => {
    const held = slot('sat9', '2027-01-09', '09:00', '10:00', [], { heldBy: { ownerName: '13U AAA', kind: 'tryout' } });
    assert.deepEqual(verdict([tue, held], tue, held, 't15aa'), { kind: 'warn', reason: 'Tryout day · 13U AAA holds it' });
  });
  it('a rule the generator honours reads amber: a team’s day off, a finish-by', () => {
    const rules = { ...defaultRules(), daysOff: [{ teamId: 't15aa', date: null, weekday: 3, note: 'the coach works nights' }] };
    assert.equal(ruleBroken(rules, 't15aa', wedOpen), 'a day off: the coach works nights');
    const late = { ...defaultRules(), windows: [{ teamIds: ['t15aa'], startAfter: null, startBy: null, finishBy: '20:00' }] };
    assert.equal(ruleBroken(late, 't15aa', wedOpen), 'finishes after 8:00 p.m.');
  });
});

describe('a one-weekday schedule’s seven dates are seven weeks (/review)', () => {
  const sundays = ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'];
  const slots = sundays.flatMap(d => [slot(`${d}a`, d, '08:00', '09:30', ['t13']), slot(`${d}b`, d, '09:30', '11:00', ['t13'])]);
  it('"A week" is each Sunday’s share: 14 slots over 7 Sundays reads 2', () => {
    const weeks = weeksOnScreen('dates', sundays, slots);
    assert.equal(weeks, 7);
    assert.equal(perWeek(weekCounts(slots, sundays).get('t13') ?? 0, weeks), 2);
    assert.equal(weeksOnScreen('week', sundays, slots), 1);
  });
  it('a set number a week is owed for each of them: 3 a Sunday over 7 Sundays is 7 short with 14', () => {
    const short = weekShortfalls({ slots, week: sundays, results: [{ teamId: 't13', target: 75 }], settings: { split: { method: 'weekly', values: { t13: 3 } } }, weeks: 7 });
    assert.equal(short.get('t13'), 7);
  });
  it('a shared slot’s time is split between its teams on the bill, as the server prices it', () => {
    const shared = [slot('s1', '2027-01-05', '18:00', '19:00', ['t15aa', 't16aa']), slot('s2', '2027-01-06', '18:00', '19:00', ['t16aa'])];
    const priced = pricedMinutes(viewBillSlots(shared));
    assert.equal(priced.get('t15aa'), 30);
    assert.equal(priced.get('t16aa'), 90);
  });
  it('a refusal because the schedule changed is the one a window re-reads for', () => {
    assert.equal(isStale({ code: 'changed', error: 'x' }), true);
    assert.equal(isStale({ code: 'team_twice' }), false);
    assert.equal(isStale(null), false);
  });
});

describe('Fair shares says who is short THIS week', () => {
  it('a weekly split reads its own figure: 12U AA is 1 short once its Tuesday is cleared', () => {
    const week = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10'];
    const slots = [slot('a', '2027-01-04', '18:00', '19:00', ['t12']), slot('b', '2027-01-06', '18:00', '19:00', ['t12']), slot('c', '2027-01-05', '19:00', '20:00', [])];
    const short = weekShortfalls({ slots, week, results: [{ teamId: 't12', target: 36 }], settings: { split: { method: 'weekly', values: { t12: 3 } } } });
    assert.equal(short.get('t12'), 1);
  });
});

// ── The printed schedule and the workbook (specimen 15) ───────────────────────────────────────────

const DOME = { venueId: 'v-dome', venueName: 'Lakeshore Dome', facilities: [1, 2, 3, 4, 5, 6].map(n => ({ id: `f${n}`, name: `Field ${n}` })) };
const TEAMS = ['15U AAA', '15U AA', '16U AA', '14U AA', '13U AAA', '12U AA', '11U AA', '9U AA'].map((name, i) => ({ id: `t${i}`, name, groupName: i < 4 ? 'Senior' : 'Junior' }));
const PLAN = [['t0', 't1', 't6', 't7', 't4', 't5'], ['t2', 't3', 't4', 't5', 't6', 't7']];
const SUNDAYS = Array.from({ length: 26 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 4 + i * 7));
  return d.toISOString().slice(0, 10);
}).filter(d => d !== '2026-12-27');
const domeSlots: DocSlot[] = SUNDAYS.flatMap(day => [['08:00', '09:30'], ['09:30', '11:00']].flatMap(([a, b], k) => DOME.facilities.map((f, i) => ({
  key: `${day}|${f.id}|${a}`, venueId: DOME.venueId, facilityId: f.id, day, weekday: 7, startClock: a, endClock: b,
  startsAt: `${day}T${a}:00Z`, endsAt: `${day}T${b}:00Z`, teamIds: [PLAN[k][i]], weight: i >= 4 ? 0.5 : 1, prime: false, heldBy: null,
}))));
const input = {
  name: 'Winter dome · Sundays', startsOn: '2026-10-04', endsOn: '2027-03-28', places: [DOME], teams: TEAMS, slots: domeSlots,
  datesOff: [{ day: '2026-12-27', note: 'the dome is closed' }], state: 'final' as const,
};

describe('the schedule’s PDF: a section per Sunday, the fields across (specimen 15)', () => {
  const doc = clubScheduleDocument(input);
  it('25 sections, each "Sun, Oct 4, 2026 · 12 slots · Lakeshore Dome", two rows of time', () => {
    assert.equal(doc.groups.length, 25);
    assert.equal(doc.groups[0].label, 'Sun, Oct 4, 2026   ·   12 slots   ·   Lakeshore Dome');
    assert.equal(doc.groups[0].rows.length, 2);
  });
  it('the heading row names the half fields; a row reads its teams across', () => {
    assert.deepEqual(doc.groups[0].headers, ['Time', 'Field 1', 'Field 2', 'Field 3', 'Field 4', 'Field 5 · half', 'Field 6 · half']);
    assert.deepEqual(doc.groups[0].rows[0], ['8:00–9:30 a.m.', '15U AAA', '15U AA', '11U AA', '9U AA', '13U AAA', '12U AA']);
  });
  it('the notes say the zone, the half fields, the date off and a hand-back — once, under the tables', () => {
    const notes = doc.notes.join(' ');
    assert.match(notes, /Field 5 and Field 6 are half fields\./);
    assert.match(notes, /Dates off: Sun, Dec 27 \(the dome is closed\)\./);
    assert.match(notes, /handed back after this was printed/);
  });
});

describe('the schedule’s workbook adds up (specimen 15)', () => {
  it('300 slots · 450 h · $27,000.00 at the dome’s $72.00 a full field’s hour; a half slot $54.00, a full $108.00', () => {
    const sheets = scheduleSheets({ ...input, pricing: { fullHour: 72, permitCost: 27000, permitName: 'Winter dome 2026–27' } });
    const total = sheets.rows[sheets.rows.length - 1];
    assert.equal(total[0], '300 slots');
    assert.equal(total[7], 450);
    assert.equal(total[8], 27000);
    const half = sheets.rows.find(r => String(r[4]).includes('(half)'))!;
    const full = sheets.rows.find(r => r[4] === 'Field 1')!;
    assert.equal(half[8], 54);
    assert.equal(full[8], 108);
    assert.deepEqual(sheets.rowStyles[sheets.rows.length - 1], { bold: true });
  });
  it('a money reader’s file only: without the price there is no Cost column', () => {
    const sheets = scheduleSheets(input);
    assert.ok(!sheets.headers.includes('Cost'));
  });
  it('By team and By field: every team’s slots and each field’s hours', () => {
    const sheets = scheduleSheets(input);
    const byTeam = sheets.extraSheets.find(s => s.name === 'By team')!;
    assert.deepEqual(byTeam.rows.find(r => r[0] === '15U AAA')?.slice(2, 4), [25, 37.5]);
    assert.deepEqual(byTeam.rows.find(r => r[0] === '13U AAA')?.slice(2, 4), [50, 75]);
    const byField = sheets.extraSheets.find(s => s.name === 'By field')!;
    assert.equal(byField.rows.length, 6);
  });
  it('a sheet name Excel accepts', () => {
    assert.equal(sheetNameOf('Winter dome · Sundays'), 'Winter dome · Sundays');
    assert.equal(sheetNameOf('Dome: 2026/27 [draft]'), 'Dome 2026 27 draft');
  });
});

// ── A phone's Day (owner, 2026-10-12, walk §300) ──────────────────────────────────────────────────

describe('a phone reads one day at a time, only the days with slots', () => {
  const at = (day: string) => ({ day });
  it('the dome steps Sunday to Sunday: each date once, in order, and a date off is never a stop', () => {
    const slots = [at('2026-12-20'), at('2026-10-04'), at('2026-10-04'), at('2027-01-03'), at('2026-10-11')];
    assert.deepEqual(slotDays(slots), ['2026-10-04', '2026-10-11', '2026-12-20', '2027-01-03'], 'Dec 27 (the dome closed) has no slot, so no stop');
  });
  it('opens on today, or the next day with slots, while the schedule runs', () => {
    const days = ['2026-10-04', '2026-10-11', '2026-10-18', '2027-03-28'];
    assert.equal(openingDay(days, '2026-10-04', '2027-03-28', '2026-10-11'), '2026-10-11', 'a Sunday opens on itself');
    assert.equal(openingDay(days, '2026-10-04', '2027-03-28', '2026-10-12'), '2026-10-18', 'a Monday opens on the next Sunday');
  });
  it('before it starts, and after it ends, it opens on its first day', () => {
    const days = ['2026-10-04', '2026-10-11'];
    assert.equal(openingDay(days, '2026-10-04', '2027-03-28', '2026-09-01'), '2026-10-04');
    assert.equal(openingDay(days, '2026-10-04', '2026-10-11', '2026-11-01'), '2026-10-04');
  });
  it('past its last slot while it still runs, it opens on that last day; with no slots, nowhere', () => {
    assert.equal(openingDay(['2026-10-04', '2026-10-11'], '2026-10-04', '2027-03-28', '2026-12-01'), '2026-10-11');
    assert.equal(openingDay([], '2026-10-04', '2027-03-28', '2026-10-12'), null);
  });
});
