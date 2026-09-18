/**
 * A practice's STATE, and the one action it earns — shared by the Practice plans hub's card and
 * rows and by the Overview's next-event card (practices re-evaluation stage 0 · Arrive, owner
 * rulings D1 · D3 · D4 · D7, 2026-09-14).
 *
 * ⚠ ONE definition of "has a plan": at least one BLOCK. The builder autosaves once a goal alone
 * exists, so a goal typed and abandoned is a real, blockless plan row — keying off the row's
 * existence made the hub say "Plan set · 0 blocks" and drop that practice out of the very filter
 * built to catch it (2026-08-15). Every surface that answers "planned?" answers it here.
 *
 * ⚠ ONE run window. "Run practice" is offered for three hours either side of the start — clock
 * arithmetic on absolute instants, so there is no date boundary and no timezone to get wrong. The
 * hub's card, the hub's rows and the Overview read the same constant; a second window anywhere
 * would let one screen offer the field door while another still says "plan it". ⚠ The window is
 * about which DOOR to offer today; the field screen itself has no clock (stage 5, P10) and reads
 * the same on any day.
 *
 * ⚠ ONE record boundary (stage 6, R1): a practice is a RECORD from the instant its run window
 * closes — `practiceIsRecord`, beside the window it reads. The plan page and the closed-season
 * reader draw the record's face from it; nothing else may compute a date boundary of its own.
 *
 * ⚠ Nothing here records what HAPPENED. `run` means "the window is open and there is a plan to
 * run", never "the practice was run" — "planned, never done" (`lib/rep-practice-plan.ts` rule 2).
 * A "record" is a plan the clock has passed, and the recap the coach wrote — never a claim that
 * the practice took place as planned.
 */
import { summarizePracticePlan, totalPlannedMinutes } from './rep-practice-plan';
import type { PracticePlan, RepTeamEvent } from './types';

/** Three hours either side of the start. The only run window in the product. */
export const RUN_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * `none` — no plan (or a blockless one) · `planned` — at least one block · `run` — planned AND
 * inside the run window. The card's lime follows this: Plan this practice · Open the plan · Run
 * practice.
 */
export type PracticePlanState = 'none' | 'planned' | 'run';

export function practiceHasPlan(e: Pick<RepTeamEvent, 'practicePlan'>): boolean {
  return (e.practicePlan?.blocks.length ?? 0) > 0;
}

/**
 * Three hours before the start to three hours after the END — or after the start, when the
 * practice has no end (or one before its start). ⚠ Both edges, one constant: the window used to be
 * ±3h of the START alone, so a four-hour practice lost its doors and its field clock an hour
 * before it finished (/review, stage 5, 2026-09-17). Every door and the field screen read this;
 * the callers that know the end pass it.
 */
export function isInRunWindow(startsAt: string, nowMs: number, endsAt?: string | null): boolean {
  const window = runWindowOf(startsAt, endsAt);
  return !!window && nowMs >= window.opensAtMs && nowMs <= window.closesAtMs;
}

/**
 * Is the practice a RECORD — its run window has CLOSED: three hours after the planned end, or after
 * the start with no end (practices re-evaluation stage 6, owner ruling R1, 2026-09-18). The same
 * instant the green Run practice goes plain on every door; before it the plan page is the live
 * editor (tonight's, and the three hours after — the couch write-up lands there), after it the
 * page is the record's face with "How it went" first. Nothing is stored; the plan page reads this
 * from its minute clock. ⚠ The ONLY place "is it a record" is decided — the hub's split at NOW
 * (`Recent practices`) is a different, coarser fact and stays as it is.
 */
export function practiceIsRecord(startsAt: string | null | undefined, nowMs: number, endsAt?: string | null): boolean {
  if (!startsAt) return false;
  const window = runWindowOf(startsAt, endsAt);
  return !!window && nowMs > window.closesAtMs;
}

/**
 * The run window's two edges, from the ONE constant — the start minus three hours, and three
 * hours after the end (or the start, when the practice has no end or one at or before its start).
 * Null when the start is not a date. `isInRunWindow` and `practiceIsRecord` are the two readers;
 * a third boundary computed anywhere else is the drift this module exists to remove.
 */
function runWindowOf(startsAt: string, endsAt?: string | null): { opensAtMs: number; closesAtMs: number } | null {
  const startMs = new Date(startsAt).getTime();
  if (!Number.isFinite(startMs)) return null;
  const endMs = endsAt ? new Date(endsAt).getTime() : NaN;
  const last = Number.isFinite(endMs) && endMs > startMs ? endMs : startMs;
  return { opensAtMs: startMs - RUN_WINDOW_MS, closesAtMs: last + RUN_WINDOW_MS };
}

/**
 * Has the practice STARTED — the start time has passed (stage 1, D7: "How it went" appears once
 * it has). A different fact from the run window, which opens three hours early. Stage 6 (R3)
 * kept the start as the box's moment — the coach is the clock now, and a practice cut short must
 * not wait for a schedule that is already wrong — and answered "from when is it a record?" with
 * `practiceIsRecord` above, not by moving this.
 */
export function practiceStarted(startsAt: string | null | undefined, nowMs: number): boolean {
  if (!startsAt) return false;
  const ms = new Date(startsAt).getTime();
  return Number.isFinite(ms) && ms <= nowMs;
}

export function practicePlanState(
  e: Pick<RepTeamEvent, 'practicePlan' | 'startsAt'> & Partial<Pick<RepTeamEvent, 'endsAt'>>,
  nowMs: number,
): PracticePlanState {
  if (!practiceHasPlan(e)) return 'none';
  return isInRunWindow(e.startsAt, nowMs, e.endsAt) ? 'run' : 'planned';
}

/**
 * How the plan FITS the practice (D4): "3 blocks · 60 of 90 min · 1 rotation" when the practice
 * has an end time; "3 blocks · 60 min · 1 rotation" when it does not. The word "planned" is gone
 * from the hub's rows on purpose — the frame reads "60 min", and "of 90" says the same thing
 * better where an end exists. Other surfaces (the Schedule's panel, the closed-season shelf) keep
 * the plain "60 min planned" reading; they are not this room. ONE builder for both readings —
 * `summarizePracticePlan`'s `fit` option — so the two cannot drift.
 *
 * ⚠ A plan may OVERRUN its practice — "75 of 60 min" is honest and is the reason the line exists.
 * ⚠ With zero timed minutes (every block "rest of practice") the fit is unknowable, and the line
 * falls back to the count.
 */
export function practiceFitLabel(plan: PracticePlan, startsAt: string, endsAt: string | null): string {
  return summarizePracticePlan(plan, { length: practiceLengthMinutes(startsAt, endsAt) });
}

/**
 * The practice's length in whole minutes, or null when it has no end, a nonsensical one, or one so
 * close to the start that it rounds to nothing — "60 of 0 min" is not a fit (/review, 2026-09-14).
 */
export function practiceLengthMinutes(startsAt: string, endsAt: string | null): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60_000);
  return minutes > 0 ? minutes : null;
}

/**
 * The recap's FIRST LINE, for a past row (D3). "How it went" is free text a coach wrote after the
 * practice; the row shows its first non-empty line so looking back over a season stops being a
 * click per row. Null when there is nothing to show — the row renders no line rather than an
 * empty one.
 */
export function practiceRecapLine(recap: string | null | undefined): string | null {
  if (!recap) return null;
  const line = recap.split(/\r?\n/).map(l => l.trim()).find(Boolean);
  return line ?? null;
}

/**
 * How the plan FILLS the practice — the sheet's first line, under "when and how long" (practices
 * re-evaluation stage 1 · The blank page, owner ruling D3, 2026-09-14): "0 of 90 min planned ·
 * 90 unplanned" · "15 of 90 min planned · 75 unplanned" · "100 of 90 min planned · 10 over" ·
 * "90 of 90 min planned" · with no end, "15 min planned" / "Nothing planned yet".
 *
 * `planned` counts TIMED minutes only, exactly as `totalPlannedMinutes` and the hub's "60 of 90"
 * do — a "rest of practice" block is unbounded by definition and gets no invented figure. It is
 * reported as the remainder's own kind instead ("60 rest of practice"), so a plan that ends on a
 * rest block never reads as "60 unplanned" when those sixty minutes are spoken for.
 *
 * Pure: the page renders the amber on `remainder` itself.
 */
export type PracticePlanFit = {
  planned: number;
  length: number | null;
  remainder: { kind: 'unplanned' | 'over' | 'rest'; minutes: number } | null;
};

export function practicePlanFit(plan: PracticePlan, lengthMinutes: number | null): PracticePlanFit {
  const planned = totalPlannedMinutes(plan);
  const hasRest = plan.blocks.some(b => b.duration.restOfPractice);
  if (lengthMinutes == null) return { planned, length: null, remainder: null };
  const left = lengthMinutes - planned;
  if (left < 0) return { planned, length: lengthMinutes, remainder: { kind: 'over', minutes: -left } };
  if (left === 0) return { planned, length: lengthMinutes, remainder: null };
  return { planned, length: lengthMinutes, remainder: { kind: hasRest ? 'rest' : 'unplanned', minutes: left } };
}

/**
 * The first half of the line — "15 of 90 min planned" · "15 min planned" · "Nothing planned yet".
 * On a RECORD (stage 6, R2) the empty reading drops its "yet": a finished practice with nothing
 * planned is a fact, not a promise — "Nothing planned".
 */
export function practicePlannedLabel(fit: PracticePlanFit, opts: { record?: boolean } = {}): string {
  if (fit.length != null) return `${fit.planned} of ${fit.length} min planned`;
  return fit.planned > 0 ? `${fit.planned} min planned` : opts.record ? 'Nothing planned' : 'Nothing planned yet';
}

/** The second half — "90 unplanned" · "10 over" · "60 rest of practice" — or null when the plan fits. */
export function practiceRemainderLabel(fit: PracticePlanFit): string | null {
  if (!fit.remainder) return null;
  const { kind, minutes } = fit.remainder;
  return kind === 'over' ? `${minutes} over` : kind === 'rest' ? `${minutes} rest of practice` : `${minutes} unplanned`;
}
