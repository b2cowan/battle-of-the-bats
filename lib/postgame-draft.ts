/**
 * lib/postgame-draft.ts — the family email a coach did not have to write.
 *
 * Chunk D slice 3, item 3.1. The coach saves a final score; this turns that one fact plus
 * the next thing on the calendar into a subject and a body, which the coach then EDITS AND
 * SENDS themselves. Nothing here sends anything (owner ruling D-E9: no auto-send to a family,
 * ever), and skipping the draft must leave no hole — families are never told a recap exists,
 * so one that is never written is not one that is missing.
 *
 * Pure and unit-tested on purpose: this is the one place in the chunk that puts WORDS in a
 * coach's mouth, so the words belong somewhere they can be read, reviewed and changed without
 * opening a 3,000-line page.
 *
 * Not `server-only` — the schedule page (a client component) builds the draft and carries it
 * to the compose screen. Every date passes through the org-timezone formatter; no raw UTC
 * date arithmetic (the repo's standing date rule).
 */

import { opponentPhrase, scheduleDayLabel, scheduleTimeLabel } from './family-schedule-format';

export interface PostgameDraftGame {
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  teamScore: number;
  opponentScore: number;
}

/** The next thing on the calendar after the game, or null when the season is over. */
export interface PostgameDraftNextEvent {
  /** 'practice' reads as "Practice"; anything else reads as a game/event line. */
  eventType: string;
  name: string;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  startsAt: string;
  location: string | null;
  fieldNumber: string | null;
}

export interface PostgameDraft {
  subject: string;
  body: string;
}

function resultOf(teamScore: number, opponentScore: number): 'win' | 'loss' | 'tie' {
  if (teamScore > opponentScore) return 'win';
  if (teamScore < opponentScore) return 'loss';
  return 'tie';
}

/**
 * How the next event reads: "Sun, Aug 9 at 2:00 p.m. — vs Thunder, Central Fields (Diamond 1)".
 * Every part is omitted when the coach never entered it, rather than rendered blank.
 */
export function nextEventLine(next: PostgameDraftNextEvent): string {
  // Same day/time labels the family's own schedule rows carry, so the email and the list a
  // parent opens next never disagree about when the thing is.
  const when = `${scheduleDayLabel(next.startsAt)} at ${scheduleTimeLabel(next.startsAt)}`;

  const what = next.eventType === 'practice'
    ? 'Practice'
    : next.opponent
      ? opponentPhrase(next.opponent, next.homeAway)
      : (next.name || 'Team event');

  const wherePlace = next.location?.trim() || '';
  const whereField = next.fieldNumber?.trim() || '';
  const where = wherePlace && whereField
    ? `${wherePlace} (${whereField})`
    : wherePlace || whereField;

  return [`${when} — ${what}`, where].filter(Boolean).join(', ');
}

/**
 * Build the draft.
 *
 * The one sentence of sentiment is result-aware, because a canned "great effort" under a
 * 1–9 loss is the kind of thing a parent forwards to another parent. It is still the coach's
 * to delete — the compose screen says so — but the default should never read as tone-deaf.
 */
export function buildPostgameDraft(params: {
  teamName: string;
  game: PostgameDraftGame;
  nextEvent: PostgameDraftNextEvent | null;
}): PostgameDraft {
  const { teamName, game, nextEvent } = params;
  const opponent = game.opponent?.trim() || 'our opponent';
  const result = resultOf(game.teamScore, game.opponentScore);

  const subject = `${teamName} ${game.teamScore}–${game.opponentScore} ${opponentPhrase(opponent, game.homeAway)}`;

  const sentiment = result === 'win'
    ? 'Great effort from the whole team today.'
    : result === 'tie'
      ? 'A hard-fought one — good effort from the whole team.'
      : 'A tough result, but a good effort from the whole team.';

  const lines = [
    `Final: ${teamName} ${game.teamScore}, ${opponent} ${game.opponentScore}.`,
    '',
    sentiment,
  ];

  // No next event = no "Next up" line. An empty promise ("Next up: TBD") is worse than
  // silence, and a season that has ended should simply not claim there is more.
  if (nextEvent) {
    lines.push('', `Next up: ${nextEventLine(nextEvent)}.`);
  }

  return { subject, body: lines.join('\n') };
}

/** Query keys the compose screen reads. Named here so the two ends cannot drift apart. */
export const DRAFT_SUBJECT_PARAM = 'draftSubject';
export const DRAFT_BODY_PARAM = 'draftBody';

/** The compose-screen URL carrying a prefilled draft. */
export function postgameDraftHref(base: string, draft: PostgameDraft): string {
  const q = new URLSearchParams({
    [DRAFT_SUBJECT_PARAM]: draft.subject,
    [DRAFT_BODY_PARAM]: draft.body,
  });
  return `${base}/announcements?${q.toString()}`;
}
