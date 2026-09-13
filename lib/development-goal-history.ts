/**
 * A goal's HISTORY as dated events (development lifecycle Phase 2, plan §7 Goal review; F08 — "a
 * goal is a current state, not a history"): set → observed → reviewed, each with its date and its
 * author, newest first, nothing overwritten.
 *
 * Pure module — the profile's Goals view draws the timeline from here; Phase 3's goal-review
 * report reads the same events. The ORIGIN is said only from the record (`origin` on the goal,
 * mig 295): a goal written before it has none, and the product says nothing rather than guess.
 */
import type { RepDevelopmentGoalOrigin, RepDevelopmentGoalReview, RepDevelopmentGoalStatus, RepPlayerObservation } from './types';

export const GOAL_STATUS_LABELS: Readonly<Record<RepDevelopmentGoalStatus, string>> = {
  working: 'Working on it',
  achieved: 'Achieved',
  parked: 'Parked',
};

/** "Set with the player" · "Carried from a previous season" · "Seeded from the tryout" — or nothing. */
export function originSentence(origin: RepDevelopmentGoalOrigin | null | undefined): string | null {
  switch (origin) {
    case 'coach': return 'Set with the player';
    case 'carried': return 'Carried from a previous season';
    case 'tryout': return 'Seeded from the tryout';
    default: return null;
  }
}

export interface GoalEvent {
  kind: 'set' | 'observation' | 'review';
  /** YYYY-MM-DD */
  on: string;
  /** Tie-break for same-day events: when it was entered. */
  at: string;
  by: string | null;
  title: string;
  text: string | null;
  /** The record behind the event, for an "Open →" link. */
  reviewId?: string;
  observationId?: string;
  status?: RepDevelopmentGoalStatus;
  nextReviewOn?: string | null;
  evidenceMeasurableIds?: string[];
  evidenceObservationIds?: string[];
}

/**
 * The events for ONE goal, newest first: every review (all of them — a review never overwrites
 * the last), every observation linked as evidence for it, and the "set" event from the goal's own
 * creation. `reviews` and `observations` may be the player's whole lists; they are filtered here.
 */
export function goalTimeline(
  goal: { id: string; createdAt: string; createdBy: string | null; origin: RepDevelopmentGoalOrigin | null },
  reviews: RepDevelopmentGoalReview[],
  observations: RepPlayerObservation[],
): GoalEvent[] {
  const events: GoalEvent[] = [];
  for (const r of reviews) {
    if (r.goalId !== goal.id) continue;
    events.push({
      kind: 'review', on: r.reviewedOn, at: r.createdAt, by: r.createdBy,
      title: `Reviewed · ${GOAL_STATUS_LABELS[r.status]}`, text: r.note,
      reviewId: r.id, status: r.status, nextReviewOn: r.nextReviewOn,
      evidenceMeasurableIds: r.evidenceMeasurableIds, evidenceObservationIds: r.evidenceObservationIds,
    });
  }
  for (const o of observations) {
    if (o.goalId !== goal.id) continue;
    events.push({
      kind: 'observation', on: o.observedOn, at: o.createdAt, by: o.createdBy,
      title: o.descriptor ? `Observed · ${o.descriptor}` : 'Observed', text: o.note, observationId: o.id,
    });
  }
  events.push({
    kind: 'set', on: goal.createdAt.slice(0, 10), at: goal.createdAt, by: goal.createdBy,
    title: originSentence(goal.origin) ?? 'Goal set', text: null,
  });
  return events.sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));
}
