import { daysBetweenDateStrings, formatInOrgZone, orgDayKey } from './timezone';
import { possessive } from './utils';

/**
 * EVERY WORD "Families say if they're coming" shows (Signed-in family accounts Stage 4b; drawing
 * SIGNED_IN_FAMILY_STAGE4B_DRAWINGS.html). One file so /marketing and /legal read the feature in one place (the
 * lib/league-second-parent.ts precedent). The parent's side is Part 3 (tab 7); the coach's side, the reminder and the bell join
 * this file in their Parts.
 *
 * Not `server-only`: the family page's client component reads it. Nothing here reads data.
 */

export type FamilyAnswer = 'in' | 'out' | 'maybe';

/** The one-line note's cap (ask 5's "one short line", app-enforced; the database CHECK holds the same 200). */
export const FAMILY_ANSWER_NOTE_MAX = 200;

/** The words a person's name falls back to when their account holds no first name (O2: never an address). */
const OTHER_PARENT = 'the other parent';

/** "on Tuesday" within the last week (the org's days); "on Apr 20" before that. Never the clock time (ask 6). */
export function answeredDayWords(answeredAtIso: string, now: Date = new Date()): string {
  const today = orgDayKey(now.toISOString());
  const day = orgDayKey(answeredAtIso);
  if (day === today) return 'today';
  const days = daysBetweenDateStrings(day, today);
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return `on ${formatInOrgZone(answeredAtIso, { weekday: 'long' })}`;
  return `on ${formatInOrgZone(answeredAtIso, { month: 'short', day: 'numeric' })}`;
}

const ANSWER_WORD: Record<FamilyAnswer, string> = { in: 'In', out: 'Out', maybe: 'Maybe' };

export const FAMILY_AVAILABILITY_WORDS = {
  answer: ANSWER_WORD,
  /** The schedule row's pill (tab 7). */
  pill: {
    in: 'In ✓',
    out: 'Out',
    maybe: 'Maybe',
    ask: 'Answer',
    closedNone: 'No answer',
  },
  /** The pill's accessible name: what tapping it does. */
  pillLabel: (child: string, eventTitle: string, answer: FamilyAnswer | null) =>
    answer ? `${child}: ${ANSWER_WORD[answer]} for ${eventTitle}. Change the answer` : `Answer for ${child}: ${eventTitle}`,
  sheet: {
    close: 'Close',
    noteLabel: 'Your note for the coach',
    notePlaceholder: 'Your note for the coach (e.g. leaving early)',
    saveNote: 'Save note',
    saving: 'Saving…',
    saved: 'Saved',
    failed: 'That didn’t save. Try again in a moment.',
    closed: 'Answers have closed for this one.',
    tapHint: 'A tap saves. Tap your answer again to clear it.',
    /** /legal's hint (tab 7). The other-parent sentence only when another parent is connected. */
    privacy: (child: string, otherParent: string | null) =>
      [
        'Your team’s coaches see your answer and note.',
        otherParent ? `${otherParent === OTHER_PARENT ? 'The other parent' : `${otherParent}, ${possessive(child)} other parent,`} sees the answer but not your note.` : null,
        'Other families see neither.',
        'Please don’t put health details here; tell the coach directly.',
      ].filter(Boolean).join(' '),
    /** "Priya answered Out on Tuesday and left a note for the coach." (the other parent's answer; never the note's words). */
    otherAnswered: (who: string | null, answer: FamilyAnswer, dayWords: string, hasNote: boolean) =>
      `${who ? who : 'The other parent'} answered ${ANSWER_WORD[answer]} ${dayWords}${hasNote ? ' and left a note for the coach' : ''}.`,
    /** Your own earlier answer. */
    youAnswered: (answer: FamilyAnswer, dayWords: string) => `You answered ${ANSWER_WORD[answer]} ${dayWords}.`,
  },
  /** A started event (tab 7): the answer shows muted and cannot change. */
  started: (isGame: boolean) =>
    `Answers closed when the ${isGame ? 'game' : 'practice'} started. To tell the coach something now, tell them directly.`,
  /** Arriving from a reminder (tab 7): only while the event is open and the named child is unanswered. */
  coachAsked: (children: readonly string[]) =>
    `The coach asked whether ${children.length > 1 ? `${children.slice(0, -1).join(', ')} and ${children[children.length - 1]} are` : `${children[0]} is`} coming.`,
  otherParentFallback: OTHER_PARENT,
} as const;
