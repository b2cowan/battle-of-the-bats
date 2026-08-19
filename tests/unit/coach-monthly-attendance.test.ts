/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * MONTHLY ATTENDANCE — the schedule-blind aggregate behind the "Month by month" chart (Insights
 * P3, 2026-08-19, gating decision 2). The one thing this module must never be asked to prove is
 * negative: that its OUTPUT shape has no room for an event name, date or opponent. The counting
 * rule itself — no-reply excluded from `known`, late counts as attended — mirrors every other
 * attendance figure in the portal and is covered the same way `coach-attendance-receipts` covers it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMonthlyAttendance, type MonthlyAttendanceMark } from '../../lib/coach-monthly-attendance.ts';

const mark = (month: string, kind: MonthlyAttendanceMark['kind'], status: MonthlyAttendanceMark['status']): MonthlyAttendanceMark =>
  ({ month, kind, status });

describe('computeMonthlyAttendance', () => {
  it('returns nothing for no marks', () => {
    assert.deepEqual(computeMonthlyAttendance([]), []);
  });

  it('buckets by month, oldest first, regardless of input order', () => {
    const out = computeMonthlyAttendance([
      mark('2026-07', 'game', 'attending'),
      mark('2026-05', 'game', 'attending'),
      mark('2026-06', 'practice', 'attending'),
    ]);
    assert.deepEqual(out.map(b => b.month), ['2026-05', '2026-06', '2026-07']);
  });

  it('known excludes no-reply; attended counts late as present; recorded counts everything', () => {
    const out = computeMonthlyAttendance([
      mark('2026-05', 'practice', 'attending'),
      mark('2026-05', 'practice', 'late'),
      mark('2026-05', 'practice', 'absent'),
      mark('2026-05', 'practice', 'unknown'),
    ]);
    assert.deepEqual(out, [{
      month: '2026-05',
      games: { attended: 0, known: 0, recorded: 0 },
      // unknown/no-reply is neither attended nor known, but still recorded — it's the gap
      // `recorded - known` names.
      practices: { attended: 2, known: 3, recorded: 4 },
    }]);
  });

  it('games and practices are counted independently within a month', () => {
    const out = computeMonthlyAttendance([
      mark('2026-05', 'game', 'attending'),
      mark('2026-05', 'game', 'absent'),
      mark('2026-05', 'practice', 'attending'),
    ]);
    assert.deepEqual(out, [{
      month: '2026-05',
      games: { attended: 1, known: 2, recorded: 2 },
      practices: { attended: 1, known: 1, recorded: 1 },
    }]);
  });

  it('a month with only no-reply marks produces a zeroed known/attended bucket, but records the sample size', () => {
    const out = computeMonthlyAttendance([mark('2026-05', 'practice', 'unknown')]);
    assert.deepEqual(out, [{
      month: '2026-05',
      games: { attended: 0, known: 0, recorded: 0 },
      practices: { attended: 0, known: 0, recorded: 1 },
    }]);
  });
});
