/**
 * A goal's HISTORY as dated events (development lifecycle Phase 2, plan §7 Goal review; F08 — "a
 * goal is a current state, not a history"): set → observed → reviewed, each with its date and its
 * author, newest first, nothing overwritten.
 *
 * Pure module — the profile's Goals view draws the timeline from here; Phase 3's goal-review
 * report reads the same events. The ORIGIN is said only from the record (`origin` on the goal,
 * mig 295): a goal written before it has none, and the product says nothing rather than guess.
 *
 * ⚠ ONE MODULE, TWO READERS (re-evaluation stage 3, owner ruling E4, 2026-09-15): the player's
 * record and Insights → Player progress both draw a goal's history from here, so a wordless
 * status change reads the same on both — one quiet `status` line, and several on one day folded
 * into one event. The GROUPING is shared; only the player's own tab discloses the folded rows
 * ("show ›") — Player progress prints the line and its Open → door. The rule lives here and
 * nowhere else; a reader that re-derived it would be the second counting rule stage 2 spent a
 * session removing.
 */
import { addCalendarDays, daysBetweenDateStrings } from './timezone';
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

/**
 * A review with no words is a STATUS CHANGE — the pill's pick (or a sheet saved with the status
 * alone). It is still a dated review on the record (append-only, never overwritten); it just reads
 * as what it is. `nextReviewOn` does not make it a review: the sheet may pre-fill one (E5).
 */
export const isStatusOnlyReview = (r: Pick<RepDevelopmentGoalReview, 'note'>): boolean => !r.note?.trim();

export interface GoalStatusChange {
  reviewId: string;
  status: RepDevelopmentGoalStatus;
  /** When it was entered — the tie-break within the day. */
  at: string;
  by: string | null;
  nextReviewOn: string | null;
}

export interface GoalEvent {
  /** `status` = one or more wordless reviews on one day, read as one quiet line (E4). */
  kind: 'set' | 'observation' | 'review' | 'status';
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
  /** The observation's session, when it was taken in one — the row's "in a session ›" door. */
  sessionId?: string | null;
  status?: RepDevelopmentGoalStatus;
  nextReviewOn?: string | null;
  evidenceMeasurableIds?: string[];
  evidenceObservationIds?: string[];
  /** A `status` event's rows, newest first — one for a single change, several for a folded day. */
  changes?: GoalStatusChange[];
}

/**
 * The events for ONE goal, newest first: every review (all of them — a review never overwrites
 * the last), every observation linked as evidence for it, and the "set" event from the goal's own
 * creation. `reviews` and `observations` may be the player's whole lists; they are filtered here.
 * A wordless review is a `status` event, and the wordless reviews of one day are ONE event.
 */
export function goalTimeline(
  goal: { id: string; createdAt: string; createdBy: string | null; origin: RepDevelopmentGoalOrigin | null },
  reviews: RepDevelopmentGoalReview[],
  observations: RepPlayerObservation[],
): GoalEvent[] {
  const events: GoalEvent[] = [];
  const statusDays = new Map<string, GoalStatusChange[]>();
  for (const r of reviews) {
    if (r.goalId !== goal.id) continue;
    if (isStatusOnlyReview(r)) {
      const list = statusDays.get(r.reviewedOn) ?? [];
      list.push({ reviewId: r.id, status: r.status, at: r.createdAt, by: r.createdBy, nextReviewOn: r.nextReviewOn });
      statusDays.set(r.reviewedOn, list);
      continue;
    }
    events.push({
      kind: 'review', on: r.reviewedOn, at: r.createdAt, by: r.createdBy,
      title: `Reviewed · ${GOAL_STATUS_LABELS[r.status]}`, text: r.note,
      reviewId: r.id, status: r.status, nextReviewOn: r.nextReviewOn,
      evidenceMeasurableIds: r.evidenceMeasurableIds, evidenceObservationIds: r.evidenceObservationIds,
    });
  }
  for (const [on, list] of statusDays) {
    const changes = [...list].sort((a, b) => b.at.localeCompare(a.at));
    const newest = changes[0];
    events.push({
      kind: 'status', on, at: newest.at, by: newest.by,
      // One change reads its destination; a day of several says how many and opens to the rows.
      title: changes.length === 1 ? `Status → ${GOAL_STATUS_LABELS[newest.status]}` : `Status changed ${changes.length} times`,
      text: null, status: newest.status, nextReviewOn: changes.length === 1 ? newest.nextReviewOn : null,
      reviewId: newest.reviewId, changes,
    });
  }
  for (const o of observations) {
    if (o.goalId !== goal.id) continue;
    events.push({
      kind: 'observation', on: o.observedOn, at: o.createdAt, by: o.createdBy,
      title: o.descriptor ? `Observed · ${o.descriptor}` : 'Observed', text: o.note, observationId: o.id, sessionId: o.sessionId,
    });
  }
  events.push({
    kind: 'set', on: goal.createdAt.slice(0, 10), at: goal.createdAt, by: goal.createdBy,
    title: originSentence(goal.origin) ?? 'Goal set', text: null,
  });
  return events.sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));
}

// ── The next review, on the goal's own cadence (re-evaluation stage 3, owner ruling E5) ──────────

/**
 * What the review sheet offers as the next review: `today` plus the gap the goal's LAST review set
 * between its own date and the next it named (10 Jun → 24 Jun is fourteen days, so a review on
 * 15 Sept offers 29 Sept). Never a date already past — it is built from today. Null (the field
 * starts blank) when the goal has no review yet, when its last review named no next date, or when
 * the gap is not a forward one.
 *
 * "Last review" is the last SITTING-DOWN review — one with words or a next date. A wordless status
 * pick from the pill is a status line, not a review (E4), so a pick after a real review does not
 * erase the cadence the review set. A build call, recorded in plan §20.
 */
export function nextReviewSuggestion(
  goal: { id: string },
  reviews: readonly RepDevelopmentGoalReview[],
  today: string,
): string | null {
  const last = reviews
    .filter(r => r.goalId === goal.id && (!isStatusOnlyReview(r) || r.nextReviewOn))
    .sort((a, b) => b.reviewedOn.localeCompare(a.reviewedOn) || b.createdAt.localeCompare(a.createdAt))[0];
  if (!last?.nextReviewOn) return null;
  const gapDays = daysBetweenDateStrings(last.reviewedOn, last.nextReviewOn);
  if (gapDays <= 0) return null;
  return addCalendarDays(today, gapDays);
}

/** "Two weeks on" · "Ten days on" · "A month on" — the gap a suggestion was built from, in words. */
export function reviewGapWords(from: string, to: string): string | null {
  const days = daysBetweenDateStrings(from, to);
  if (days <= 0) return null;
  if (days % 7 === 0) { const w = days / 7; return w === 1 ? 'A week on' : w === 2 ? 'Two weeks on' : `${w} weeks on`; }
  if (days === 30 || days === 31) return 'A month on';
  return `${days} days on`;
}
