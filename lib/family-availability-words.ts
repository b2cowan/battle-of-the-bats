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

/** Where an answer's day falls against today, in the org's days. Both day wordings read it, so they cannot drift apart. */
function answeredDayKind(answeredAtIso: string, now: Date): 'today' | 'yesterday' | 'week' | 'date' {
  const today = orgDayKey(now.toISOString());
  const day = orgDayKey(answeredAtIso);
  if (day === today) return 'today';
  const days = daysBetweenDateStrings(day, today);
  if (days === 1) return 'yesterday';
  return days > 1 && days < 7 ? 'week' : 'date';
}

/** "on Tuesday" within the last week (the org's days); "on Apr 20" before that. Never the clock time (ask 6). */
export function answeredDayWords(answeredAtIso: string, now: Date = new Date()): string {
  const kind = answeredDayKind(answeredAtIso, now);
  if (kind === 'today' || kind === 'yesterday') return kind;
  return `on ${formatInOrgZone(answeredAtIso, kind === 'week' ? { weekday: 'long' } : { month: 'short', day: 'numeric' })}`;
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

// ── The coach's side (Session 2, Parts 4–5; drawing tabs 1–3) ────────────────────────────────────────────────────────────────

/** A person on the coach's side whose account holds no first name (O2: never an address). */
const A_PARENT = 'a parent';

/** The coach reads "Priya, Tue": the day only, short (ask 6). "today" for today; a weekday within the week; "Apr 2" before. */
export function answeredDayShort(answeredAtIso: string, now: Date = new Date()): string {
  const kind = answeredDayKind(answeredAtIso, now);
  if (kind === 'today') return kind;
  return formatInOrgZone(answeredAtIso, kind === 'date' ? { month: 'short', day: 'numeric' } : { weekday: 'short' });
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** One family answer as the coach reads it: the answer, the note's words, who and the day, and what it was before. */
export interface CoachFamilyLine {
  answer: FamilyAnswer;
  note: string | null;
  /** The answering parent's first name, or null (the words say "a parent"). */
  by: string | null;
  day: string;
  previous: { answer: FamilyAnswer; by: string | null; day: string } | null;
}

const quoted = (note: string | null) => (note ? ` · “${note}”` : '');
const whoDay = (by: string | null, day: string) => `${by ?? A_PARENT}, ${day}`;
const earlier = (p: CoachFamilyLine['previous']) => (p ? ` · earlier: ${ANSWER_WORD[p.answer]} (${whoDay(p.by, p.day)})` : '');

export const FAMILY_AVAILABILITY_COACH_WORDS = {
  /** Team settings → Sharing (tab 3). */
  setting: {
    label: 'Families say if they’re coming',
    groupLabel: 'Which events families answer',
    choice: { off: 'Off', games: 'Games', games_and_practices: 'Games and practices' } as const,
    off: 'Off: families don’t see In / Out / Maybe. Attendance works as it does today.',
    on: (setting: 'games' | 'games_and_practices', connected: number, roster: number) =>
      `Parents in the app can answer In, Out or Maybe for every upcoming ${setting === 'games' ? 'game' : 'game and practice'}. ` +
      'You see their answers in Attendance; your own marks stay yours. ' +
      `${connected} of ${roster} ${plural(roster, 'player has', 'players have')} a parent in the app.`,
    turnedOff: 'Families stop seeing In / Out / Maybe and you stop seeing their answers. Your marks stay. If you turn it on again this season, the answers come back.',
    nobodyYet: 'No parent is in the app yet. Answers appear once you invite parents from each player’s Guardians on the Roster.',
    staffOnly: 'Families can’t see the schedule, so they can’t answer. Set Schedule visibility to Families or Public first.',
    readOnly: (choice: string) => `${choice} — only coaches who manage the schedule can change it.`,
    failed: 'That didn’t save. Try again in a moment.',
  },
  /** The schedule row's second line (tab 1): parts with zero left out; null = say nothing. */
  headcount: (c: { total: number; in: number; out: number; maybe: number }) => {
    const parts = [
      c.in > 0 ? `${c.in} of ${c.total} in` : null,
      c.out > 0 ? `${c.out} out` : null,
      c.maybe > 0 ? `${c.maybe} maybe` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  },
  /** Ask 7, in the danger word style: outs leave fewer players than the field needs. */
  short: (c: { total: number; out: number }) => `${c.out} out · at most ${c.total - c.out} can play`,
  /** The parts the event window's Attendance row and the room's card share: families, not the book. */
  familyParts: (f: { answered: number; haveNot: number; noParent?: number }) =>
    [
      f.answered > 0 ? `${f.answered} answered` : null,
      f.haveNot > 0 ? `${f.haveNot} ${plural(f.haveNot, 'hasn’t', 'haven’t')}` : null,
      f.noParent ? `${f.noParent} ${plural(f.noParent, 'has', 'have')} no parent in the app` : null,
    ].filter((p): p is string => !!p),
  /** The event window's Attendance row: families who changed after the coach marked (shown in the warning ink). */
  changedPart: (n: number) => `${n} changed`,
  /** The event window's Attendance row: its one new line (tab 2). */
  doorLabel: 'Families:',
  /** The room's Families card (tab 2). */
  card: {
    title: 'Families',
    changed: (names: readonly string[]) => `⚠ ${names.length} changed since you marked: ${names.join(', ')}`,
    show: 'Show',
    showAll: 'Show everyone',
    nobody: 'No parent is in the app yet, so no family can answer.',
    invite: 'Invite parents from the Roster →',
    use: (n: number) => `Use ${n} family ${plural(n, 'answer', 'answers')}`,
    used: (names: readonly string[]) => `Used ${names.length} family ${plural(names.length, 'answer', 'answers')}: ${names.join(', ')}`,
    undo: 'Undo',
    undone: 'Put back to Not marked.',
    useFailed: 'That didn’t save. Try again in a moment.',
  },
  /** The grey line under a player (phone) and the "Family said" column (desk). */
  line: (l: CoachFamilyLine) => `Family said ${ANSWER_WORD[l.answer]}${quoted(l.note)} · ${whoDay(l.by, l.day)}${earlier(l.previous)}`,
  cell: (l: CoachFamilyLine) => `${ANSWER_WORD[l.answer]}${quoted(l.note)} · ${whoDay(l.by, l.day)}${earlier(l.previous)}`,
  drift: (l: CoachFamilyLine) => `⚠ Family changed to ${ANSWER_WORD[l.answer]} · ${l.day}`,
  driftCell: (l: CoachFamilyLine) => `⚠ Changed to ${ANSWER_WORD[l.answer]}${quoted(l.note)} · ${whoDay(l.by, l.day)}`,
  notYet: 'Family hasn’t answered',
  desk: { player: 'Player', family: 'Family said', mark: 'Your mark' },
  /** The player sheet's family box (tab 2). */
  box: {
    head: (player: string) => `${possessive(player)} family said`,
    answer: (l: CoachFamilyLine) => ANSWER_WORD[l.answer],
    note: (l: CoachFamilyLine) => (l.note ? `“${l.note}”` : ''),
    meta: (l: CoachFamilyLine) => `${whoDay(l.by, l.day)}${earlier(l.previous)}`,
    /** What a tap does here, in the coach's choice words ("In", "Out", "Late"). */
    hint: (p: { familyChoice: string | null; markChoice: string | null; drift: boolean }) =>
      [
        p.drift && p.familyChoice && p.markChoice
          ? `Tap ${p.familyChoice} to use the family’s answer, or tap ${p.markChoice} to keep your mark and clear the warning.`
          : p.drift && p.markChoice
            ? `Tap ${p.markChoice} to keep your mark and clear the warning.`
            : !p.markChoice && p.familyChoice ? `Tap ${p.familyChoice} to use the family’s answer.` : null,
        'Families don’t see your mark.',
      ].filter(Boolean).join(' '),
  },
} as const;
