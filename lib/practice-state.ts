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
 * would let one screen offer the field door while another still says "plan it".
 *
 * ⚠ Nothing here records what HAPPENED. `run` means "the window is open and there is a plan to
 * run", never "the practice was run" — "planned, never done" (`lib/rep-practice-plan.ts` rule 2).
 */
import { summarizePracticePlan } from './rep-practice-plan';
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

export function isInRunWindow(startsAt: string, nowMs: number): boolean {
  return Math.abs(new Date(startsAt).getTime() - nowMs) <= RUN_WINDOW_MS;
}

export function practicePlanState(e: Pick<RepTeamEvent, 'practicePlan' | 'startsAt'>, nowMs: number): PracticePlanState {
  if (!practiceHasPlan(e)) return 'none';
  return isInRunWindow(e.startsAt, nowMs) ? 'run' : 'planned';
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
