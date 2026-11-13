import { daysBetweenDateStrings, formatInOrgZone, orgDayKey, utcToZonedInputs } from './timezone';
import { endSentence, formatTime, joinWithAnd, possessive } from './utils';
import { opponentPhrase, scheduleDayLabel } from './family-schedule-format';

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
    `The coach asked whether ${children.length > 1 ? `${joinWithAnd(children)} are` : `${children[0]} is`} coming.`,
  otherParentFallback: OTHER_PARENT,
  /** The schedule-change notice's one added sentence when a new day cleared the answers (ask 10; Part 6). */
  answerAgain: 'Families who said whether their player is coming will need to answer again on the team page.',
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
  /** The lineup (Session 3, Part 6; drawing tab 5). Names are the builder's own player names. */
  lineup: {
    tag: { out: 'Out', maybe: 'Maybe' } as const,
    /** The strip's mark while a family's Out waits on the coach (the event window's word, so the two never differ). */
    needsLook: 'Needs a look',
    /** The builder's warning line: the Out came after the lineup was saved (as drawn), or before it and the player was kept in. */
    warn: (names: readonly string[], afterSave: boolean) =>
      names.length === 1
        ? afterSave
          ? `⚠ ${possessive(names[0])} family said Out after you saved this lineup.`
          : `⚠ ${possessive(names[0])} family said Out, and ${names[0]} is still in the lineup.`
        : afterSave
          ? `⚠ ${names.length} families said Out after you saved this lineup: ${names.join(', ')}`
          : `⚠ ${names.length} families said Out, and their players are still in the lineup: ${names.join(', ')}`,
    takeOut: (names: readonly string[]) => (names.length === 1 ? `Take ${names[0]} out` : 'Take them out'),
    /** The event window's Lineup row line (`names` already joined: "Maya" / "Maya and Blake"). */
    rowLine: (names: string, count: number, afterSave: boolean) =>
      count === 1
        ? `${possessive(names)} family said Out${afterSave ? ' after you saved' : `, but ${names} is in the lineup`}`
        : `The families of ${names} said Out${afterSave ? ' after you saved' : ', but they’re in the lineup'}`,
  },
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

// ── The reminder (Session 3, Part 7; drawing tab 4): the coach's confirm and report, the parent's email and bell ─────────────

/** "10:30 a.m." for a stored instant, in the org's clock (the one clock formatter). */
export function clockOf(iso: string): string {
  return formatTime(utcToZonedInputs(iso).time);
}

/** The event as the reminder names it: "Ridge 12U vs Lakeshore" / "Ridge 12U at Lakeshore" / "Ridge 12U practice". */
export function reminderEventLabel(e: { teamName: string; eventType: string; name: string; opponent: string | null; homeAway: string | null }): string {
  if (e.opponent) return `${e.teamName} ${opponentPhrase(e.opponent, e.homeAway)}`;
  return e.eventType === 'practice' ? `${e.teamName} practice` : [e.teamName, e.name].filter(Boolean).join(' ');
}

/** What a parent receives (tab 4). It names the event and the child; it can answer nothing and carries no answer link. */
export const FAMILY_REMINDER_WORDS = {
  /** The subject names the team and the event, never the child (it shows on a lock screen). */
  subject: (label: string, date: string, children: number) =>
    `${label}, ${date}: ${children > 1 ? 'are your players' : 'is your player'} coming?`,
  title: (children: readonly string[]) => (children.length > 1 ? `Are ${joinWithAnd(children)} coming?` : `Is ${children[0]} coming?`),
  /** The event lines, then why it came and what to do. */
  body: (p: { label: string; date: string; clock: string; place: string | null; children: readonly string[] }) =>
    `${p.label}\n${p.date} · ${p.clock}${p.place ? `\n${p.place}` : ''}\n\n` +
    `${p.children.length > 1 ? 'Their' : possessive(p.children[0])} coach asked families to say whether their player is coming. ` +
    'Open the team page and tap Answer.\n\nYou’ll be asked to sign in if you aren’t already.',
  button: 'Open the team page',
  /** Completes "Sent by {club} because …". */
  reason: (children: readonly string[], teamName: string) =>
    `you’re connected to ${children.length === 1 ? `${possessive(children[0])} team` : teamName} in the app`,
  bellTitle: (children: readonly string[], date: string) =>
    `${children.length > 1 ? `Are ${joinWithAnd(children)}` : `Is ${children[0]}`} coming ${date}?`,
  bellBody: (label: string) => `${label} · Answer on the team page`,
} as const;

const s = (n: number) => (n === 1 ? '' : 's');

/** The coach's Remind (tab 4): the in-place confirm, the report, and the card's line when nobody is left. */
export const FAMILY_REMIND_COACH_WORDS = {
  button: (n: number) => `Remind ${n}`,
  ask: (families: readonly string[]) => (families.length === 1 ? `Remind ${possessive(families[0])} family?` : `Remind ${families.length} families?`),
  /** Who gets it and the message, in short. */
  who: (p: { families: readonly string[]; parents: number; label: string; date: string }) =>
    `${p.families.length === 1 ? `${possessive(p.families[0])} ${p.parents === 1 ? 'parent gets' : `${p.parents} parents get`}` : `${p.parents} parent${s(p.parents)} ${p.parents === 1 ? 'gets' : 'get'}`} ` +
    `a note in the app and an email: “${p.label}, ${p.date}: is ${p.families.length === 1 ? p.families[0] : 'your player'} coming? Answer on the team page.”`,
  appOnly: (appOnly: number, parents: number, club: string) =>
    appOnly === 0 ? null
      : parents === appOnly
        ? `${appOnly === 1 ? 'They have' : 'They all have'} turned off ${possessive(club)} emails, so they get the app note only.`
        : `${appOnly === 1 ? 'One of them has' : `${appOnly} of them have`} turned off ${possessive(club)} emails, so they get the app note only.`,
  marked: (names: readonly string[]) =>
    names.length === 0 ? null
      : names.length === 1
        ? `${names[0]} hasn’t answered either, but you’ve already marked ${names[0]}, so that family isn’t reminded.`
        : `${joinWithAnd(names)} haven’t answered either, but you’ve already marked them, so their families aren’t reminded.`,
  noParent: (names: readonly string[]) =>
    names.length === 0 ? null : `${joinWithAnd(names)} ${names.length === 1 ? 'has' : 'have'} no parent in the app.`,
  limit: (isPractice: boolean) => `You can remind again for this ${isPractice ? 'practice' : 'game'} after 24 hours.`,
  send: (families: number) => `Send ${families} reminder${s(families)}`,
  sending: 'Sending…',
  see: 'See what they’ll get',
  hide: 'Hide the message',
  cancel: 'Cancel',
  /** The sample the confirm shows under "See what they'll get" (the first family's email, as sent). */
  sampleSubject: 'Subject:',
  report: (families: readonly string[], parents: number) =>
    families.length === 1
      ? `Reminded ${possessive(families[0])} family (${parents} parent${s(parents)})`
      : `Reminded ${families.length} families (${parents} parent${s(parents)})`,
  reportAppOnly: (n: number) => (n === 0 ? null : `${n} got the note in the app only.`),
  /** "…again tomorrow at 10:30 a.m.", or "today" once the card is read the next day (the 24 hours end on the org's day it is read). */
  when: (remindedAt: string, againAt: string, nowMs: number) =>
    `${endSentence(`Reminded at ${clockOf(remindedAt)}`)} ${endSentence(`You can remind again ${orgDayKey(againAt) === orgDayKey(new Date(nowMs).toISOString()) ? 'today' : 'tomorrow'} at ${clockOf(againAt)}`)}`,
  /** The card's counts when every family the coach hasn't marked has answered (tab 4, frame 3). */
  nobodyLeft: 'every family you haven’t marked has answered',
  loading: 'Checking who to remind…',
  failed: 'That didn’t send. Nothing was used up; try again in a moment.',
  readFailed: 'Couldn’t check who to remind. Try again in a moment.',
  closed: 'Answers have closed for this one.',
  nobody: 'Every family you haven’t marked has answered, so there’s nobody to remind.',
} as const;

// ── The coach's bell (Session 3, Part 8; drawing tab 6). Never the note's words: "left a note" only. ──────────────────────────

/** The bell's short event name: "Sat vs Lakeshore" / "Sat at Lakeshore" / "Thu, Apr 29 practice". */
export function coachBellEventLabel(e: { startsAt: string; eventType: string; name: string; opponent: string | null; homeAway: string | null }): string {
  if (e.opponent) return `${formatInOrgZone(e.startsAt, { weekday: 'short' })} ${opponentPhrase(e.opponent, e.homeAway)}`;
  return [scheduleDayLabel(e.startsAt), e.eventType === 'practice' ? 'practice' : e.name].filter(Boolean).join(' ');
}

interface BellItemWords {
  child: string; answer: FamilyAnswer | null; prior: FamilyAnswer | null; parent: string | null; hasNote: boolean;
  markWord: string | null; count: string | null; eventLabel: string; eventDay: string;
}

/** One bell line's title and body, from its items (one event's answers, or one family's run of events). */
export function coachBellWords(bundle: { kind: 'event' | 'family'; items: readonly BellItemWords[] }): { title: string; body: string } {
  const items = bundle.items;
  const last = items[items.length - 1];
  const allOut = items.every(i => i.answer === 'out');
  if (bundle.kind === 'family' && items.length > 1) {
    return {
      title: `${possessive(last.child)} family ${allOut ? 'said Out' : 'changed answers'} for ${items.length} events`,
      body: items.map(i => i.eventDay).join(' · '),
    };
  }
  if (items.length > 1) {
    return {
      title: `${items.length} families ${allOut ? 'said Out' : 'changed their answers'} for ${last.eventLabel}`,
      body: [joinWithAnd(items.map(i => (allOut ? i.child : `${i.child} ${i.answer ? ANSWER_WORD[i.answer] : 'no answer'}`))), last.count ? `now ${last.count}` : null]
        .filter(Boolean).join(' · '),
    };
  }
  const who = last.parent ?? 'A parent';
  const was = last.prior ? `Was ${ANSWER_WORD[last.prior]}` : null;
  const tail = [last.hasNote ? `${who} left a note` : null, last.count ? `now ${last.count}` : null];
  if (last.answer === null) {
    return { title: `${possessive(last.child)} family took back their answer for ${last.eventLabel}`, body: [was, ...tail].filter(Boolean).join(' · ') };
  }
  if (last.markWord) {
    return {
      title: `${possessive(last.child)} family changed to ${ANSWER_WORD[last.answer]} for ${last.eventLabel}`,
      body: [was, `your mark still says ${last.markWord}`, last.hasNote ? `${who} left a note` : null].filter(Boolean).join(' · '),
    };
  }
  if (last.answer === 'out' && !last.prior) {
    return { title: `${last.child} is Out for ${last.eventLabel}`, body: [last.hasNote ? `${who} left a note` : `${who} answered`, ...tail.slice(1)].filter(Boolean).join(' · ') };
  }
  return {
    title: `${possessive(last.child)} family changed to ${ANSWER_WORD[last.answer]} for ${last.eventLabel}`,
    body: [was, ...tail].filter(Boolean).join(' · '),
  };
}
