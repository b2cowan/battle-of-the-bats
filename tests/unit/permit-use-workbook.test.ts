import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { permitUseSheets } from '../../lib/permit-use-workbook.ts';
import { buildXLSXWorkbook, pageFooterText } from '../../lib/export/xlsx.ts';
import type { PermitView } from '../../lib/permit-server.ts';

/**
 * A PERMIT'S USE, AS A WORKBOOK (Club Tier Stage 10a; hub specimen 15; Ask 26) — its arithmetic recomputed from its own
 * rows (the `check:club-money-arithmetic` pattern): every field's Held − Booked = Unused, the totals row = Σ the rows,
 * Used = Booked ÷ Held; the money columns only for a reader who holds Accounting; and the house format's print setup.
 */

const view: PermitView = {
  id: 'p', name: 'Winter dome 2026–27', issuerName: 'Lakeshore Dome', issuerPayeeId: null, reference: 'W26-118',
  heldFor: 'club', heldForTeam: null, startsOn: '2026-10-04', endsOn: '2027-03-28', notes: null, updatedAt: '2026-10-11T12:00:00Z',
  document: null, year: { key: '2026-09-01', name: '2026–27', locked: false },
  blocks: [{
    id: 'b', venueId: 'v', venueName: 'Lakeshore Dome', facilityIds: null, facilityNames: null, weekdays: [7],
    startTime: '08:00', endTime: '11:00', fromDate: null, untilDate: null, heldMinutes: 450 * 60, weekMinutes: 18 * 60,
    bookedMinutes: 445.5 * 60, unplacedMinutes: 0, who: ['15U AAA', '13U AAA'],
  }],
  datesOff: [{ day: '2026-12-27', note: 'the dome is closed' }],
  places: [1, 2, 3, 4, 5, 6].map(n => ({
    venueId: 'v', venueName: 'Lakeshore Dome', facilityId: `f${n}`, facilityName: `Field ${n}`, share: n > 4 ? 0.5 : 1,
    heldMinutes: 75 * 60, bookedMinutes: (n === 3 ? 72 : n === 5 ? 73.5 : 75) * 60, who: ['A team'], hour: n > 4 ? 36 : 72,
  })),
  use: {
    heldMinutes: 450 * 60, bookedMinutes: 445.5 * 60, unusedMinutes: 4.5 * 60,
    days: [{ day: '2026-10-04', heldMinutes: 18 * 60, bookedMinutes: 18 * 60 }],
  },
  weekMinutes: 18 * 60,
  renewedFrom: null,
  cost: 27000,
  budgetLine: null,
  prices: { fullHour: 72, allFull: false, fullFieldHours: 375 },
};

describe('a permit\'s use workbook — the arithmetic from its own rows', () => {
  const s = permitUseSheets(view, { today: '2027-03-29', sport: 'baseball', money: true });
  const col = (h: string) => s.headers.indexOf(h);
  const body = s.rows.slice(0, -1);
  const total = s.rows[s.rows.length - 1];

  it('a row per field, then the totals row', () => {
    assert.equal(body.length, 6);
    assert.equal(total[0], 'All fields');
  });
  it('every field: Held − Booked = Unused, and Used = Booked ÷ Held', () => {
    for (const r of body) {
      const held = Number(r[col('Held (h)')]), booked = Number(r[col('Booked (h)')]), unused = Number(r[col('Unused (h)')]);
      assert.equal(Math.round((held - booked) * 100) / 100, unused);
      assert.equal(r[col('Used')], Math.round((booked / held) * 100) / 100);
    }
  });
  it('the totals row is the sum of the rows: 450 held, 445.5 booked, 4.5 unused, 99%', () => {
    for (const h of ['Held (h)', 'Booked (h)', 'Unused (h)']) {
      const sum = Math.round(body.reduce((n, r) => n + Number(r[col(h)]), 0) * 100) / 100;
      assert.equal(total[col(h)], sum, h);
    }
    assert.equal(total[col('Held (h)')], 450);
    assert.equal(total[col('Booked (h)')], 445.5);
    assert.equal(total[col('Used')], 0.99);
  });
  it('the field\'s price says Full or Half, never a dollar figure in a cell', () => {
    assert.deepEqual(body.map(r => r[col('Cost')]), ['Full', 'Full', 'Full', 'Full', 'Half', 'Half']);
  });
  it('a field at a percent says its percent — it once said "75% of the" (owner 2026-10-11)', () => {
    const pct = permitUseSheets({ ...view, places: view.places.map((p, i) => (i === 0 ? { ...p, share: 0.75 } : p)) },
      { today: '2027-03-29', sport: 'baseball', money: true });
    assert.equal(pct.rows[0][pct.headers.indexOf('Cost')], '75%');
  });
  it('hours are numbers in an hours format; Used a percent', () => {
    assert.equal(s.columnNumFmts[col('Held (h)')], '0.0#');
    assert.equal(s.columnNumFmts[col('Used')], '0%');
    assert.equal(typeof total[col('Held (h)')], 'number');
  });
  it('the masthead says what it holds and when it was true, with the cost for Accounting', () => {
    assert.match(s.subtitle, /^Permit W26-118 · Lakeshore Dome · every facility · Sun, 8:00–11:00 a\.m\. · Oct 4, 2026 – Mar 28, 2027$/);
    assert.match(s.meta, /^As at March 29, 2027 · held 450 h · \$27,000\.00$/);
  });
  it('the notes say what the three words mean, the clock, and the dates off — under the table', () => {
    const text = s.notes.map(n => n.runs.map(r => r.text).join('')).join(' ');
    assert.match(text, /Held: .*Booked: .*Unused: held less booked\./);
    assert.doesNotMatch(text, /Outside/);
    assert.match(text, /Times in Eastern time\. Dates off: Dec 27, 2026 \(the dome is closed\)\./);
  });
  it('By date is its own sheet, and there is no "Outside the permit" sheet (owner 2026-10-11)', () => {
    assert.deepEqual(s.extraSheets.map(x => x.name), ['By date']);
  });
  it('a reader without Accounting gets no Cost column and no cost in the masthead', () => {
    const t = permitUseSheets(view, { today: '2027-03-29', sport: 'baseball', money: false });
    assert.equal(t.headers.includes('Cost'), false);
    assert.doesNotMatch(t.meta, /\$/);
  });
});

describe('the house format\'s print setup (Ask 26)', () => {
  it('landscape, one page wide, the page footer in words — on every sheet', () => {
    const wb = buildXLSXWorkbook(['A', 'B'], [[1, 2]], 'Use', {
      extraSheets: [{ name: 'By date', headers: ['X'], rows: [[1]] }],
      print: { landscape: true, fitToWidth: true, pageFooter: pageFooterText(true) },
    });
    for (const ws of wb.worksheets) {
      assert.equal(ws.pageSetup.orientation, 'landscape', ws.name);
      assert.equal(ws.pageSetup.fitToPage, true, ws.name);
      assert.equal(ws.pageSetup.fitToWidth, 1, ws.name);
      assert.equal(ws.pageSetup.fitToHeight, 0, ws.name);
      assert.equal(ws.headerFooter.oddFooter, '&CPage &P of &N · Generated by FieldLogicHQ', ws.name);
    }
  });
  it('a club that turned branding off prints the page count alone', () => {
    assert.equal(pageFooterText(false), '&CPage &P of &N');
  });
  it('a file that asks for none keeps the format every other report has', () => {
    const wb = buildXLSXWorkbook(['A'], [[1]], 'Data');
    assert.notEqual(wb.worksheets[0].pageSetup.orientation, 'landscape');
    assert.equal(wb.worksheets[0].headerFooter.oddFooter ?? '', '');
  });
});
