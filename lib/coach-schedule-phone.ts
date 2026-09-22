/**
 * THE SCHEDULE ON A PHONE — the pure decisions behind stage 2 of the phone re-evaluation (owner
 * rulings C1–C3, 2026-09-21; plan `COACH_MOBILE_EXPERIENCE_PLAN.md` §8). React-free on purpose so
 * `node --test` reads them straight, and so the page cannot quietly re-derive any of them inline.
 *
 *   · `pickTodayRow`  — which row the list opens ON. The club-local DAY decides, never the instant:
 *                       a game that started an hour ago is still today's and is the first row; a day
 *                       with nothing lands on the next event; a season with everything behind it
 *                       lands on its last row, so the last month reaches the top (C1).
 *   · `groupWeekDays` — a week's seven days as the days that have something plus one quiet line per
 *                       run of empty days, labelled "Mon 14 – Thu 17" (an en dash) or "Sat 19" (C2).
 *   · `sheetOrder`    — whether the event sheet leads with the score or with the tabs (C3). Keyed on
 *                       the START, not on "finished": keyed on whether a score exists, the coach
 *                       entering it on game night would scroll past twelve attendance rows to reach
 *                       the door. A score that already exists leads regardless, because the sheet
 *                       has nowhere else to put a scoreline.
 */

/** Index of the row the list opens on — the first row dated on or after `today`, else the last. */
export function pickTodayRow(dayKeys: readonly string[], today: string): number {
  if (dayKeys.length === 0) return -1;
  const at = dayKeys.findIndex(day => day >= today);
  return at >= 0 ? at : dayKeys.length - 1;
}

export type WeekDayInput = { key: string; label: string; hasEvents: boolean };
export type WeekGroup =
  | { kind: 'day'; key: string }
  | { kind: 'empty'; from: string; to: string; label: string };

/**
 * Seven days → the days with events, and each run of consecutive empty days folded to one line.
 * `label` is the day's short form ("Mon 14"); a run reads "Mon 14 – Thu 17", a single day "Sat 19".
 */
export function groupWeekDays(days: readonly WeekDayInput[]): WeekGroup[] {
  const out: WeekGroup[] = [];
  let run: WeekDayInput[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const first = run[0], last = run[run.length - 1];
    out.push({
      kind: 'empty',
      from: first.key,
      to: last.key,
      label: run.length === 1 ? first.label : `${first.label} – ${last.label}`,
    });
    run = [];
  };
  for (const day of days) {
    if (day.hasEvents) { flush(); out.push({ kind: 'day', key: day.key }); }
    else run.push(day);
  }
  flush();
  return out;
}

/** The quiet line's whole sentence — one spelling, read by the page and the tests. */
export const WEEK_EMPTY_SUFFIX = 'nothing scheduled';
export const weekEmptyLine = (label: string) => `${label} · ${WEEK_EMPTY_SUFFIX}`;

export type SheetOrder = 'score-first' | 'tabs-first';

/**
 * Which order the phone sheet renders a GAME in. `started` is `gameHasStarted(event, nowMs)`;
 * `hasScore` is whether a final score already exists. Practices and other kinds never ask.
 */
export function sheetOrder({ started, hasScore }: { started: boolean; hasScore: boolean }): SheetOrder {
  return started || hasScore ? 'score-first' : 'tabs-first';
}
