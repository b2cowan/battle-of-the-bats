/**
 * A TOURNAMENT'S STATUS, IN WORDS — one home (Tournament admin redesign Stage 4, 2026-10-06): what each
 * status means for the public site and the slot, and the sentence every change says BEFORE it happens
 * (A20: a status change asks first). Every door reads it — the event's record (both lists), the finished
 * board's Archive (the Tournament plan), the game-day board's Mark complete and Event Settings' switch
 * (P5, owner 2026-10-06: the same words everywhere; whether Event Settings keeps its switch is Stage 5's).
 * The words are `/marketing`'s (2026-10-06).
 *
 * ⚠ THEY MUST STAY TRUE TO THE ROUTE that does the change (`app/api/admin/tournaments/route.ts`,
 * set-status), checked 2026-10-06:
 *   - only Active and Completed are public (lib/public-tournament-data PUBLIC_STATUSES): Draft and Archived
 *     take the site and every shared link offline at once;
 *   - every status but Archived holds a slot; a change needing one is refused when none is free;
 *   - Activate AND Reopen (any change to Active) are refused without dates, a division and a contact;
 *   - registration takes the status Active, an open division, AND a day before the start date
 *     (app/api/register) — so a reopened finished event takes no registrations;
 *   - Completed locks games, teams, divisions, check-in and imports (their routes refuse with 409);
 *   - Mark complete emails each accepted team's coach ONCE, only with "notify teams on complete" on,
 *     coach emails not paused and the plan's Summary (the dashboard route's `notifyTeamsOnComplete`) —
 *     and so does Bring back, which is a change TO Completed (an event archived unfinished never sent them);
 *   - a sealed event never goes back to Active or Draft, from any status;
 *   - a sealed record survives deleting the event; sealing does not change the status.
 * ⚠ It says nothing about COACHES on purpose: the coach side has no archived gate (a coach still opens
 * their registration's record), which /review caught a sentence claiming on 2026-09-29.
 * ⚠ The status word for a running event is "Active", never "Live": "Live" is ONE GAME in progress
 * (G1, `PHASE_LABEL`), and a public site is "online" / "offline".
 */
import { formatStoredDate } from './timezone.ts';

export type StatusChange = 'activate' | 'complete' | 'draft' | 'reopen' | 'archive' | 'bringBack' | 'seal' | 'delete';

/** Each change's button — and its confirm's button, which repeats the verb (the /design review). */
export const STATUS_ACTION: Record<StatusChange, string> = {
  activate: 'Activate',
  complete: 'Mark complete',
  draft: 'Move back to draft',
  reopen: 'Reopen',
  archive: 'Archive',
  bringBack: 'Bring back',
  seal: 'Seal',
  delete: 'Delete',
};

/** The status word, said once (a band, a chip). */
export const STATUS_WORD = { draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived' } as const;

/** A route's refusal when every slot on the plan is held (the set-status and clone routes). */
export function slotsInUseRefusal(limit: number): string {
  return limit === 1
    ? 'Your plan has one tournament slot, and it’s in use. Archive another tournament first.'
    : `Your plan has ${limit} tournament slots, and they’re all in use. Archive another tournament first.`;
}

/** What a locked (completed) event's screens and routes say when an edit is refused. */
export const LOCKED_RESULTS = 'This tournament is completed, so its results are locked. Reopen it from the Tournaments list to make changes.';
export const LOCKED_IMPORTS = 'This tournament is completed, so its results are locked. Reopen it from the Tournaments list to import.';

/** The archive sentence (F32, rewritten 2026-10-06: the way back is now the record's Bring back). */
export function archiveSentence(finiteSlots: boolean): string {
  return finiteSlots
    ? 'Its public site goes offline right away, so every link you’ve shared stops working, and its tournament slot is freed. Its teams, games, and payments are kept. To bring it back, open it on the Tournaments list; you’ll need a free tournament slot.'
    : 'Its public site goes offline right away, so every link you’ve shared stops working. Its teams, games, and payments are kept, and you can bring it back from the Tournaments list.';
}

/** The event's record: its blocks, its fields, and what it says before a tap. */
export const RECORD_WORDS = {
  noun: 'tournament',
  status: 'Status',
  nextYear: 'Next year',
  permanentRecord: 'Permanent record',
  details: 'Details',
  edit: 'Edit the details',
  name: 'Name',
  year: 'Year',
  publicLink: 'Public link',
  dates: 'Dates',
  startDate: 'Start date',
  endDate: 'End date',
  datesNotSet: 'Dates not set',
  linkWarning: 'Changing the public link breaks every link you’ve already shared.',
  nameHeld: 'Give the tournament a name to save it.',
  yearHeld: 'Enter a year between 2000 and 2100.',
  datesHeld: 'The end date can’t be before the start date.',
  linkHeld: 'Use lowercase letters, numbers, and hyphens in the public link.',
  deleteTournament: 'Delete this tournament',
  sealSentence: 'Seal it to keep a permanent public record of its results. Sealing can’t be undone.',
  sealed: (date: string) => `Sealed ${date}`,
  publicRecord: 'its public record',
  lockSeal: 'Seal a permanent public record',
  lockSlots: 'More tournament slots',
  lockReuse: 'Reuse this setup',
  sealedNoReopen: 'Its results are sealed, so it can’t be reopened.',
  slotFull: (holder: string) => `Bringing it back needs a free slot. Your plan has one, and ${holder} holds it.`,
  slotsFull: (limit: number, holders: number) =>
    `Bringing it back needs a free slot. Your plan has ${limit === 1 ? 'one' : limit}, and ${holders} other events hold them.`,
  linkTaken: (holder: string) => `Its public link is now used by ${holder}. Change this event’s public link in Details before you bring it back.`,
  /** "To activate it, first add its dates, a division, and a contact." */
  blocked: (verb: 'activate' | 'reopen', missing: Array<'dates' | 'division' | 'contact'>) => {
    const words = missing.map(m => (m === 'dates' ? 'its dates' : m === 'division' ? 'a division' : 'a contact'));
    const list = words.length <= 2 ? words.join(' and ') : `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`;
    return `To ${verb} it, first add ${list}.`;
  },
  // ── Changing the public link asks first (build-time words, 2026-10-06 — for /marketing's next pass) ──
  linkQuestion: 'Change the public link?',
  linkQuestionBody: (from: string, to: string) => `Every link you’ve shared to ${from} stops working. The new link is ${to}.`,
  linkQuestionAction: 'Change the link',
} as const;

/** The facts a record's Status sentence depends on. */
export type StatusFacts = {
  status: 'draft' | 'active' | 'completed' | 'archived';
  startDate: string | null;
  endDate: string | null;
  today: string;
  finiteSlots: boolean;
  sealed: boolean;
};

/** What the status means for the public site and the slot — opening with the day it finished where
 *  there is one, and never repeating the chip (the /design review). */
export function statusSentence(f: StatusFacts): string {
  // Only once its last day has come: an event archived (or marked complete) before its dates never finished.
  const finished = f.endDate && f.endDate <= f.today ? `Finished ${formatStoredDate(f.endDate, { withYear: false })}. ` : '';
  switch (f.status) {
    case 'draft':
      return `Its public site isn’t published yet.${f.finiteSlots ? ' It holds a tournament slot.' : ''}`;
    case 'active': {
      const reg = f.startDate && f.today < f.startDate
        ? ` Registration stays open in its open divisions until it starts on ${formatStoredDate(f.startDate, { withYear: false })}.`
        : '';
      return `Its public site is online.${reg}${f.finiteSlots ? ' It holds a tournament slot.' : ''}`;
    }
    case 'completed':
      return `${finished}Its public site is online and its results are read-only.${f.finiteSlots ? ' It holds a tournament slot.' : ''}${f.sealed ? ` ${RECORD_WORDS.sealedNoReopen}` : ''}`;
    case 'archived':
      return `${finished}Its public site is offline.${f.finiteSlots ? ' It doesn’t hold a tournament slot.' : ''}`;
  }
}

/** The facts a confirm's words depend on — all read before the question is asked. */
export type ConfirmFacts = {
  name: string;
  /** YYYY-MM-DD, or null. */
  startDate: string | null;
  today: string;
  /** The plan has a finite number of slots (the Tournament plan). */
  finiteSlots: boolean;
  /** Mark complete will send the results email (the dashboard route's own rule). */
  willEmailTeams?: boolean;
  /** The plan includes sealing (Tournament Plus+). */
  canSeal?: boolean;
  sealed?: boolean;
};

const startsLater = (f: ConfirmFacts) => Boolean(f.startDate && f.today < f.startDate);
const startDay = (f: ConfirmFacts) => formatStoredDate(f.startDate, { withYear: false });

/** Each change's question: its title, its body, and the button that repeats the verb that opened it. */
export function statusConfirm(change: StatusChange, f: ConfirmFacts): { title: string; body: string; action: string; danger: boolean } {
  switch (change) {
    case 'activate':
      return {
        title: `Activate ${f.name}?`,
        body: startsLater(f)
          ? `Its public site goes online, and teams can register in its open divisions until it starts on ${startDay(f)}.`
          : `Its public site goes online. Registration stays closed: it started on ${startDay(f)}.`,
        action: STATUS_ACTION.activate,
        danger: false,
      };
    case 'complete':
      return {
        title: `Mark ${f.name} complete?`,
        body: [
          'Its results become read-only and final, and registration closes. Its public site stays online.',
          f.willEmailTeams ? 'Each team’s coach gets an email with the final results.' : '',
          'You can reopen it from its record.',
        ].filter(Boolean).join(' '),
        action: STATUS_ACTION.complete,
        danger: false,
      };
    case 'draft':
      return {
        title: `Move ${f.name} back to draft?`,
        body: 'Its public site goes offline right away and registration closes, so every link you’ve shared stops working. Its teams, games, and payments are kept, and you can activate it again from here.',
        action: STATUS_ACTION.draft,
        danger: true,
      };
    case 'reopen':
      return {
        title: `Reopen ${f.name}?`,
        body: startsLater(f)
          ? `Its results become editable again and it moves back to your Tournaments list. Its public site stays online, and teams can register again in its open divisions until it starts on ${startDay(f)}.`
          : 'Its results become editable again and it moves back to your Tournaments list. Its public site stays online, and registration stays closed.',
        action: STATUS_ACTION.reopen,
        danger: false,
      };
    case 'archive':
      return { title: `Archive ${f.name}?`, body: archiveSentence(f.finiteSlots), action: STATUS_ACTION.archive, danger: true };
    case 'bringBack':
      return {
        title: `Bring ${f.name} back?`,
        // Coming back as Completed is a change TO Completed: the route emails the results then, once, on the
        // same rule as Mark complete (an event archived before it was ever completed has never sent them).
        body: [
          'It comes back as Completed, and its public site goes back online at the same links.',
          f.finiteSlots ? 'It will hold a tournament slot again.' : '',
          f.willEmailTeams ? 'Each team’s coach gets an email with the final results.' : '',
        ].filter(Boolean).join(' '),
        action: STATUS_ACTION.bringBack,
        danger: false,
      };
    case 'seal':
      return {
        title: `Seal ${f.name}?`,
        body: 'Sealing keeps a permanent public record of its results as they are now, in your public ledger. The record can’t be changed, sealing can’t be undone, and the tournament can’t be reopened afterwards. Check that every score is final first.',
        action: STATUS_ACTION.seal,
        danger: false,
      };
    case 'delete': {
      const erase = 'This erases the tournament and everything in it: every team, game, result, schedule, division, and rule. It can’t be recovered.';
      return {
        title: `Delete ${f.name}?`,
        body: f.sealed ? `${erase} Its sealed public record stays.` : f.canSeal ? `${erase} To keep its results, seal it first.` : erase,
        action: STATUS_ACTION.delete,
        danger: true,
      };
    }
  }
}
