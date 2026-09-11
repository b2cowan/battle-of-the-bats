/**
 * R5 (owner, 2026-09-11): a player holds a given award ONCE PER OCCASION. This is the pure
 * definition of "same occasion" both award routes refuse a collision against — the give/edit
 * routes ask `findRepPlayerAwardCollision` (a DB query implementing this same rule) before
 * writing, and both build their refusal sentence from `describeAwardOccasion`. Kept here, pure
 * and tested directly, so the RULE has one stated definition even though its two homes (a SQL
 * filter, a message builder) can't literally be the same function call.
 */
export interface AwardOccasion {
  eventId: string | null;
  tournamentLabel: string | null;
  awardedAt: string;
}

/**
 * Two awards are for the SAME occasion when both point at the same game, or — with no game —
 * the same date and the same free-text label. A game-linked award never collides with a general
 * one even on the same date; `eventId` alone decides which branch applies.
 */
export function sameAwardOccasion(a: AwardOccasion, b: AwardOccasion): boolean {
  if (a.eventId || b.eventId) return a.eventId === b.eventId;
  return a.awardedAt === b.awardedAt && (a.tournamentLabel || null) === (b.tournamentLabel || null);
}

/** The occasion clause for a refusal sentence — "for this game" / "for the Milton Classic" / "already". */
export function describeAwardOccasion(o: AwardOccasion): string {
  if (o.eventId) return 'for this game';
  if (o.tournamentLabel) return `for ${o.tournamentLabel}`;
  return 'already';
}

export interface AwardTypeMergeAward extends AwardOccasion {
  id: string;
  playerId: string;
}

export interface AwardTypeMergeCollision {
  loserAwardId: string;
  winnerAwardId: string;
}

/**
 * The award-type merge's collision rule (R5, Awards Join the One Tag Idiom Part B): a loser
 * award collides with a winner award of the SAME (player, occasion) — the pairing
 * `merge_rep_team_award_types` (migration 289) collapses in SQL and the merge-confirm preview
 * (`previewMergeRepTeamAwardTypes` in lib/db.ts) reads before the tap. Kept here, pure, so the
 * two homes state the pairing rule identically even though they can't share one function call —
 * at most one collision per loser award, since the R5 unique indexes already forbid two awards of
 * the SAME type on the same (player, occasion).
 */
export function resolveAwardTypeMergeCollisions(
  loserAwards: readonly AwardTypeMergeAward[],
  winnerAwards: readonly AwardTypeMergeAward[],
): AwardTypeMergeCollision[] {
  const collisions: AwardTypeMergeCollision[] = [];
  for (const loser of loserAwards) {
    const winner = winnerAwards.find(w => w.playerId === loser.playerId && sameAwardOccasion(loser, w));
    if (winner) collisions.push({ loserAwardId: loser.id, winnerAwardId: winner.id });
  }
  return collisions;
}
