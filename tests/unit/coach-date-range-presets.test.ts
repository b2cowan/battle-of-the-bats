/**
 * The Date pill's preset arithmetic (`lib/coach-date-range.ts`) — the Transactions register's
 * fourth pill resolves every preset to a plain from/to pair of day keys, and these are the edges
 * where calendar math quietly goes wrong: month lengths, the December→January year rollback, leap
 * February, and the one preset ('around') whose whole job is to keep the OLD default window —
 * 30 back / 30 ahead — alive to the day. If 'around' drifts, the register's default view changed
 * without anyone deciding it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AROUND_WINDOW_DAYS, DATE_RANGE_PRESETS, computeSeasonBounds, isDateRangePresetId,
  resolveDateRangePreset,
} from '../../lib/coach-date-range.ts';

const SEASON = { from: '2025-11-01', to: '2026-10-15' };

describe('coach date-range presets', () => {
  it("'around' is the old default window to the day: 30 back / 30 ahead", () => {
    assert.deepEqual(
      resolveDateRangePreset('around', '2026-08-19', SEASON),
      { from: '2026-07-20', to: '2026-09-18' },
    );
  });

  it('the backward presets end today, not tomorrow', () => {
    assert.deepEqual(
      resolveDateRangePreset('last30', '2026-08-19', SEASON),
      { from: '2026-07-20', to: '2026-08-19' },
    );
    assert.deepEqual(
      resolveDateRangePreset('last60', '2026-08-19', SEASON),
      { from: '2026-06-20', to: '2026-08-19' },
    );
    assert.deepEqual(
      resolveDateRangePreset('last90', '2026-08-19', SEASON),
      { from: '2026-05-21', to: '2026-08-19' },
    );
  });

  it("'thisMonth' runs to the month's END (the rest of the month's commitments are the point)", () => {
    assert.deepEqual(
      resolveDateRangePreset('thisMonth', '2026-08-19', SEASON),
      { from: '2026-08-01', to: '2026-08-31' },
    );
    // 30-day month
    assert.deepEqual(
      resolveDateRangePreset('thisMonth', '2026-09-02', SEASON),
      { from: '2026-09-01', to: '2026-09-30' },
    );
    // December — the next-month-start trick has to cross the year to find Dec 31
    assert.deepEqual(
      resolveDateRangePreset('thisMonth', '2026-12-25', SEASON),
      { from: '2026-12-01', to: '2026-12-31' },
    );
  });

  it("'lastMonth' rolls the year back from January", () => {
    assert.deepEqual(
      resolveDateRangePreset('lastMonth', '2026-01-10', SEASON),
      { from: '2025-12-01', to: '2025-12-31' },
    );
  });

  it("'lastMonth' from March finds leap February whole", () => {
    // 2028 is a leap year — the month-end walk must land on the 29th, not the 28th or March 1st
    assert.deepEqual(
      resolveDateRangePreset('lastMonth', '2028-03-15', SEASON),
      { from: '2028-02-01', to: '2028-02-29' },
    );
    assert.deepEqual(
      resolveDateRangePreset('lastMonth', '2026-03-15', SEASON),
      { from: '2026-02-01', to: '2026-02-28' },
    );
  });

  it("'season' is exactly the caller's bounds — never a calendar-year guess", () => {
    assert.deepEqual(resolveDateRangePreset('season', '2026-08-19', SEASON), SEASON);
  });

  it('every listed preset resolves to an ordered window', () => {
    for (const p of DATE_RANGE_PRESETS) {
      const { from, to } = resolveDateRangePreset(p.id, '2026-08-19', SEASON);
      assert.ok(from <= to, `${p.id} resolved backwards: ${from} > ${to}`);
    }
  });

  it('the id guard admits the menu and refuses everything else', () => {
    for (const p of DATE_RANGE_PRESETS) assert.ok(isDateRangePresetId(p.id));
    // 'custom' is deliberately NOT a preset id — it is only ever entered by editing a date field,
    // and the per-team memory must refuse it (a pinned window would go stale; the preset can't).
    assert.equal(isDateRangePresetId('custom'), false);
    assert.equal(isDateRangePresetId(''), false);
    assert.equal(isDateRangePresetId('last7'), false);
  });
});

describe('computeSeasonBounds', () => {
  it("an empty (or still-loading) book floors to the around-today window — the same ±30 'around' uses", () => {
    const bounds = computeSeasonBounds([], '2026-08-19');
    assert.deepEqual(bounds, { from: '2026-07-20', to: '2026-09-18' });
    // The tie that keeps the default window from disagreeing with itself: same constant, same window.
    assert.deepEqual(bounds, resolveDateRangePreset('around', '2026-08-19', bounds));
    assert.equal(AROUND_WINDOW_DAYS, 30);
  });

  it('rows outside the floor widen each edge independently — a fall-before deposit is never cropped', () => {
    const rows = [
      { date: '2025-11-01' }, // the deposit paid the fall before — the whole reason 'season' ≠ calendar year
      { date: '2026-08-10' },
      { date: '2026-12-15' }, // a scheduled commitment past the forward floor
    ];
    assert.deepEqual(
      computeSeasonBounds(rows, '2026-08-19'),
      { from: '2025-11-01', to: '2026-12-15' },
    );
  });

  it('rows inside the floor leave it alone, and undated rows are skipped', () => {
    assert.deepEqual(
      computeSeasonBounds([{ date: '2026-08-01' }, { date: null }], '2026-08-19'),
      { from: '2026-07-20', to: '2026-09-18' },
    );
  });
});
