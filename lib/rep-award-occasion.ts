import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { gameHasStarted } from './coach-game-day';
import { daysBetweenDateStrings, formatStoredDate, orgDayKey } from './timezone';

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

// ── Which game an award is for (owner, 2026-10-02 — all four rulings as recommended) ────────────
// From the Awards page the Give window used to take only typed words, so an award for last night's
// game was tied to no game and dated the day it was given — and the same MVP given again from the
// game was a second occasion the once-per-occasion rule could not see (production, 2026-10-01: one
// player read 2× MVP for one game). The window now asks WHICH event, and says a near-duplicate
// before Save. Plan: docs/projects/active/COACH_AWARD_OCCASION_PLAN.md.

/** What the Give window's "For" dropdown needs from a schedule event. */
export interface AwardForEvent extends AwardEventRef {
  id: string;
  status: string;
  startsAt: string;
  teamScore: number | null;
  opponentScore: number | null;
}

export interface AwardForOption {
  eventId: string;
  /** `awardOccasionLabel` — what the award will say it was for. */
  label: string;
  /** The event's org-zone day, YYYY-MM-DD — the award's date when it is tied to this event. */
  day: string;
  kind: AwardEventKind;
  /** The event's type — the note's grey example reads it (`awardNotePlaceholder`). */
  eventType: string;
  /** `open` can be chosen; `needs-score` is a game that has happened but has no score (ruling 3). */
  state: 'open' | 'needs-score';
  teamScore: number | null;
  opponentScore: number | null;
}

/**
 * The "For" dropdown's events: what has HAPPENED, newest first. A game appears once it has started
 * (scored → choosable; unscored → listed with its reason, ruling 3); any other event once it has
 * started; a cancelled event or one still to come never appears. The unlock rule is the same
 * `awardUnlockState` the server refuses by, so the list can never offer what Save would refuse.
 */
export function awardForOptions(events: readonly AwardForEvent[], nowMs: number): AwardForOption[] {
  const out: AwardForOption[] = [];
  // Newest by START TIME, not by day: a doubleheader or a practice-then-game day holds two events on
  // one day, and the window opens on the first choosable one — sorted by day alone, a tie fell to
  // the ids and could open on the earlier game (/review 2026-10-02).
  const newestFirst = [...events].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt) || b.id.localeCompare(a.id));
  for (const e of newestFirst) {
    if (!gameHasStarted(e, nowMs)) continue;
    const unlock = awardUnlockState({ eventType: e.eventType, status: e.status, startsAt: e.startsAt, teamScore: e.teamScore, opponentScore: e.opponentScore }, nowMs);
    if (unlock !== 'open' && unlock !== 'needs-score') continue;
    out.push({
      eventId: e.id,
      label: awardOccasionLabel(e, null),
      day: orgDayKey(e.startsAt),
      kind: awardEventKind(e.eventType),
      eventType: e.eventType,
      state: unlock,
      teamScore: e.teamScore,
      opponentScore: e.opponentScore,
    });
  }
  return out;
}

/** The dropdown's choices that are not one event, and its other words — one home. */
export const AWARD_FOR_WORDS = {
  somethingElse: 'Something else',
  somethingElseSub: 'A tournament or occasion not on your schedule',
  season: 'The season',
  seasonSub: 'Not about one event',
  needsScore: 'enter its score first',
  earlier: 'Earlier in the season',
  otherGroup: 'Other',
  loading: 'Loading your schedule…',
  occasionPlaceholder: 'e.g. Milton Slo-Pitch Classic',
  futureDate: 'An award’s date can’t be in the future.',
} as const;

/** "Wed Sep 30 · W 14–3" — an option's second line: its day, and a scored game's result. */
export function awardForSubline(o: Pick<AwardForOption, 'day' | 'kind' | 'state' | 'teamScore' | 'opponentScore'>): string {
  const [y, m, d] = o.day.split('-').map(Number);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const when = `${weekday} ${formatStoredDate(o.day, { withYear: false })}`;
  if (o.kind !== 'game') return when;
  if (o.state === 'needs-score') return `${when} · ${AWARD_FOR_WORDS.needsScore}`;
  const t = o.teamScore ?? 0, u = o.opponentScore ?? 0;
  return `${when} · ${t > u ? 'W' : t < u ? 'L' : 'T'} ${t}–${u}`;
}

/** How near is "near" (ruling 4): the same award to the same player within two days either side. */
export const NEAR_DUPLICATE_DAYS = 2;

export interface NearDuplicateAward {
  id: string;
  playerId: string;
  awardTypeId: string;
  awardedAt: string;
  createdAt: string;
}

/**
 * The award this one would sit beside: same player, same award type, an occasion within
 * `NEAR_DUPLICATE_DAYS` of `day`, excluding the award being edited. The nearest wins (then the most
 * recently given). The exact same game is still REFUSED at Save (`sameAwardOccasion`); this only
 * SAYS — a tournament weekend's two honest MVPs still save.
 */
export function nearDuplicateAward<T extends NearDuplicateAward>(
  awards: readonly T[],
  q: { playerId: string; awardTypeId: string; day: string; excludeId?: string | null },
): T | null {
  // A day still being typed (the Date box cleared to '') is no day: `daysBetweenDateStrings` reads an
  // unparseable date as 0 days apart, which would flag every award the player holds (/review 2026-10-02).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.day)) return null;
  let best: { a: T; gap: number } | null = null;
  for (const a of awards) {
    if (a.id === q.excludeId || a.playerId !== q.playerId || a.awardTypeId !== q.awardTypeId) continue;
    const gap = Math.abs(daysBetweenDateStrings(a.awardedAt, q.day));
    if (gap > NEAR_DUPLICATE_DAYS) continue;
    if (!best || gap < best.gap || (gap === best.gap && a.createdAt > best.a.createdAt)) best = { a, gap };
  }
  return best ? best.a : null;
}

/**
 * The double-check's words: "Alex Tennant already has 🏆 MVP for “Majors game MVP”, Oct 1." A
 * game or event reads by its label, a typed occasion in quotes (it is the coach's own words), a
 * season award as "for the season".
 */
export function nearDuplicateSentence(
  playerName: string,
  award: { eventId: string | null; tournamentLabel: string | null; awardedAt: string; occasionLabel?: string; awardType?: { name: string; emoji?: string | null } | null },
): { line: string; hint: string } {
  const type = award.awardType ? `${award.awardType.emoji ? `${award.awardType.emoji} ` : ''}${award.awardType.name}` : 'this award';
  const what = award.eventId
    ? `for ${award.occasionLabel ?? 'that event'}`
    : award.tournamentLabel ? `for “${award.tournamentLabel}”` : 'for the season';
  return {
    line: `${playerName} already has ${type} ${what}, ${formatStoredDate(award.awardedAt, { withYear: false })}.`,
    hint: 'If it’s the same award, close this and remove that one from the Awards page.',
  };
}
