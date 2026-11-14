import { daysBetweenDateStrings, formatInOrgZone, orgDayKey, utcToZonedInputs } from './timezone';
import { endSentence, formatTime, joinWithAnd, pluralize, possessive } from './utils';
import { opponentPhrase, scheduleDayLabel } from './family-schedule-format';
import { ATTENDANCE_WORD } from './coach-schedule-vocab';
import type { RepAttendanceStatus } from './types';

/**
 * EVERY WORD "Families say if they're coming" shows (Signed-in family accounts Stage 4b; drawing
 * SIGNED_IN_FAMILY_STAGE4B_DRAWINGS.html). One file so /marketing and /legal read the feature in one place (the
 * lib/league-second-parent.ts precedent): the parent's side (tab 7), the coach's side (tabs 1–3), the lineup (tab 5), Remind and
 * its email (tab 4) and the coach's bell (tab 6).
 *
 * Not `server-only`: the family page's client component reads it. Nothing here reads data.
 */

/**
 * An answer IS the attendance record's status (One attendance record, ruling 1): In · Late · Maybe · Out, the same four for the
 * family and the coach. "Not marked" (`unknown`) is no answer, carried as null.
 */
export type AnswerStatus = Exclude<RepAttendanceStatus, 'unknown'>;
/** The family's choices in the order the sheet draws them (ruling 1). */
export const ANSWER_STATUSES: readonly AnswerStatus[] = ['attending', 'late', 'maybe', 'absent'];

/** Who set an answer, as one side reads it. `name` is a first name (null = the account holds none); a coach is never named. */
export interface AnswerWho {
  /** The family side reads 'you' for its own account; the coach side never does. */
  by: 'coach' | 'family' | 'you';
  name: string | null;
  /** "today" / "Tue" / "Nov 1" (the org's days; never the clock time, ask 6). */
  day: string;
}
/** One answer's who/when, and the one before it (ruling 4: "Coach, today · earlier: In (Adasmom, Nov 1)"). */
export interface AnswerSetLine extends AnswerWho {
  previous: (AnswerWho & { status: AnswerStatus }) | null;
}

/** The one-line note's cap (ask 5's "one short line", app-enforced; the database CHECK holds the same 200). */
export const FAMILY_ANSWER_NOTE_MAX = 200;

/** One sentence for every failed save in this feature. */
const SAVE_FAILED = 'That didn’t save. Try again in a moment.';
/** A started or cancelled event: answers are closed (the parent's sheet and the coach's Remind say the same). */
const ANSWERS_CLOSED = 'Answers have closed for this one.';

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

/** The four answers' words: the coach's own (`ATTENDANCE_WORD`), so a family's Late and a coach's Late are one spelling. */
const ANSWER_WORD: Record<AnswerStatus, string> = {
  attending: ATTENDANCE_WORD.attending, late: ATTENDANCE_WORD.late, maybe: ATTENDANCE_WORD.maybe, absent: ATTENDANCE_WORD.absent,
};

/** "Coach" / "You" / a first name (or the side's fallback words when the account holds none). */
function whoWord(w: AnswerWho, fallback: string): string {
  return w.by === 'coach' ? 'Coach' : w.by === 'you' ? 'You' : w.name ?? fallback;
}
/** "Coach, today · earlier: In (Adasmom, Nov 1)" — the one shape both sides read (ruling 4). */
function setLineWords(l: AnswerSetLine, fallback: string, note: string | null = null): string {
  const p = l.previous;
  return `${whoWord(l, fallback)}, ${l.day}${note ? ` · “${note}”` : ''}` +
    (p ? ` · earlier: ${ANSWER_WORD[p.status]} (${whoWord(p, fallback)}, ${p.day})` : '');
}

export const FAMILY_AVAILABILITY_WORDS = {
  answer: ANSWER_WORD,
  /** The schedule row's pill (tab 7). */
  pill: {
    attending: 'In ✓',
    late: 'Late',
    maybe: 'Maybe',
    absent: 'Out',
    ask: 'Answer',
    closedNone: 'No answer',
  },
  /** The pill's accessible name: what tapping it does, and who set the answer when it wasn't this parent. */
  pillLabel: (child: string, eventTitle: string, answer: AnswerStatus | null, setBy: AnswerSetLine | null) =>
    answer
      ? `${child}: ${ANSWER_WORD[answer]} for ${eventTitle}${setBy && setBy.by !== 'you' ? `, set by ${whoWord(setBy, OTHER_PARENT)}` : ''}. Change the answer`
      : `Answer for ${child}: ${eventTitle}`,
  /** The sheet's line over the choices: the current answer, who set it and when, and the one before (ruling 4). */
  setLine: (answer: AnswerStatus, l: AnswerSetLine) => `${ANSWER_WORD[answer]} · ${setLineWords(l, 'The other parent')}`,
  sheet: {
    close: 'Close',
    noteLabel: 'Your note for the coach',
    notePlaceholder: 'Your note for the coach (e.g. leaving early)',
    saving: 'Saving…',
    saved: 'Saved',
    failed: SAVE_FAILED,
    closed: ANSWERS_CLOSED,
    tapHint: 'A tap saves. Tap your answer again to clear it.',
    /** /legal's hint (tab 7). The other-parent sentence only when another parent is connected. */
    privacy: (child: string, otherParent: string | null) =>
      [
        'Your team’s coaches see your answer, your note, your first name and the day you answered.',
        // /legal (One attendance record, ruling 4): the answer IS the attendance, so the parent is told the coach can change it.
        `Your answer is also ${possessive(child)} attendance: the coaches can change it, and you’ll see who did and when.`,
        otherParent ? `${otherParent === OTHER_PARENT ? 'The other parent' : `${otherParent}, ${possessive(child)} other parent,`} sees your answer and first name, but not your note.` : null,
        'Other families see none of it.',
        'Please don’t put health details here; tell the coach directly.',
      ].filter(Boolean).join(' '),
    /** The other parent's note: that there is one, never its words. */
    otherNote: 'The other parent left a note for the coach.',
  },
  /** A started event (tab 7): the answer shows muted and cannot change. */
  started: (isGame: boolean) =>
    `Answers closed when the ${isGame ? 'game' : 'practice'} started. To let the coach know something now, contact them directly.`,
  /** Arriving from a reminder (tab 7): only while the event is open and the named child is unanswered. */
  coachAsked: (children: readonly string[]) =>
    `The coach asked whether ${children.length > 1 ? `${joinWithAnd(children)} are` : `${children[0]} is`} coming.`,
  otherParentFallback: OTHER_PARENT,
} as const;

// ── The coach's side (Session 2, Parts 4–5; drawing tabs 1–3) ────────────────────────────────────────────────────────────────

/** The coach reads "Priya, Tue": the day only, short (ask 6). "today" / "yesterday"; a weekday within the week; "Apr 2" before. */
export function answeredDayShort(answeredAtIso: string, now: Date = new Date()): string {
  const kind = answeredDayKind(answeredAtIso, now);
  if (kind === 'today' || kind === 'yesterday') return kind;
  return formatInOrgZone(answeredAtIso, kind === 'date' ? { month: 'short', day: 'numeric' } : { weekday: 'short' });
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * One player's answer as the attendance room reads it (One attendance record, rulings 3–4 and 7): who set it and when, the
 * family's note (the coach reads it; never the coach's own note, which is the row's), and the answer before. The status is the
 * row's. Reaches only coaches who can mark attendance (ask 11).
 */
export interface CoachAnswerLine extends AnswerSetLine {
  familyNote: string | null;
}

export const FAMILY_AVAILABILITY_COACH_WORDS = {
  /** Team settings → Sharing (tab 3). */
  setting: {
    label: 'Families say if they’re coming',
    groupLabel: 'Which events families answer',
    choice: { off: 'Off', games: 'Games', games_and_practices: 'Games and practices' } as const,
    off: 'Off: families don’t see In / Late / Maybe / Out. Attendance works as it does today.',
    on: (setting: 'games' | 'games_and_practices', connected: number, roster: number) =>
      `Parents in the app can answer In, Late, Maybe or Out for every upcoming ${setting === 'games' ? 'game' : 'game and practice'}, until it starts. ` +
      'Their answer and yours are one answer per player: the latest change counts, and the parent sees yours. ' +
      `${connected} of ${roster} ${plural(roster, 'player has', 'players have')} a parent in the app.`,
    turnedOff: 'Families stop seeing In / Late / Maybe / Out. Every answer already given stays as the player’s attendance.',
    nobodyYet: 'No parent is in the app yet. Answers appear once you invite parents from each player’s Guardians on the Roster.',
    staffOnly: 'Families can’t see the schedule, so they can’t answer. Set Schedule visibility to Families or Public first.',
    /** The row's words while Schedule visibility is Staff only and the control is paused (nothing lit). `saved` is the choice that
     *  comes back (null when it was Off). */
    paused: (saved: string | null) =>
      'Paused: families can’t see the schedule, so they can’t answer. Set Schedule visibility to Families or Public to use this.' +
      (saved ? ` Your choice (${saved}) comes back then.` : ''),
    readOnly: (choice: string) => `${choice} — only coaches who manage the schedule can change it.`,
    failed: SAVE_FAILED,
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
  /** The event window's Attendance row: its one new line (tab 2). */
  doorLabel: 'Families:',
  /** The room's Families card (tab 2). */
  card: {
    title: 'Families',
    nobody: 'No parent is in the app yet, so no family can answer.',
    invite: 'Invite parents from the Roster →',
  },
  /** Who set a player's answer and when, the family's note, and the answer before (ruling 4): the grey line under a player
   *  (phone) and the "Set by" column (desk). "Adasmom, today · “leaving early” · earlier: In (Coach, Nov 1)". */
  setLine: (l: CoachAnswerLine) => setLineWords(l, 'A parent', l.familyNote),
  desk: { player: 'Player', setBy: 'Set by', answer: 'Answer' },
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
          : `⚠ ${possessive(names[0])} family said Out, but ${names[0]} is still in the lineup.`
        : afterSave
          ? `⚠ ${names.length} families said Out after you saved this lineup: ${names.join(', ')}`
          : `⚠ ${names.length} families said Out, but their players are still in the lineup: ${names.join(', ')}`,
    takeOut: (names: readonly string[]) => (names.length === 1 ? `Take ${names[0]} out` : 'Take them out'),
    /** The event window's Lineup row line (`names` already joined: "Maya" / "Maya and Blake"). */
    rowLine: (names: string, count: number, afterSave: boolean) =>
      count === 1
        ? `${possessive(names)} family said Out${afterSave ? ' after you saved' : `, but ${names} is still in the lineup`}`
        : `The families of ${names} said Out${afterSave ? ' after you saved' : ', but they’re still in the lineup'}`,
  },
  /** The player sheet's who box (tab 2): who set the answer, the family's note, the one before, and what a tap does. */
  box: {
    head: 'Set by',
    meta: (l: CoachAnswerLine) => setLineWords(l, 'A parent'),
    note: (l: CoachAnswerLine) => (l.familyNote ? `“${l.familyNote}”` : ''),
    /** Ruling 4: the family sees the coach's change on their own child (never the coach's note). */
    hint: 'A tap replaces the answer. The family sees it, but never your note.',
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

/** The coach's Remind (tab 4): the in-place confirm, the report, and the card's line when nobody is left. */
export const FAMILY_REMIND_COACH_WORDS = {
  button: (n: number) => `Remind ${n}`,
  /** Names the players (owner, Session 4: name players, count parents; a family is not a count, two siblings are one household). */
  ask: (players: readonly string[]) =>
    `Remind about ${players.length > 4 ? `${players.slice(0, 2).join(', ')} and ${players.length - 2} others` : joinWithAnd(players)}?`,
  /** Who gets it and the message, in short. */
  who: (p: { players: readonly string[]; parents: number; label: string; date: string }) =>
    `${p.players.length === 1 ? `${possessive(p.players[0])} ${p.parents === 1 ? 'parent gets' : `${p.parents} parents get`}` : `${pluralize(p.parents, 'parent')} ${p.parents === 1 ? 'gets' : 'get'}`} ` +
    `a note in the app and an email asking whether ${p.players.length === 1 ? p.players[0] : 'their player'} is coming to ${p.label}, ${p.date}.`,
  appOnly: (appOnly: number, parents: number, club: string) =>
    appOnly === 0 ? null
      : parents === appOnly
        ? `${appOnly === 1 ? 'They have' : 'They all have'} unsubscribed from ${possessive(club)} emails, so they get the app note only.`
        : `${appOnly === 1 ? 'One of them has unsubscribed' : `${appOnly} of them have unsubscribed`} from ${possessive(club)} emails, so ${appOnly === 1 ? 'that parent gets' : 'they get'} the app note only.`,
  /** The daily cap (owner, Session 4): a parent who already had a reminder email today from this team gets the app note only. */
  capped: (n: number) =>
    n === 0 ? null
      : `${n === 1 ? 'One parent has' : `${n} parents have`} already had a reminder email today, so ${n === 1 ? 'that parent gets' : 'they get'} the app note only.`,
  marked: (names: readonly string[]) =>
    names.length === 0 ? null
      : names.length === 1
        ? `${names[0]} hasn’t answered either, but you’ve already marked that player, so that family isn’t reminded.`
        : `${joinWithAnd(names)} haven’t answered either, but you’ve already marked them, so their families aren’t reminded.`,
  noParent: (names: readonly string[]) =>
    names.length === 0 ? null : `${joinWithAnd(names)} ${names.length === 1 ? 'has' : 'have'} no parent in the app.`,
  limit: (isPractice: boolean) => `You can remind again for this ${isPractice ? 'practice' : 'game'} after 24 hours.`,
  /** One message goes to each parent, so the button counts parents. */
  send: (parents: number) => `Send to ${pluralize(parents, 'parent')}`,
  sending: 'Sending…',
  see: 'See what they’ll get',
  hide: 'Hide what they’ll get',
  cancel: 'Cancel',
  /** The sample the confirm shows under "See what they'll get" (the first parent's email, as sent). */
  sampleSubject: 'Subject:',
  /** Parents REACHED (each got the app note), and whom it was about. */
  report: (players: readonly string[], parents: number) => `Reminded ${pluralize(parents, 'parent')} about ${joinWithAnd(players)}`,
  reportAppOnly: (n: number) => (n === 0 ? null : `${n} got the note in the app only.`),
  /** "…again tomorrow at 10:30 a.m.", or "today" once the card is read the next day (the 24 hours end on the org's day it is read). */
  when: (remindedAt: string, againAt: string, nowMs: number) =>
    `${endSentence(`Reminded ${orgDayKey(remindedAt) === orgDayKey(new Date(nowMs).toISOString()) ? '' : 'yesterday '}at ${clockOf(remindedAt)}`)} ${endSentence(`You can remind again ${orgDayKey(againAt) === orgDayKey(new Date(nowMs).toISOString()) ? 'today' : 'tomorrow'} at ${clockOf(againAt)}`)}`,
  /** The card's counts when every family the coach hasn't marked has answered (tab 4, frame 3). */
  nobodyLeft: 'every family you haven’t marked has answered',
  loading: 'Checking who to remind…',
  failed: 'That didn’t send. Try again in a moment.',
  readFailed: 'Couldn’t check who to remind. Try again in a moment.',
  closed: ANSWERS_CLOSED,
  nobody: 'Every family you haven’t marked has answered, so there’s nobody to remind.',
} as const;

// ── The coach's bell (Session 3, Part 8; drawing tab 6). Never the note's words: "left a note" only. ──────────────────────────

/** The bell's short event name: "Sat vs Lakeshore" / "Sat at Lakeshore" / "Thu, Apr 29 practice". */
export function coachBellEventLabel(e: { startsAt: string; eventType: string; name: string; opponent: string | null; homeAway: string | null }): string {
  if (e.opponent) return `${formatInOrgZone(e.startsAt, { weekday: 'short' })} ${opponentPhrase(e.opponent, e.homeAway)}`;
  return [scheduleDayLabel(e.startsAt), e.eventType === 'practice' ? 'practice' : e.name].filter(Boolean).join(' ');
}

interface BellItemWords {
  child: string; answer: AnswerStatus | null; prior: AnswerStatus | null; parent: string | null; hasNote: boolean;
  count: string | null; eventLabel: string; eventDay: string;
}

/** One bell line's title and body, from its items (one event's answers, or one family's run of events). */
export function coachBellWords(bundle: { kind: 'event' | 'family'; items: readonly BellItemWords[] }): { title: string; body: string } {
  const items = bundle.items;
  const last = items[items.length - 1];
  const allOut = items.every(i => i.answer === 'absent');
  if (bundle.kind === 'family' && items.length > 1) {
    return {
      title: `${possessive(last.child)} family ${allOut ? 'said Out' : 'changed answers'} for ${items.length} events`,
      body: items.map(i => i.eventDay).join(' · '),
    };
  }
  if (items.length > 1) {
    return {
      title: `${items.length} families ${allOut ? 'said Out' : 'changed their answers'} for ${last.eventLabel}`,
      body: [joinWithAnd(items.map(i => (allOut ? i.child : `${i.child} (${i.answer ? ANSWER_WORD[i.answer] : 'no answer'})`))), last.count ? `now ${last.count}` : null]
        .filter(Boolean).join(' · '),
    };
  }
  const who = last.parent ?? 'A parent';
  const was = last.prior ? `Was ${ANSWER_WORD[last.prior]}` : null;
  const tail = [last.hasNote ? `${who} left a note` : null, last.count ? `now ${last.count}` : null];
  if (last.answer === null) {
    return { title: `${possessive(last.child)} family took back their answer for ${last.eventLabel}`, body: [was, ...tail].filter(Boolean).join(' · ') };
  }
  if (last.answer === 'absent' && !last.prior) {
    return { title: `${possessive(last.child)} family said Out for ${last.eventLabel}`, body: [last.hasNote ? `${who} left a note` : `${who} answered`, ...tail.slice(1)].filter(Boolean).join(' · ') };
  }
  return {
    title: `${possessive(last.child)} family changed to ${ANSWER_WORD[last.answer]} for ${last.eventLabel}`,
    body: [was, ...tail].filter(Boolean).join(' · '),
  };
}
