// Monthly attendance — the season's turnout broken down by month, behind the Attendance tab's
// "Month by month" chart. PURE, no I/O, no React.
//
// Insights Reports Portal P3 (COACH_INSIGHTS_REPORTS_PORTAL_P3_BUILD_PROMPT.md, gating decision 2).
//
// ⚠⚠ SCHEDULE-BLIND ON PURPOSE — this is the whole point of the module. The per-player receipts
// (`lib/coach-attendance-receipts.ts`) carry an event's date and opponent name, which is schedule
// content and gated on `canViewSchedule` as well as `attendance` (P2's fix to a real leak). A month
// bucket carries neither: only a `YYYY-MM` key, a game/practice split, and a status already reduced to
// attended/known. Nothing in this module's OUTPUT can be traced back to one event, one date, or one
// opponent, so it never needs — and must never grow — that second gate. If a future change adds
// anything to `MonthlyAttendanceMark` beyond `month`/`kind`/`status`, re-open that decision rather than
// assuming this module still qualifies.
//
// Counting rule matches every other attendance figure in the portal — sourced from
// `classifyAttendanceMark`, not restated here, so this bucket can't quietly drift from what the
// receipts (or the season roll-up) call "known"/"attended" for the same mark.
import { classifyAttendanceMark, type AttendanceMarkStatus } from './coach-attendance-receipts.ts';

export interface MonthlyAttendanceMark {
  /** `YYYY-MM` in the org's calendar — never a finer-grained date. */
  month: string;
  kind: 'game' | 'practice';
  status: AttendanceMarkStatus;
}

export interface MonthlyAttendanceCategory {
  attended: number;
  known: number;
  /** Every mark recorded this month for this category, INCLUDING no-reply. `recorded - known` is
   *  the share left at no-reply — the gap the chart's hatch overlay and footer caption name. */
  recorded: number;
}

export interface MonthlyAttendanceBucket {
  month: string;
  games: MonthlyAttendanceCategory;
  practices: MonthlyAttendanceCategory;
}

function bump(cat: MonthlyAttendanceCategory, status: AttendanceMarkStatus) {
  cat.recorded += 1;
  const { known, attended } = classifyAttendanceMark(status);
  if (known) cat.known += 1;
  if (attended) cat.attended += 1;
}

/** Buckets, oldest month first. A month with zero marks of either kind never gets an entry — the
 *  caller decides how to render "nothing recorded" rather than being handed an empty 0/0 row. */
export function computeMonthlyAttendance(marks: MonthlyAttendanceMark[]): MonthlyAttendanceBucket[] {
  const byMonth = new Map<string, MonthlyAttendanceBucket>();
  for (const m of marks) {
    let bucket = byMonth.get(m.month);
    if (!bucket) {
      bucket = {
        month: m.month,
        games: { attended: 0, known: 0, recorded: 0 },
        practices: { attended: 0, known: 0, recorded: 0 },
      };
      byMonth.set(m.month, bucket);
    }
    bump(m.kind === 'game' ? bucket.games : bucket.practices, m.status);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}
