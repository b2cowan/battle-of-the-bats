import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { gameHasStarted } from './coach-game-day';

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

/**
 * ⚠⚠ AWARDS AT ANY EVENT (owner, 2026-09-25). An award can be tied to ANY event on the schedule —
 * a practice, a team event (a banquet, a pizza night), a whole tournament — not only a game. It
 * was built as "player of the game", and every sentence and label below used to assume an
 * opponent: a practice award would have read "General" on the Awards report and "vs opponent" in
 * its edit form. Every surface that names an award's occasion reads these helpers, so the kinds
 * are spelled once. Plan: docs/projects/active/COACH_AWARDS_AT_ANY_EVENT_PLAN.md.
 */
export type AwardEventKind = 'game' | 'practice' | 'tournament' | 'event';

/** The kind an event's type reads as in an award's sentences. Anything unrecognised is an "event". */
export function awardEventKind(eventType: string | null | undefined): AwardEventKind {
  if (eventType && COACH_GAME_EVENT_TYPES.includes(eventType)) return 'game';
  if (eventType === 'practice') return 'practice';
  if (eventType === 'external_tournament') return 'tournament';
  return 'event';
}

/** An award type as a line reads it — "🏆 MVP", or the fallback when the type is missing. One
 *  spelling for the report's two tables, the award's sheet and the certificate. */
export function awardTypeLabel(type: { emoji?: string | null; name?: string } | null | undefined, fallback = 'Award'): string {
  return `${type?.emoji ? `${type.emoji} ` : ''}${type?.name ?? fallback}`;
}

/** The note field's example — a game's is a play; any other event's is effort. The Give window and
 *  the award's sheet both write the same note, so they suggest the same thing. */
export function awardNotePlaceholder(hasEvent: boolean, eventType?: string | null): string {
  return hasEvent && awardEventKind(eventType) !== 'game'
    ? 'e.g. Ran every drill at full speed'
    : 'e.g. Diving catch to end the game';
}

/** What an award reads an event by. Every event has a `name` — what the schedule shows it as. */
export interface AwardEventRef {
  eventType: string;
  name: string;
  opponent: string | null;
}

/**
 * What an award was FOR, as the Awards report's "For" column and the Give form's "For:" line
 * print it. A game reads by its opponent ("vs Oakville A's"); every other event by its own name
 * ("Practice", "Batting cages", "Team pizza night", the tournament's name) — the name the coach
 * gave it, so a practice they called "Batting cages" is never flattened to "Practice". An award
 * tied to no event reads its typed label, or "General".
 */
export function awardOccasionLabel(event: AwardEventRef | null, tournamentLabel: string | null): string {
  if (event) {
    if (awardEventKind(event.eventType) === 'game') {
      return event.opponent ? `vs ${event.opponent}` : event.name;
    }
    return event.name;
  }
  return tournamentLabel || 'General';
}

/**
 * The occasion clause for a refusal sentence — "for this game" / "for this practice" / "for this
 * tournament" / "for this event" / "for the Milton Classic" / "already". `eventType` is the linked
 * event's type; a caller without it (it should always have it) falls back to "this event", never
 * to "this game" — the one wrong answer.
 */
export function describeAwardOccasion(o: AwardOccasion, eventType?: string | null): string {
  if (o.eventId) return `for this ${awardEventKind(eventType)}`;
  if (o.tournamentLabel) return `for ${o.tournamentLabel}`;
  return 'already';
}

/**
 * The same clause with the date written in, for a sentence read away from the event itself — the
 * award-type merge's preview ("Ariella Esmail would hold MVP twice for the Sep 21 practice").
 * A game and a practice read by date (there are many of each); a tournament and a team event by
 * name. `event` null with an `eventId` set (an event the read could not resolve) reads by date.
 */
export function describeDatedAwardOccasion(
  o: { eventId: string | null; tournamentLabel: string | null },
  event: Pick<AwardEventRef, 'eventType' | 'name'> | null,
  shortDate: string,
): string {
  if (o.eventId) {
    const kind = awardEventKind(event?.eventType);
    if (event && (kind === 'tournament' || kind === 'event')) return `for ${event.name}`;
    return `for the ${shortDate} ${event ? kind : 'event'}`;
  }
  if (o.tournamentLabel) return `for ${o.tournamentLabel}`;
  return `for ${shortDate}`;
}

/**
 * Whether an event can carry an award yet — the ONE rule behind the schedule window's Awards
 * section and the give route's refusal (owner rulings R1 + R2, 2026-09-25):
 *   · a cancelled event never can;
 *   · a GAME once its final score is in — unchanged since awards shipped ("can't award a game
 *     that hasn't been played");
 *   · ANY OTHER event once it has STARTED — its start time is how it proves it happened. Before
 *     that the window shows nothing at all (the anti-clutter rule: no box explaining an absence
 *     on every upcoming practice). Recording a banquet's awards days ahead stays on the Awards
 *     report, as a general award.
 * The start-time clock is `gameHasStarted` — the same one the phone sheet and the lineup's Ready
 * rule use; `startsAt` is a timestamptz, so the server and the browser agree on the instant.
 */
export type AwardUnlockState = 'open' | 'cancelled' | 'needs-score' | 'not-started';

export function awardUnlockState(
  event: { eventType: string; status: string; startsAt: string; teamScore: number | null; opponentScore: number | null },
  nowMs: number,
): AwardUnlockState {
  if (event.status === 'cancelled') return 'cancelled';
  if (awardEventKind(event.eventType) === 'game') {
    return event.teamScore == null || event.opponentScore == null ? 'needs-score' : 'open';
  }
  return gameHasStarted(event, nowMs) ? 'open' : 'not-started';
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
