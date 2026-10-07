import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calendarYearsTouched, closedThrough, fiscalQuarters, fiscalYearAt, fiscalYearFileName, fiscalYearMonths,
  fiscalYearName, fiscalYearOf, fiscalYearOptions, nextFiscalYear, previousFiscalYear, readFiscalYearParam,
  shiftMonthsBack, shiftMonthsOn, type FiscalSetting, type FiscalYearRow,
} from '../../lib/club-fiscal-year.ts';

/**
 * Club Tier Stage 3c — THE FISCAL YEAR, ONE DEFINITION (lib/club-fiscal-year.ts; Asks 5 and 9, S3C-08). The pure
 * twin of the database's `club_fiscal_year_ensure` (mig 318); `check:club-money-atomicity` proves the database half.
 */

const JAN: FiscalSetting = { firstMonth: 1, rows: [] };
const SEP: FiscalSetting = { firstMonth: 9, rows: [] };
const row = (first: string, last: string, over: Partial<FiscalYearRow> = {}): FiscalYearRow => ({
  id: `row-${first}`, name: fiscalYearName(first, last), firstDay: first, lastDay: last,
  closedAt: null, closedBy: null, closingBalance: null, ...over,
});

describe('the fiscal year a day falls in', () => {
  it('a January club with no rows reads calendar years exactly as before 3c', () => {
    const y = fiscalYearOf('2026-10-07', JAN);
    assert.deepEqual([y.key, y.name, y.firstDay, y.lastDay, y.months, y.short, y.id], ['2026-01-01', '2026', '2026-01-01', '2026-12-31', 12, false, null]);
    assert.equal(fiscalYearOf('2026-12-31', JAN).key, '2026-01-01');
    assert.equal(fiscalYearOf('2027-01-01', JAN).key, '2027-01-01');
  });
  it('a September club: the year crosses a New Year and is named for both', () => {
    const y = fiscalYearOf('2026-10-07', SEP);
    assert.deepEqual([y.name, y.firstDay, y.lastDay], ['2026–27', '2026-09-01', '2027-08-31']);
    assert.equal(fiscalYearOf('2026-08-31', SEP).name, '2025–26', 'the last day of August is last year');
    assert.equal(fiscalYearOf('2026-09-01', SEP).name, '2026–27', 'the first of September starts the year');
    assert.equal(fiscalYearOf('2027-02-28', SEP).name, '2026–27');
  });
  it('the short transition year: a year that has begun keeps its months, the NEXT is short, then the new twelve', () => {
    const s: FiscalSetting = { firstMonth: 9, rows: [row('2026-01-01', '2026-12-31'), row('2027-01-01', '2027-08-31')] };
    const short = fiscalYearOf('2027-05-01', s);
    assert.deepEqual([short.name, short.months, short.short, short.id], ['2027', 8, true, 'row-2027-01-01']);
    const after = fiscalYearOf('2027-09-01', s);
    assert.deepEqual([after.name, after.firstDay, after.lastDay, after.id], ['2027–28', '2027-09-01', '2028-08-31', null]);
    assert.equal(fiscalYearOf('2029-01-15', s).name, '2028–29', 'twelve-month years on the new month, as far ahead as asked');
    const before = fiscalYearOf('2025-06-01', s);
    assert.deepEqual([before.name, before.firstDay, before.lastDay], ['2025', '2025-01-01', '2025-12-31'], 'before the rows, twelve-month years ending the day before');
  });
  it('the year after and the year before', () => {
    const y = fiscalYearOf('2026-10-07', SEP);
    assert.equal(nextFiscalYear(y, SEP).name, '2027–28');
    assert.equal(previousFiscalYear(y, SEP).name, '2025–26');
  });
});

describe('the name rule (Ask 9)', () => {
  it('the number for January–December, "2026–27" (en dash) across a New Year', () => {
    assert.equal(fiscalYearName('2026-01-01', '2026-12-31'), '2026');
    assert.equal(fiscalYearName('2025-09-01', '2026-08-31'), '2025–26');
    assert.equal(fiscalYearName('2099-09-01', '2100-08-31'), '2099–00');
    assert.equal(fiscalYearName('2027-01-01', '2027-08-31'), '2027', 'a short year inside one calendar year');
  });
  it('a file name writes the en dash as a hyphen — the only place it does', () => {
    assert.equal(fiscalYearFileName('2025–26'), '2025-26');
  });
  it('a renamed year keeps its name; a later year the rule would name the same gets a number after it', () => {
    const s: FiscalSetting = { firstMonth: 1, rows: [row('2026-01-01', '2026-12-31', { name: '2027' })] };
    assert.equal(fiscalYearOf('2026-03-01', s).name, '2027');
    assert.equal(fiscalYearOf('2027-03-01', s).name, '2027 (2)');
  });
});

describe('closed and locked (Asks 1–3)', () => {
  const s: FiscalSetting = {
    firstMonth: 9,
    rows: [
      row('2024-09-01', '2025-08-31', { closedAt: '2025-10-01T12:00:00Z', closedBy: 'u1', closingBalance: 15880 }),
      row('2025-09-01', '2026-08-31', { closedAt: '2026-10-07T12:00:00Z', closedBy: 'u2', closingBalance: 16940 }),
      row('2026-09-01', '2027-08-31'),
    ],
  };
  it('the books are closed through the newest closed year\'s last day', () => {
    assert.equal(closedThrough(s), '2026-08-31');
    assert.equal(closedThrough(SEP), null);
  });
  it('a closed year carries its close; a year before the first closed one is locked too; an open one is neither', () => {
    const y = fiscalYearOf('2026-03-01', s);
    assert.deepEqual([y.locked, y.closed?.closingBalance, y.closed?.by], [true, 16940, 'u2']);
    const before = fiscalYearOf('2023-03-01', s);
    assert.deepEqual([before.locked, before.closed], [true, null]);
    const open = fiscalYearOf('2026-10-07', s);
    assert.deepEqual([open.locked, open.closed], [false, null]);
  });
});

describe('the key an address carries (call 3)', () => {
  it('a key is a year\'s first day; any other day starts no year', () => {
    assert.equal(fiscalYearAt('2026-09-01', SEP)?.name, '2026–27');
    assert.equal(fiscalYearAt('2026-09-02', SEP), null);
    assert.equal(readFiscalYearParam('2026-09-01', SEP)?.name, '2026–27');
    assert.equal(readFiscalYearParam('2026-09-15', SEP), null);
    assert.equal(readFiscalYearParam('', SEP), null);
    assert.equal(readFiscalYearParam('garbage', SEP), null);
  });
  it('an old ?year=2026 link still lands: the year with that name, else the year that starts in 2026', () => {
    assert.equal(readFiscalYearParam('2026', JAN)?.key, '2026-01-01');
    const named: FiscalSetting = { firstMonth: 9, rows: [row('2026-01-01', '2026-12-31'), row('2027-01-01', '2027-08-31')] };
    assert.equal(readFiscalYearParam('2027', named)?.key, '2027-01-01', 'the short year named 2027');
    assert.equal(readFiscalYearParam('2026', SEP)?.key, '2026-09-01', 'no row named 2026: the year that starts in 2026');
  });
});

describe('months and quarters (S3C-02)', () => {
  it('a September year\'s twelve months from September; its quarters start there, named by their months', () => {
    const y = fiscalYearOf('2026-10-07', SEP);
    const months = fiscalYearMonths(y);
    assert.deepEqual([months.length, months[0], months[11]], [12, '2026-09', '2027-08']);
    assert.deepEqual(fiscalQuarters(y).map(q => [q.key, q.label]), [
      ['2026-09~q', 'Sep–Nov'], ['2026-12~q', 'Dec–Feb'], ['2027-03~q', 'Mar–May'], ['2027-06~q', 'Jun–Aug'],
    ]);
  });
  it('a short year shows its own months, and its last quarter may be shorter', () => {
    const y = { firstDay: '2027-01-01', lastDay: '2027-08-31' };
    assert.equal(fiscalYearMonths(y).length, 8);
    assert.deepEqual(fiscalQuarters(y).map(q => q.label), ['Jan–Mar', 'Apr–Jun', 'Jul–Aug']);
  });
  it('the calendar years a fiscal year touches (S3C-03: a team is active when it has a season numbered for either)', () => {
    assert.deepEqual(calendarYearsTouched(fiscalYearOf('2026-10-07', SEP)), [2026, 2027]);
    assert.deepEqual(calendarYearsTouched(fiscalYearOf('2026-10-07', JAN)), [2026]);
  });
  it('the same day months LATER keeps a month\'s end its month\'s end (Against last year\'s "same months")', () => {
    assert.equal(shiftMonthsOn('2027-02-28', 12), '2028-02-29');
    assert.equal(shiftMonthsOn('2026-08-31', 12), '2027-08-31');
    assert.equal(shiftMonthsOn('2025-09-01', 12), '2026-09-01');
    assert.equal(shiftMonthsOn('2026-01-31', 1), '2026-02-28');
  });
  it('the same day months earlier keeps a month\'s end its month\'s end', () => {
    assert.equal(shiftMonthsBack('2027-08-31', 12), '2026-08-31');
    assert.equal(shiftMonthsBack('2026-03-31', 1), '2026-02-28');
    assert.equal(shiftMonthsBack('2026-10-07', 12), '2025-10-07');
    assert.equal(shiftMonthsBack('2028-02-29', 12), '2027-02-28');
  });
});

describe('the Year pill (fiscalYearOptions)', () => {
  it('every year with a line, every closed year, this year and ALWAYS the next — never an empty year two ahead', () => {
    const s: FiscalSetting = { firstMonth: 9, rows: [row('2024-09-01', '2025-08-31', { closedAt: '2025-10-01T12:00:00Z', closingBalance: 1 })] };
    const opts = fiscalYearOptions(s, '2026-10-07', { '2025-09-01': 4 });
    assert.deepEqual(opts.map(o => [o.name, o.locked, o.current, o.lines]), [
      ['2027–28', false, false, 0], ['2026–27', false, true, 0], ['2025–26', false, false, 4], ['2024–25', true, false, 0],
    ]);
  });
});
