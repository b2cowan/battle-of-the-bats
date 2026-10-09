/**
 * When a schedule publish schedules the game-day reminder email (Tournament admin redesign, Stage 3 defects pass
 * A45 — F73, 2026-10-09).
 *
 * The Publish window used to promise the reminder on every publish ("sent even if the box above is left
 * unchecked"). The publish route schedules it only after both of its early returns — Notify unticked, and a plan
 * without `schedule_notification` — and then only while the event's game-day reminder setting is on. This is that
 * rule, built from the same two checks the route makes (`hasPlanFeature`, `coachEmailEnabled`), so the window's
 * sentence shows exactly when the reminder will be scheduled. Whether every publish SHOULD schedule it is a
 * packaging question recorded for `/strategy` (A46), not this function's to change.
 */
import { hasPlanFeature } from './plan-features.ts';
import { coachEmailEnabled } from './coach-email-rules.ts';
import type { OrgPlan } from './types';

export function willScheduleGameDayReminder(params: {
  notify: boolean;
  planId: OrgPlan | null | undefined;
  /** The tournament's settings (the reminder setting lives there). */
  settings: unknown;
}): boolean {
  if (!params.notify || !params.planId) return false;
  if (!hasPlanFeature(params.planId, 'schedule_notification')) return false;
  return coachEmailEnabled(params.settings, 'game_day');
}
