import { formatStoredDate, tournamentToday } from './timezone';
import { publicSeasonState, registrationDay } from './house-league-season';
import { clubDay, type RegState } from './league-registration-state';
import { reopenRefusal } from './free-floor';
import type { LeagueSeasonStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY HOUSE-LEAGUE STATUS CHANGE ASKS (Club Tier Stage 9a, 9a·4; words HOUSE_LEAGUE_STAGE9A_COPY.md §4).
 *
 * One window per change, each saying what changes for families, its loose ends warning (amber, one sentence) and never
 * blocking. Desk title "{Verb} {season}?"; on a phone "{Verb} the season?" with the name as the body's first line. Foot:
 * the sentence at the left, then Cancel, then the primary — whose verb matches the title's.
 *
 * Status moves (the season PATCH's table): draft → registration_open → registration_closed → active → completed, and back:
 * registration_closed → registration_open (only before play, owner 2026-10-24), completed → active.
 * ⚰ Archive is retired (9f·4, owner 2026-11-04): a finished season is Finished, full stop. A season archived before then
 * still reads as a completed one everywhere and can still be reopened (`archived → active`); nothing moves INTO archived.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type StatusMove = 'open' | 'close' | 'reopenRegistration' | 'start' | 'complete' | 'reopen';

/** Where each move goes. */
export const MOVE_TO: Record<StatusMove, LeagueSeasonStatus> = {
  open: 'registration_open',
  close: 'registration_closed',
  reopenRegistration: 'registration_open',
  start: 'active',
  complete: 'completed',
  reopen: 'active',
};

/**
 * The moves a season in this status offers (its doors), in the order the page shows them. An opened season whose close
 * date has passed (9b-1 Part 4: the dates run the form) is closed already: it offers Start season and "Reopen until…".
 */
export function movesFrom(status: LeagueSeasonStatus | string, regState?: RegState): StatusMove[] {
  switch (status) {
    case 'draft': return ['open'];
    case 'registration_open': return regState === 'closedByDate' ? ['start', 'reopenRegistration'] : ['close'];
    case 'registration_closed': return ['start', 'reopenRegistration'];
    case 'active': return ['complete'];
    case 'completed':
    case 'archived': return ['reopen'];
    default: return [];
  }
}

/** What a window needs to know to say what changes, and its loose ends. */
export type MoveFacts = {
  seasonName: string;
  /** When the form opens (the Open window says "goes live on {date}" while it is ahead). */
  registrationOpenAt?: string | null;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  registrationCloseAt: string | null;
  autoApproveUnderCapacity: boolean;
  pendingReviewCount: number;
  waitlistCount: number;
  unpaidFeeCount: number;
  /**
   * Reopen only (9f·5, 9f·7; the season GET's `reopen` block): the club's seasons that started after this one, newest first,
   * and the season holding the free League plan's one slot when reopening this one would make two live seasons (null on a
   * paid plan, or when the slot is free).
   */
  reopen?: { newer: string[]; blockedBy: { name: string; status: string } | null };
};

export type MoveWords = {
  title: string;
  phoneTitle: string;
  lead: string;
  changes: string[];
  looseEnds: string[];
  foot: string;
  button: string;
  busy: string;
  /**
   * The move is refused before the tap (the free League plan's Reopen, copy 9f §6.2): the window shows these sentences in
   * place of "What changes", its primary button is absent (absent beats disabled, 9a·4) and its only button is Close.
   */
  refused?: string[];
};

const NOT_EMAILED = 'Families are not emailed.';

function waiting(n: number) { return n === 1 ? '1 registration is still waiting for review' : `${n} registrations are still waiting for review`; }
function waitlisted(n: number) { return n === 1 ? '1 family is on the waitlist' : `${n} families are on the waitlist`; }
function owing(n: number) { return n === 1 ? '1 player still owes fees' : `${n} players still owe fees`; }

/** The loose-end sentence (copy §4): only the non-zero parts, joined with commas and "and", one sentence. */
export function looseEndSentence(parts: string[]): string | null {
  if (parts.length === 0) return null;
  const body = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return `${body}.`;
}

// A season's dates are date-only and its registration times are stored as typed (`registrationDay`): either way the day.
const dayOf = (v: string) => registrationDay(v)!;
const label = (v: string) => formatStoredDate(dayOf(v), { withYear: true });

export function moveWords(move: StatusMove, f: MoveFacts, today: string = tournamentToday()): MoveWords {
  const name = f.seasonName;
  switch (move) {
    case 'open':
      return {
        title: `Open registration for ${name}?`, phoneTitle: 'Open registration?',
        lead: 'Families will be able to register as soon as you open it.',
        changes: [
          'The season appears on your public site and on the House league page.',
          f.registrationOpenAt && registrationDay(f.registrationOpenAt)! > today
            ? `The sign-up form goes live on ${clubDay(f.registrationOpenAt, today)}.`
            : 'The sign-up form goes live, and the season shows under Open now.',
          f.autoApproveUnderCapacity
            ? 'New registrations are approved while a division has room, and a full division starts a waitlist.'
            : 'New registrations wait for your review and hold a spot. A full division starts a waitlist.',
          'Families are not emailed when you open registration.',
        ],
        looseEnds: [],
        foot: 'You can close registration at any time.',
        button: 'Open registration', busy: 'Opening…',
      };
    case 'close': {
      const end = looseEndSentence([
        ...(f.pendingReviewCount ? [waiting(f.pendingReviewCount)] : []),
        ...(f.waitlistCount ? [waitlisted(f.waitlistCount)] : []),
      ]);
      return {
        title: `Close registration for ${name}?`, phoneTitle: 'Close registration?',
        lead: 'Families will no longer be able to register.',
        changes: [
          'The sign-up form closes now, whatever the close date says.',
          'The season page says “Registration for this season has closed.”',
          'Nobody new can join a waitlist. Families already on it keep their place.',
          'You can still approve, waitlist and add registrations by hand.',
          'Families who already registered can still look up their status.',
          NOT_EMAILED,
        ],
        looseEnds: end ? [end] : [],
        foot: 'You can reopen registration later.',
        button: 'Close registration', busy: 'Closing…',
      };
    }
    // "Reopen until…" (S2·b): the window asks for the new close date (SeasonStatusWindow's field).
    case 'reopenRegistration':
      return {
        title: `Reopen registration for ${name}?`, phoneTitle: 'Reopen registration?',
        lead: 'The sign-up form opens again now and stays open until the date you pick.',
        changes: [
          'Families can sign up again, and the season shows under Open now.',
          'People already on the waitlist keep their place.',
          NOT_EMAILED,
        ],
        looseEnds: [],
        foot: 'You can close it again at any time.',
        button: 'Reopen registration', busy: 'Reopening…',
      };
    case 'start': {
      const end = looseEndSentence(f.pendingReviewCount ? [waiting(f.pendingReviewCount)] : []);
      return {
        title: `Start ${name}?`, phoneTitle: 'Start the season?',
        lead: 'The season starts.',
        changes: [
          'Your public site shows it as Playing now, or Starts {date} if its first day is ahead, with Schedule and Standings up front.'
            .replace('{date}', f.seasonStartDate ? formatStoredDate(f.seasonStartDate, { withYear: false }) : 'its first day'),
          'Registration stays closed.',
          NOT_EMAILED,
        ],
        looseEnds: end ? [end] : [],
        foot: 'Teams and the schedule can still change while it is running.',
        button: 'Start season', busy: 'Starting…',
      };
    }
    case 'complete': {
      const end = looseEndSentence([
        ...(f.pendingReviewCount ? [waiting(f.pendingReviewCount)] : []),
        ...(f.waitlistCount ? [waitlisted(f.waitlistCount)] : []),
        ...(f.unpaidFeeCount ? [owing(f.unpaidFeeCount)] : []),
      ]);
      const ahead = f.seasonEndDate && dayOf(f.seasonEndDate) >= today
        ? [`Its end date, ${label(f.seasonEndDate)}, is still ahead.`] : [];
      return {
        title: `Complete ${name}?`, phoneTitle: 'Complete the season?',
        lead: 'The season moves to Past seasons. What changes:',
        changes: [
          'Registrations, teams and the schedule can no longer be changed.',
          'Money stays open: you can still mark fees received and record refunds.',
          'You can still email its families.',
          'Your public site lists it under Past seasons, and its schedule and standings stay up.',
          // The finish erases them (mig 377's trigger, 9c·2b); 9f·7 says so where it happens.
          'Player ratings are erased.',
          NOT_EMAILED,
        ],
        looseEnds: [...ahead, ...(end ? [end] : [])],
        foot: 'You can reopen it from Past seasons.',
        button: 'Complete season', busy: 'Completing…',
      };
    }
    case 'reopen': {
      const base = {
        title: `Reopen ${name}?`, phoneTitle: 'Reopen the season?',
        foot: 'You can complete it again at any time.',
        button: 'Reopen season', busy: 'Reopening…',
      };
      // The free League plan's one season (9f·5): refused in words on the window, before the tap.
      const holder = f.reopen?.blockedBy;
      if (holder) return { ...base, lead: '', changes: [], looseEnds: [], refused: reopenRefusal(holder) };
      // What the public site will call it once it is running again, read from the site's own tag (9f·3) so the window
      // can never promise a different word or date: "Ended Aug 28" (with the year for another year, as the site writes
      // it) once its last day has passed, "Starts {date}" before its first, else Playing now.
      const shown = publicSeasonState({ status: 'active', seasonStartDate: f.seasonStartDate, seasonEndDate: f.seasonEndDate }, today)!;
      return {
        ...base,
        lead: 'The season comes back to Running now. What changes:',
        changes: [
          'Registrations, teams and the schedule can be changed again.',
          shown.label.startsWith('Ended ')
            ? `Your public site lists it as ${shown.label} until you complete it again.`
            : `Your public site lists it as ${shown.label}.`,
          'Player ratings were erased when it finished. They don’t come back.',
          ...newerSentence(f.reopen?.newer ?? []),
          NOT_EMAILED,
        ],
        looseEnds: [],
      };
    }
  }
}

/** The newer seasons a Reopen leaves alone (9f·7): one name, two names, or a count from three. */
export function newerSentence(newer: readonly string[]): string[] {
  if (newer.length === 0) return [];
  if (newer.length === 1) return [`${newer[0]} is not changed.`];
  if (newer.length === 2) return [`${newer[0]} and ${newer[1]} are not changed.`];
  return [`Your ${newer.length} newer seasons are not changed.`];
}

/** The rare door's sentence and link at the end of the season page (copy §4, button summary). */
export function rareDoor(move: 'complete' | 'reopen', f: Pick<MoveFacts, 'seasonEndDate'>, today: string = tournamentToday()) {
  if (move === 'complete') {
    const ended = f.seasonEndDate && dayOf(f.seasonEndDate) < today;
    return {
      sentence: ended ? `This season ended ${formatStoredDate(f.seasonEndDate!, { withYear: false })}.` : 'Done with this season?',
      link: 'Complete the season…',
    };
  }
  return { sentence: 'Need to change something?', link: 'Reopen the season…' };
}

/**
 * DELETING A SEASON THAT IS ONLY A SHELL (owner, 2026-10-25). Not a status move: it removes the season. Offered only while the
 * season has not opened registration and nothing real (a family, a team, a game, an email) is attached; after that it is
 * official, and it ends by being completed. Same window shape as the moves: sentence at the left, Cancel · the action at the right.
 */
export function deleteSeasonWords(seasonName: string): MoveWords {
  return {
    title: `Delete ${seasonName}?`, phoneTitle: 'Delete the season?',
    lead: 'The season is removed for good. What goes with it:',
    changes: [
      'Its divisions and the setup you did: dates, fee and waiver.',
      'Nobody sees a change. Nothing is public yet and no family has registered.',
      'Its web address is freed up, so you can use it again.',
    ],
    looseEnds: [],
    foot: 'This can’t be undone.',
    button: 'Delete season', busy: 'Deleting…',
  };
}

/** The rare door's sentence and link for a shell, at the end of the season page. */
export const DELETE_DOOR = { sentence: 'Made this by mistake?', link: 'Delete the season…' } as const;
